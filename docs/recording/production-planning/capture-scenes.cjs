// Jeden przebieg całego scenariusza nagrania: reset → sceny → zrzuty → reset.
// Zrzuty lądują obok tego pliku. Uruchom przy działającej aplikacji:
//   node docs/recording/production-planning/capture-scenes.cjs
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { chromium } = require(process.env.PLAYWRIGHT || '/Users/mac/Repo/flowbiz-erp/node_modules/playwright')

const BASE = process.env.BASE || 'http://localhost:3018'
const OUT = __dirname
const reset = () => execFileSync('node', [path.join(__dirname, 'reset-demo.cjs')], { stdio: 'inherit', env: process.env })
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

;(async () => {
  reset()
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pl-PL' })
  await context.addCookies([{ name: 'locale', value: 'pl', url: BASE }])
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(BASE + '/login')
  await page.fill('input[type=email]', 'superadmin@acme.com')
  await page.fill('input[type=password]', 'secret')
  await page.click('button[type=submit]')
  await page.waitForURL(/backend/, { timeout: 180000 })
  const shot = async (name, options = {}) => {
    await pause(options.wait ?? 2200)
    await page.screenshot({ path: path.join(OUT, name), fullPage: !!options.fullPage })
    console.log('zrzut', name)
  }
  const plan = (await (await page.request.fetch(BASE + '/api/production_planning/plan?days=10')).json()).input
  const codeOf = new Map(plan.products.map((p) => [p.id, p.code]))
  const find = (code, quantity) => plan.orders.filter((o) => codeOf.get(o.productId) === code && o.quantity === quantity).sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0]
  const moved = find('PO-45', 100)
  const stock = find('WK-50', 100)
  console.log('przesuwane:', moved.number, moved.dueDate, '| na magazyn:', stock.number, stock.dueDate)

  // 1. Plan na starcie
  await page.goto(BASE + '/backend/production-planning/plan', { timeout: 180000 })
  await page.getByText('Obłożenie gniazd').waitFor({ timeout: 180000 })
  const cookies = page.getByRole('button', { name: /Accept cookies|Zaakceptuj/ })
  if (await cookies.count()) await cookies.first().click()
  await shot('01-plan-start.png')
  await shot('02-plan-cala-strona.png', { fullPage: true, wait: 300 })

  // 2. Kto siedzi w komórce — najechanie na zlecenie
  await page.getByTestId(`due-${moved.number}`).hover()
  await shot('03-podswietlenie-zlecenia.png', { wait: 600 })

  // 3. Moment wow 1: termin 3 dni robocze wcześniej
  for (let i = 0; i < 3; i += 1) {
    await page.getByTestId(`move-earlier-${moved.number}`).click()
    await pause(1500)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await shot('04-przesuniecie-czerwone.png', { wait: 400 })
  for (let i = 0; i < 3; i += 1) {
    await page.getByTestId(`move-later-${moved.number}`).click()
    await pause(1500)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await shot('05-cofniete-zielone.png', { wait: 400 })

  // 4. Moment wow 2: pilne zlecenie
  await page.getByTestId('urgent-open').click()
  await page.locator('#urgent-product').selectOption({ label: 'PO-45 — Poduszka na krzesło ogrodowe 45×45' })
  await page.locator('#urgent-quantity').fill('80')
  const urgentDue = await page.locator('#urgent-due').inputValue()
  await page.locator('#urgent-fabric').selectOption({ label: 'Tkanina outdoor szara' })
  await page.locator('#urgent-reference').fill('Pilne — zamówienie z targów ogrodniczych')
  console.log('pilne na:', urgentDue)
  await shot('06-pilne-okno.png', { wait: 500 })
  await page.getByTestId('urgent-submit').click()
  await page.evaluate(() => window.scrollTo(0, 0))
  await shot('07-pilne-czerwone.png', { wait: 1200 })

  // 5. Naprawa: wkłady na magazyn 3 dni później
  for (let i = 0; i < 3; i += 1) {
    await page.getByTestId(`move-later-${stock.number}`).click()
    await pause(1500)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await shot('08-naprawione.png', { wait: 400 })
  await page.getByText('Zapotrzebowanie materiałowe').scrollIntoViewIfNeeded()
  await shot('09-zapotrzebowanie.png', { wait: 600 })

  // 6. Pozostałe ekrany
  await page.goto(BASE + '/backend/production-planning/orders')
  await shot('10-zlecenia-lista.png', { wait: 5000 })
  await page.goto(BASE + `/backend/production-planning/orders/${moved.id}`)
  await shot('11-zlecenie-etapy.png', { wait: 5000, fullPage: true })
  await page.goto(BASE + '/backend/production-planning/work-centers')
  await shot('12-gniazda.png', { wait: 5000 })
  await page.goto(BASE + '/backend/production-planning/routings')
  await shot('13-marszruty.png', { wait: 5000 })
  await page.goto(BASE + `/backend/production-planning/routings/${moved.productId}`)
  await shot('14-marszruta-edytor.png', { wait: 5000 })

  console.log(errors.length ? 'BŁĘDY STRONY:\n' + errors.join('\n') : 'bez błędów strony')
  await browser.close()
  reset()
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
