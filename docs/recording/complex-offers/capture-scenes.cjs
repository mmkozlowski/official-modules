// Jeden przebieg: smoke API (blokada edycji, przejścia statusów) + zrzuty scen 1440×900.
// Uruchom przy działającym serwerze: node docs/recording/complex-offers/capture-scenes.cjs
// Na końcu przywraca dane demo (reset-demo). Wyłącz potem serwer dev.
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { chromium } = require(process.env.PLAYWRIGHT || '/Users/mac/Repo/flowbiz-erp/node_modules/playwright')

const BASE = process.env.BASE || 'http://localhost:3019'
const OUT = __dirname
const ROOT = path.resolve(__dirname, '../../..')
const log = (...a) => console.log('[scene]', ...a)
const failures = []
const expect = (label, condition, detail) => {
  if (condition) log('OK  ', label)
  else {
    failures.push(label)
    log('FAIL', label, detail ?? '')
  }
}

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
async function scrollTo(page, testId, offset = 84) {
  await page.evaluate(([id, off]) => {
    const el = document.querySelector(`[data-testid=${id}]`)
    if (!el) return
    let node = el.parentElement
    while (node) {
      if (node.scrollHeight > node.clientHeight + 10 && getComputedStyle(node).overflowY !== 'visible') {
        node.scrollTop += el.getBoundingClientRect().top - off
        break
      }
      node = node.parentElement
    }
    window.scrollBy(0, el.getBoundingClientRect().top - off)
  }, [testId, offset])
  await page.waitForTimeout(500)
}
async function shot(page, name) {
  await dismissBanners(page)
  await page.mouse.move(1430, 890)
  await page.screenshot({ path: path.join(OUT, `${name}.png`) })
  log('shot', name)
}

function resetDemo() {
  execFileSync('yarn', ['mercato', 'complex_offers', 'reset-demo'], { cwd: ROOT, stdio: 'ignore' })
  log('reset-demo done')
}

