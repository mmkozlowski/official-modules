import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import pl from '../i18n/pl.json'
import en from '../i18n/en.json'

/**
 * The recording runs in Polish. A key used in code but missing from pl.json
 * silently renders its English fallback on screen — compilers and other tests
 * do not see that. This scan ties every literal key in the source to both files.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === '__tests__' || name === 'i18n' || name === 'migrations') return []
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

const KEY_PATTERN = /['"`](complex_offers\.(?:[a-zA-Z]+\.)+[a-zA-Z]+)['"`]/g
const NOT_I18N = new Set(['complex_offers.view', 'complex_offers.create', 'complex_offers.edit', 'complex_offers.delete', 'complex_offers.manage_pricing', 'complex_offers.offers', 'complex_offers.models'])

describe('i18n', () => {
  const root = join(__dirname, '..')
  const used = new Set<string>()
  for (const file of sourceFiles(root)) {
    for (const match of readFileSync(file, 'utf8').matchAll(KEY_PATTERN)) {
      const key = match[1]
      if (NOT_I18N.has(key) || /\.(offer|model|version|line)\.[a-z_]+$/.test(key) && key.split('.').length === 3) continue
      used.add(key)
    }
  }

  it('finds the keys it is guarding', () => {
    expect(used.size).toBeGreaterThan(100)
  })
  it.each([...used].sort())('%s is translated in pl and en', (key) => {
    expect((pl as Record<string, string>)[key]).toBeTruthy()
    expect((en as Record<string, string>)[key]).toBeTruthy()
  })
  it('pl and en have the same keys', () => {
    expect(Object.keys(pl).sort()).toEqual(Object.keys(en).sort())
  })
})
