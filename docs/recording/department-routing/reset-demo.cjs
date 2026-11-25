// Przywraca dane demo modułu „zamówienie rozbijane na działy” do stanu „na czysto”:
// kasuje zamówienia, zadania, działy i produkty TEGO modułu i zakłada je od nowa
// (terminy liczone od dzisiaj). Nie rusza danych BOM ani żadnego innego modułu.
// Nie potrzebuje działającego serwera — idzie przez CLI modułu prosto do bazy (Postgres :5475).
//
// Uruchom z katalogu repo:  node docs/recording/department-routing/reset-demo.cjs
const { execFileSync } = require('node:child_process')
const { join } = require('node:path')

const repoRoot = join(__dirname, '..', '..', '..')
const nodeBin = process.env.NODE24_BIN || join(process.env.HOME, '.nvm/versions/node/v24.14.1/bin')
const env = { ...process.env, PATH: `${nodeBin}:${process.env.PATH}`, NODE_OPTIONS: '--max-old-space-size=2048' }

execFileSync('yarn', ['mercato', 'department_routing', 'reset-demo'], { cwd: repoRoot, env, stdio: 'inherit' })

// Kontrola stanu: zamówienie do nagrania ma być „nowe”, reszta jak w seedzie.
const sql =
  "select number, status, departments_done || '/' || departments_total as dzialy from department_routing_orders where deleted_at is null order by number"
execFileSync('docker', ['exec', 'department-routing-postgres', 'psql', '-U', 'postgres', '-d', 'open-mercato', '-c', sql], {
  stdio: 'inherit',
})
