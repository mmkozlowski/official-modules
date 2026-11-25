// Przywraca demo planowania produkcji do stanu „na czysto” przed nagraniem:
// gniazda i marszruty jak w danych demo, zlecenia od nowa z terminami liczonymi
// od DZISIAJ (dni robocze), bez pilnego zlecenia z poprzedniej próby.
// Uruchamiaj w dniu nagrania, przy działającej aplikacji:
//   node docs/recording/production-planning/reset-demo.cjs
// Wymaga zbudowanego pakietu (yarn workspace @open-mercato/production-planning build).
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { chromium } = require(process.env.PLAYWRIGHT || '/Users/mac/Repo/flowbiz-erp/node_modules/playwright')

const BASE = process.env.BASE || 'http://localhost:3018'
const LIB = path.resolve(__dirname, '../../../packages/production-planning/dist/modules/production_planning/lib')

function localIsoDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

;(async () => {
  const { DEMO_WORK_CENTERS, DEMO_ROUTINGS, planDemoOrders } = await import(pathToFileURL(path.join(LIB, 'demo-orders.js')).href)
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(BASE + '/login')
  await page.fill('input[type=email]', 'superadmin@acme.com')
  await page.fill('input[type=password]', 'secret')
  await page.click('button[type=submit]')
  await page.waitForURL(/backend/, { timeout: 180000 })
  const api = async (url, init) => {
    const response = await page.request.fetch(BASE + url, init)
    const body = await response.json().catch(() => null)
    if (response.status() >= 400) throw new Error(`${init?.method || 'GET'} ${url} → ${response.status()} ${JSON.stringify(body)}`)
    return body
  }
  const json = (method, data) => ({ method, headers: { 'content-type': 'application/json' }, data })

  // 1. Zlecenia: wszystkie usuwamy (także pilne z próby).
  let removed = 0
  for (;;) {
    const list = await api('/api/production_planning/orders?pageSize=100')
    if (!list.items.length) break
    for (const order of list.items) {
      await api(`/api/production_planning/orders?id=${order.id}`, { method: 'DELETE' })
      removed += 1
    }
  }

  // 2. Gniazda: demo wracają do swoich wartości, dodane na próbie znikają.
  const centres = (await api('/api/production_planning/work-centers?pageSize=100')).items
  const centreIdByCode = new Map()
  for (const seed of DEMO_WORK_CENTERS) {
    const payload = { ...seed, isActive: true }
    const existing = centres.find((centre) => centre.code === seed.code)
    if (existing) {
      await api('/api/production_planning/work-centers', json('PUT', { id: existing.id, ...payload }))
      centreIdByCode.set(seed.code, existing.id)
    } else {
      const created = await api('/api/production_planning/work-centers', json('POST', payload))
      centreIdByCode.set(seed.code, created.id)
    }
  }
  for (const centre of centres) {
    if (!DEMO_WORK_CENTERS.some((seed) => seed.code === centre.code)) {
      await api(`/api/production_planning/work-centers?id=${centre.id}`, { method: 'DELETE' })
      console.log('usunięte gniazdo spoza demo:', centre.name)
    }
  }

  // 3. Marszruty wyrobów demo.
  const products = (await api('/api/production_bom/products?pageSize=100')).items
  const productByCode = new Map(products.filter((p) => !p.source_product_id).map((p) => [p.code, p]))
  for (const [code, steps] of Object.entries(DEMO_ROUTINGS)) {
    const product = productByCode.get(code)
    if (!product) throw new Error(`Brak wyrobu ${code} w BOM — najpierw dane BOM`)
    await api(`/api/production_planning/routings/${product.id}`, json('PUT', {
      steps: steps.map((step) => ({ workCenterId: centreIdByCode.get(step.workCenter), minutesPerUnit: step.minutesPerUnit, setupMinutes: step.setupMinutes || 0 })),
    }))
  }

  // 4. Zlecenia od nowa, terminy względem dzisiaj.
  const fabrics = (await api('/api/production_bom/materials?pageSize=100&materialType=fabric')).items
  const fabricByCode = new Map(fabrics.map((fabric) => [fabric.code, fabric.id]))
  const orders = planDemoOrders(localIsoDate())
  for (const order of orders) {
    await api('/api/production_planning/orders', json('POST', {
      number: order.number,
      productId: productByCode.get(order.product).id,
      quantity: order.quantity,
      dueDate: order.dueDate,
      priority: 'normal',
      status: order.status || 'planned',
      fabricMaterialId: order.fabric ? fabricByCode.get(order.fabric) || null : null,
      reference: order.reference || null,
    }))
  }

  // 5. Kontrola: plan bez przeciążeń.
  const plan = await api('/api/production_planning/plan?days=10')
  console.log(`usunięte zlecenia: ${removed}, nowe: ${orders.length} (${orders[0].number} … ${orders[orders.length - 1].number})`)
  console.log(`okno planu: od ${plan.input.from}, przeciążone dni gniazd: ${plan.plan.overloadedCells}`)
  if (plan.plan.overloadedCells !== 0) {
    console.log('UWAGA: plan startowy ma przeciążenia — sprawdź dane demo przed nagraniem')
    process.exitCode = 1
  }
  await browser.close()
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
