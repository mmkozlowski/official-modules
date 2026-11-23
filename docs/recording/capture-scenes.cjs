const { chromium } = require('/Users/mac/Repo/flowbiz-erp/node_modules/playwright')
const BASE = 'http://localhost:3017'
const OUT = '/Users/mac/Repo/official-modules-production-bom/docs/recording'
const log = (...a) => console.log('[scene]', ...a)

async function settle(page, ms = 1500) {
  await page.waitForLoadState('networkidle', { timeout: 120000 }).catch(() => {})
  await page.waitForTimeout(ms)
}
async function dismissBanners(page) {
  for (const name of [/Akceptuj/i, /Accept cookies/i]) {
    const b = page.getByRole('button', { name })
    if (await b.count()) await b.first().click().catch(() => {})
  }
}
async function scrollTo(page, testId) {
  await page.evaluate((id) => {
    const el = document.querySelector(`[data-testid=${id}]`) || document.getElementById(id)
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY - 84
    const scroller = document.scrollingElement
    scroller.scrollTo({ top })
    // the backend shell scrolls an inner container; move it too
    let node = el.parentElement
    while (node) { if (node.scrollHeight > node.clientHeight + 10 && getComputedStyle(node).overflowY !== 'visible') { node.scrollTop += el.getBoundingClientRect().top - 84; break } node = node.parentElement }
  }, testId)
  await page.waitForTimeout(500)
}
async function showNavGroup(page) {
  const navText = await page.locator('aside').first().innerText().catch(() => '')
  log('nav has Produkcja:', /PRODUKCJA|Produkcja/.test(navText), 'Wyroby:', navText.includes('Wyroby'))
  const link = page.locator('aside a, nav a').filter({ hasText: 'Wyroby (BOM)' }).first()
  if (await link.count()) await link.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(300)
}
async function shot(page, name) {
  await dismissBanners(page)
  await page.mouse.move(1430, 890)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  log('shot', name)
}

