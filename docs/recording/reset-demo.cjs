// Przywraca dane demo do stanu „na czysto” przed nagraniem: usuwa „Rzep” dodany w scenie 5
// i kopie wyrobów z duplikowania. Uruchom: node docs/recording/reset-demo.cjs
const { chromium } = require(process.env.PLAYWRIGHT || '/Users/mac/Repo/flowbiz-erp/node_modules/playwright')
const BASE = process.env.BASE || 'http://localhost:3017'
;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(BASE + '/login')
  await page.fill('input[type=email]', 'superadmin@acme.com')
  await page.fill('input[type=password]', 'secret')
  await page.click('button[type=submit]')
  await page.waitForURL(/backend/, { timeout: 120000 })
  const api = async (path, init) => { const r = await page.request.fetch(BASE + path, init); return { status: r.status(), body: await r.json().catch(() => null) } }
  const products = (await api('/api/production_bom/products?pageSize=100')).body.items
  const cushion = products.find((p) => p.name.startsWith('Poduszka na krzesło') && !p.source_product_id)
  const bom = (await api(`/api/production_bom/products/${cushion.id}/bom`)).body
  const kept = bom.lines.filter((l) => !l.materialName.startsWith('Rzep'))
  if (kept.length !== bom.lines.length) {
    const r = await api(`/api/production_bom/products/${cushion.id}/bom`, { method: 'PUT', headers: { 'content-type': 'application/json' },
      data: { lines: kept.map((l) => l.segmentCount ? { materialId: l.materialId, segmentCount: l.segmentCount, segmentLength: Number(l.segmentLength) } : { materialId: l.materialId, quantity: Number(l.quantity) }) } })
    console.log('rzep usunięty', r.status)
  }
  for (const copy of products.filter((p) => p.source_product_id)) {
    const orgId = copy.organization_id || copy.organizationId
    if (orgId) await page.context().addCookies([{ name: 'om_selected_org', value: orgId, url: BASE }])
    let r = await api(`/api/production_bom/products?id=${copy.id}`, { method: 'DELETE' }); if (r.status >= 400) console.log(JSON.stringify(r.body)); console.log('kopia usunięta', copy.name, r.status)
  }
  const after = (await api('/api/production_bom/products?pageSize=100')).body.items
  console.log('wyroby:', after.map((p) => p.name).join(' | '))
  await browser.close()
})()
