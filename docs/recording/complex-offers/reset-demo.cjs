// Przywraca dane modułu „Oferty złożone” do stanu „na czysto” przed nagraniem:
// 3 modele z cennikami i 4 oferty; OF/2026/0001 ma tylko v1 (wysłaną), bez v2.
// Usuwa wszystko, co powstało na próbie (v2, nowe oferty, zmiany w cennikach).
// Nie rusza innych modułów (BOM resetuje docs/recording/reset-demo.cjs).
//
// Uruchom z katalogu repo:  node docs/recording/complex-offers/reset-demo.cjs
// Nie wymaga działającego serwera — wystarczy Postgres na :5474.
const path = require('node:path')
const fs = require('node:fs')
const { execFileSync } = require('node:child_process')

const ROOT = path.resolve(__dirname, '../../..')
const NODE24 = path.join(process.env.HOME || '', '.nvm/versions/node/v24.14.1/bin')
const env = { ...process.env }
if (fs.existsSync(NODE24)) env.PATH = `${NODE24}:${env.PATH}`

const output = execFileSync('yarn', ['mercato', 'complex_offers', 'reset-demo'], { cwd: ROOT, env, encoding: 'utf8' })
const line = output.split('\n').find((row) => row.includes('[complex_offers]'))
if (!line) {
  console.error(output)
  console.error('Reset nie zgłosił wyniku — sprawdź, czy Postgres na :5474 działa (docker start complex-offers-postgres).')
  process.exit(1)
}
console.log(line.trim())
console.log('Dane demo „Oferty złożone” przywrócone.')