;(async () => {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pl-PL' })
  await context.addCookies([{ name: 'locale', value: 'pl', url: BASE }])
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)) })

  await page.goto(BASE + '/login')
  await page.fill('input[type=email]', 'superadmin@acme.com')
  await page.fill('input[type=password]', 'secret')
  await page.click('button[type=submit]')
  await page.waitForURL(/backend/, { timeout: 120000 })
  await settle(page)
  await dismissBanners(page)

  const api = async (path, init) => {
    const r = await page.request.fetch(BASE + path, init)
    return { status: r.status(), body: await r.json().catch(() => null) }
  }
  const products = (await api('/api/production_bom/products?pageSize=100')).body.items
  const materials = (await api('/api/production_bom/materials?pageSize=100')).body.items
  const byName = (list, prefix) => list.find((x) => x.name.startsWith(prefix))
  const cushion = byName(products, 'Poduszka na krzesło')
  const bench = byName(products, 'Poduszka na ławkę')
  const zipper = byName(materials, 'Zamek spiralny')
  const fabric = byName(materials, 'Tkanina outdoor szara')

  // Reset what earlier runs changed: the extra velcro line and copies.
  const cushionBom = (await api(`/api/production_bom/products/${cushion.id}/bom`)).body
  const kept = cushionBom.lines.filter((l) => !l.materialName.startsWith('Rzep'))
  if (kept.length !== cushionBom.lines.length) {
    await api(`/api/production_bom/products/${cushion.id}/bom`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      data: { lines: kept.map((l) => l.segmentCount ? { materialId: l.materialId, segmentCount: l.segmentCount, segmentLength: Number(l.segmentLength) } : { materialId: l.materialId, quantity: Number(l.quantity) }) },
    })
  }
  for (const copy of products.filter((p) => p.source_product_id)) {
    await api(`/api/production_bom/products?id=${copy.id}`, { method: 'DELETE' })
  }

  // Guard check: fabric must be refused in a BOM.
  const refused = await api(`/api/production_bom/products/${cushion.id}/bom`, {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    data: { lines: [{ materialId: fabric.id, quantity: 1 }] },
  })
  log('fabric in BOM ->', refused.status, refused.body && refused.body.error)

  // 1. Materials list
  await page.goto(BASE + '/backend/production-bom/materials'); await settle(page, 2500)
  await showNavGroup(page)
  await shot(page, '01-materialy-lista')

  // 2. Material form + where used (zipper)
  await page.goto(BASE + `/backend/production-bom/materials/${zipper.id}`); await settle(page, 2500)
  await shot(page, '02-material-formularz')
  await scrollTo(page, 'usage')
  await shot(page, '03-material-gdzie-uzywany')

  // 3. Products list
  await page.goto(BASE + '/backend/production-bom/products'); await settle(page, 2500)
  await showNavGroup(page)
  await shot(page, '04-wyroby-lista')

  // 4. Product detail — fields
  await page.goto(BASE + `/backend/production-bom/products/${cushion.id}`); await settle(page, 3000)
  await shot(page, '05-wyrob-pola')
  // 5. BOM editor
  await scrollTo(page, 'bom-editor')
  await shot(page, '06-wyrob-bom')

  // 5b. Edit BOM: add velcro 0.3 m, save
  await page.getByRole('button', { name: 'Dodaj materiał' }).click()
  const lastLine = page.getByTestId('bom-line').last()
  await lastLine.getByRole('combobox').click()
  await page.getByRole('option', { name: 'Rzep 20 mm' }).click()
  const qty = lastLine.locator('input').first()
  await qty.fill('0,3')
  await page.waitForTimeout(400)
  await scrollTo(page, 'bom-editor')
  await shot(page, '07-bom-dodawanie-pozycji')
  await page.getByRole('button', { name: 'Zapisz BOM' }).click()
  await page.waitForTimeout(2000)
  await shot(page, '08-bom-zapisany')
  log('bom total after save:', await page.getByTestId('bom-total').textContent())

  // 6. Requirements for 200 with fabric
  await scrollTo(page, 'requirements')
  const reqSection = page.getByTestId('requirements')
  await reqSection.getByRole('combobox').click()
  await page.getByRole('option', { name: 'Tkanina outdoor szara' }).click()
  await page.waitForTimeout(600)
  await scrollTo(page, 'requirements')
  await shot(page, '09-zapotrzebowanie-200-szt')
  log('requirements total:', await page.getByTestId('requirements-total').textContent())

  // 7. Bench cushion — split into pieces (3 × 1,40 m) and its cut list
  await page.goto(BASE + `/backend/production-bom/products/${bench.id}`); await settle(page, 3000)
  await scrollTo(page, 'bom-editor')
  await shot(page, '10-bom-podzial-na-odcinki')
  await scrollTo(page, 'requirements')
  await shot(page, '11-odcinki-do-ciecia')

  // 8. Duplicate from product list
  await page.goto(BASE + '/backend/production-bom/products'); await settle(page, 2500)
  const row = page.getByRole('row', { name: /Poduszka na krzesło ogrodowe 45×45/ })
  await row.locator('button[aria-haspopup=menu]').first().hover()
  await page.waitForTimeout(400)
  if (!(await page.getByRole('menuitem').count())) await row.locator('button[aria-haspopup=menu]').first().click()
  await page.waitForTimeout(600)
  await page.getByRole('menuitem', { name: 'Duplikuj wyrób' }).click()
  await page.waitForTimeout(500)
  const nameInput = page.locator('#duplicate-name')
  await nameInput.fill('Poduszka na krzesło ogrodowe 50×50')
  await page.locator('#duplicate-code').fill('PO-50')
  await shot(page, '12-duplikowanie-okno')
  await page.getByRole('button', { name: 'Duplikuj', exact: true }).click()
  await page.waitForURL(/products\/[0-9a-f-]{36}$/, { timeout: 60000 })
  await settle(page, 2500)
  await shot(page, '13-duplikat-z-komunikatem')
  await scrollTo(page, 'bom-editor')
  await shot(page, '14-duplikat-bom')

  log('errors:', errors.length ? errors.join('\n') : 'none')
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