;(async () => {
  resetDemo()
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

  const api = async (p, init) => {
    const r = await page.request.fetch(BASE + p, init)
    return { status: r.status(), body: await r.json().catch(() => null) }
  }
  const json = (method, data) => ({ method, headers: { 'content-type': 'application/json' }, data })

  // ── Smoke API ──────────────────────────────────────────────────────────
  const offers = (await api('/api/complex_offers/offers?pageSize=100')).body.items
  expect('4 oferty demo', offers.length === 4, offers.length)
  const terrace = offers.find((o) => o.customer_name === 'Pensjonat Leśna Polana')
  let view = (await api(`/api/complex_offers/offers/${terrace.id}/view`)).body
  const v1 = view.versions[0]
  expect('v1 wysłana i zablokowana', v1.status === 'sent' && v1.isEditable === false)
  const locked = await api(`/api/complex_offers/lines/${v1.lines[0].id}`, json('PUT', { quantity: 99 }))
  expect('edycja pozycji wysłanej wersji → 409 version_locked', locked.status === 409 && locked.body?.error === 'version_locked', locked.status)
  const lockedHeader = await api('/api/complex_offers/offers', json('PUT', { id: terrace.id, title: 'x' }))
  expect('edycja nagłówka wysłanej oferty → 409', lockedHeader.status === 409, lockedHeader.status)
  const backToDraft = await api(`/api/complex_offers/versions/${v1.id}/status`, json('POST', { status: 'draft' }))
  expect('wysłana → robocza odrzucone', backToDraft.status === 409, backToDraft.status)
  const print = await page.request.fetch(`${BASE}/api/complex_offers/versions/${v1.id}/print`)
  const printHtml = await print.text()
  expect('wydruk HTML 200 bez marży', print.status() === 200 && printHtml.includes('Oferta') && !/Marża/.test(printHtml), print.status())
  const models = (await api('/api/complex_offers/models?pageSize=100')).body.items
  const bench = models.find((m) => m.code === 'OF-PO-LAW')
  expect('model ma 3 wymiary i 3 tkaniny', bench?.option_counts?.size === 3 && bench?.option_counts?.fabric === 3, JSON.stringify(bench?.option_counts))

  // ── Sceny ──────────────────────────────────────────────────────────────
  // 1. Lista ofert
  await page.goto(BASE + '/backend/complex-offers/offers'); await settle(page, 2500)
  await shot(page, '01-oferty-lista')

  // 2. Model i cennik
  await page.goto(BASE + `/backend/complex-offers/models/${bench.id}`); await settle(page, 2500)
  await shot(page, '02-model-pola-koszt-bom')
  await page.getByRole('button', { name: 'Pobierz aktualny koszt z BOM' }).first().click()
  await page.waitForTimeout(2500)
  await shot(page, '03-model-koszt-z-bom-odswiezony')
  await scrollTo(page, 'pricing-rules')
  await shot(page, '04-model-cennik')

  // 3. Oferta v1 wysłana (zablokowana)
  await page.goto(BASE + `/backend/complex-offers/offers/${terrace.id}`); await settle(page, 3000)
  await shot(page, '05-oferta-v1-zablokowana')
  await page.getByTestId('toggle-breakdown').first().click()
  await page.waitForTimeout(500)
  await scrollTo(page, 'offer-line', 120)
  await shot(page, '06-v1-skad-ta-cena')

  // 4. Nowa wersja
  await page.getByTestId('new-version').click()
  await page.waitForTimeout(3000)
  await shot(page, '07-v2-utworzona')

  // 5. WOW: zmiana tkaniny na grafit w paski na pozycji 1
  const firstLine = page.getByTestId('offer-line').first()
  const totalBefore = await page.getByTestId('total-net').textContent()
  await firstLine.getByTestId('param-fabric').click()
  await page.getByRole('option', { name: /grafit w paski/ }).click()
  await page.waitForTimeout(2500)
  await scrollTo(page, 'offer-line', 100)
  await shot(page, '08-wow-zmiana-tkaniny-rozbicie')
  const delta = await firstLine.getByTestId('line-delta').textContent().catch(() => null)
  const lineTotal = await firstLine.getByTestId('line-total').textContent()
  log('delta:', delta, 'line total:', lineTotal)
  expect('pozycja 1 po zmianie tkaniny = 8077,20 zł', /8\s?077,20/.test(lineTotal ?? ''), lineTotal)
  expect('delta +427,44 zł', /427,44/.test(delta ?? ''), delta)
  await scrollTo(page, 'version-totals', 300)
  await shot(page, '09-wow-suma-oferty')
  const totalAfter = await page.getByTestId('total-net').textContent()
  log('total before/after:', totalBefore, '→', totalAfter)

  // 6. v1 nietknięta
  await page.getByTestId('version-tabs').getByRole('button').filter({ hasText: 'v1' }).click()
  await page.waitForTimeout(1500)
  await shot(page, '10-v1-nietknieta')
  view = (await api(`/api/complex_offers/offers/${terrace.id}/view`)).body
  expect('v1 nadal ma tę samą sumę po zmianie v2', view.versions[0].totalNet === v1.totalNet, `${view.versions[0].totalNet} vs ${v1.totalNet}`)

  // 7. Wysłanie v2
  await page.getByTestId('version-tabs').getByRole('button').filter({ hasText: 'v2' }).click()
  await page.waitForTimeout(1000)
  await page.getByTestId('send-version').click()
  await page.waitForTimeout(800)
  await shot(page, '11-wyslij-potwierdzenie')
  await page.getByRole('alertdialog').getByRole('button').last().click().catch(async () => {
    await page.getByRole('dialog').getByRole('button').last().click()
  })
  await page.waitForTimeout(2500)
  await shot(page, '12-v2-wyslana')

  // 8. PDF v2
  const v2 = (await api(`/api/complex_offers/offers/${terrace.id}/view`)).body.versions[1]
  expect('v2 wysłana', v2.status === 'sent', v2.status)
  const printPage = await context.newPage()
  await printPage.goto(`${BASE}/api/complex_offers/versions/${v2.id}/print`); await printPage.waitForTimeout(1200)
  await printPage.screenshot({ path: path.join(OUT, '13-pdf-v2.png') })
  await printPage.pdf({ path: path.join(OUT, 'oferta-OF-0001-v2.pdf'), format: 'A4', printBackground: true }).catch(() => log('pdf export skipped'))
  log('shot 13-pdf-v2')

  const relevantErrors = errors.filter((e) => !/favicon|Download the React DevTools|hydrat/i.test(e))
  log('page errors:', relevantErrors.length ? relevantErrors.slice(0, 10) : 'none')
  await browser.close()
  resetDemo()
  if (failures.length) {
    console.log('\nFAILURES:', failures)
    process.exit(1)
  }
  console.log('\nAll checks passed.')
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
