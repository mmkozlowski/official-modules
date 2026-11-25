// Zrzuty do planu nagrania + próba generalna „momentu wow” jednym przebiegiem.
// Wymaga działającej aplikacji (http://localhost:3020) i świeżego resetu:
//   node docs/recording/department-routing/reset-demo.cjs
//   node docs/recording/department-routing/capture-scenes.cjs
// Po przebiegu dane są „zużyte” (zamówienie 0141 skończone) — zrób reset jeszcze raz.
const { chromium } = require(process.env.PLAYWRIGHT || '/Users/mac/Repo/flowbiz-erp/node_modules/playwright')
const { join } = require('node:path')

const BASE = process.env.BASE || 'http://localhost:3020'
const OUT = __dirname
const ORDER_NUMBER = 'ZAM/2026/0141'

const shot = async (page, name) => {
  await page.waitForTimeout(700)
  await page.screenshot({ path: join(OUT, `${name}.png`) })
  console.log('zrzut', name)
}

async function dismissCookies(page) {
  for (const name of [/Akceptuj/i, /Accept cookies/i]) {
    const button = page.getByRole('button', { name })
    if (await button.count()) await button.first().click().catch(() => {})
  }
}

async function reportAll(board, product) {
  const card = board.locator(`[data-testid="task-card"][data-order="${ORDER_NUMBER}"][data-product="${product}"]`)
  await card.getByTestId('report-all').click()
  await board.waitForTimeout(600)
}

;(async () => {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pl-PL' })
  await context.addCookies([{ name: 'locale', value: 'pl', url: BASE }])
  const page = await context.newPage()
  const failures = []
  page.on('pageerror', (error) => failures.push(error.message))

  await page.goto(BASE + '/login')
  await page.fill('input[type=email]', 'superadmin@acme.com')
  await page.fill('input[type=password]', 'secret')
  await page.click('button[type=submit]')
  await page.waitForURL(/backend/, { timeout: 180000 })
  await dismissCookies(page)

  // 1. Lista zamówień
  await page.goto(BASE + '/backend/department-routing/orders', { timeout: 180000 })
  await page.getByText(ORDER_NUMBER).first().waitFor({ timeout: 120000 })
  await shot(page, '01-zamowienia-lista')

  // 2–3. Działy i routing produktu
  await page.goto(BASE + '/backend/department-routing/departments', { timeout: 180000 })
  await page.getByText('Tapicernia').first().waitFor({ timeout: 120000 })
  await shot(page, '02-dzialy')
  await page.goto(BASE + '/backend/department-routing/products', { timeout: 180000 })
  await page.getByText('Ławka ogrodowa z oparciem 150 cm').first().waitFor({ timeout: 120000 })
  await shot(page, '03-routing-produktow')
  await page.getByText('Ławka ogrodowa z oparciem 150 cm').first().click()
  await page.getByTestId('routing-step').first().waitFor({ timeout: 120000 })
  await page.mouse.wheel(0, 600)
  await shot(page, '04-routing-lawki')

  // 4. Zamówienie przed przyjęciem
  await page.goto(BASE + '/backend/department-routing/orders', { timeout: 180000 })
  await page.getByText(ORDER_NUMBER).first().click()
  await page.getByTestId('accept-order').waitFor({ timeout: 120000 })
  await shot(page, '05-zamowienie-nowe')
  const orderUrl = page.url()

  // 5. Przyjęcie → rozbicie na działy
  await page.getByTestId('accept-order').click()
  // Natywny <dialog> — rola ARIA bywa niewidoczna dla getByRole, więc po selektorze.
  const dialog = page.locator('dialog[open]')
  await dialog.waitFor()
  await shot(page, '06-przyjecie-potwierdzenie')
  await dialog.getByRole('button', { name: /Potwierdź|Confirm/ }).click()
  await page.getByTestId('department-cards').waitFor({ timeout: 60000 })
  await shot(page, '07-rozbite-na-dzialy')

  // 6. Moment wow: dwa okna działów, zamówienie w trzecim
  const departmentLink = async (name) =>
    page.locator(`[data-testid="department-card"][data-department="${name}"] a`).getAttribute('href')
  const joineryHref = await departmentLink('Stolarnia')
  const upholsteryHref = await departmentLink('Tapicernia')
  const joinery = await context.newPage()
  await joinery.goto(BASE + joineryHref, { timeout: 180000 })
  await joinery.locator(`[data-testid="task-card"][data-order="${ORDER_NUMBER}"]`).first().waitFor({ timeout: 120000 })
  await shot(joinery, '08-tablica-stolarnia')
  const upholstery = await context.newPage()
  await upholstery.goto(BASE + upholsteryHref, { timeout: 180000 })
  await upholstery.locator(`[data-testid="task-card"][data-order="${ORDER_NUMBER}"]`).first().waitFor({ timeout: 120000 })

  // Stolarnia: ławki częściowo (+1, potem wpisane 3), stół całością
  const bench = joinery.locator(`[data-testid="task-card"][data-order="${ORDER_NUMBER}"][data-product="Ławka ogrodowa z oparciem 150 cm"]`)
  await bench.getByTestId('report-one').click()
  await joinery.waitForTimeout(600)
  await shot(joinery, '09-stolarnia-czesciowo')
  await bench.locator('input').fill('3')
  await bench.getByRole('button', { name: /Odhacz/ }).click()
  await joinery.waitForTimeout(600)
  await reportAll(joinery, 'Stół ogrodowy 120×80')
  await reportAll(upholstery, 'Ławka ogrodowa z oparciem 150 cm')
  await shot(upholstery, '10-tapicernia-zrobione')

  // Zamówienie odświeża się samo — bez przeładowania strony
  await page.bringToFront()
  await page.getByTestId('order-progress').filter({ hasText: /2 z 4|2 of 4/ }).waitFor({ timeout: 15000 })
  await shot(page, '11-zamowienie-2-z-4')

  // 7. Lakiernia i pakowanie → gotowe do wysyłki
  const paintHref = await departmentLink('Lakiernia')
  const packingHref = await departmentLink('Pakowanie')
  await joinery.goto(BASE + paintHref)
  await joinery.locator(`[data-testid="task-card"][data-order="${ORDER_NUMBER}"]`).first().waitFor({ timeout: 120000 })
  await reportAll(joinery, 'Ławka ogrodowa z oparciem 150 cm')
  await reportAll(joinery, 'Stół ogrodowy 120×80')
  await upholstery.goto(BASE + packingHref)
  await upholstery.locator(`[data-testid="task-card"][data-order="${ORDER_NUMBER}"]`).first().waitFor({ timeout: 120000 })
  await reportAll(upholstery, 'Ławka ogrodowa z oparciem 150 cm')
  await reportAll(upholstery, 'Stół ogrodowy 120×80')
  await shot(upholstery, '12-pakowanie-zamowienie-gotowe')
  await page.bringToFront()
  await page.getByText(/Gotowe do wysyłki/).first().waitFor({ timeout: 15000 })
  await shot(page, '13-gotowe-do-wysylki')

  // 8. Lista po wszystkim
  await page.goto(BASE + '/backend/department-routing/orders')
  await page.locator('tr', { hasText: ORDER_NUMBER }).getByText(/Gotowe do wysyłki/).waitFor({ timeout: 120000 })
  await shot(page, '14-lista-po')

  console.log(failures.length ? 'BŁĘDY STRONY:\n' + failures.join('\n') : 'bez błędów strony', '| zamówienie:', orderUrl)
  await browser.close()
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
