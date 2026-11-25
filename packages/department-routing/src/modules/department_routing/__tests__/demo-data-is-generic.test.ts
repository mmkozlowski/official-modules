import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The example data is shown on screen (demos, recordings). It must stay generic:
 * no client, supplier or brand names, no people. This guard fails when one of a
 * known list of real names slips into the seed or the locale files.
 *
 * The list is stored as SHA-256 digests of lower-cased words, so the guard does
 * not itself publish the names it keeps out.
 */
const FORBIDDEN_WORD_DIGESTS = new Set([
  'b99711bc3cffdd00dd8ff43c062fdfe0ecc0d0819cb8e4ad89b21c95f878721b',
  '5383f32aca8d6c3fd47ed0332d0c85683f83208e6484e0e0cb177271748ecbf5',
  'a32d5d52acc0a53ad05d93d02ebbf4f664eafa68515e0821f3c59250df283352',
  '40a546eefc0592935b94392b95444b5ef8c1358c45fc4d96f072809345ad442d',
  '6664342e690b3028ef3df703da2c31837b38e51c09218420473c08c77cc1bc93',
  'c7d91f888fe9c2d434661f5b4c1a0830149222ff1691477e00d0170f37b70abe',
  '15ca7c08d604be43364be5a39513195d4862cd16852c5d0361e8bad4126b858d',
])

const FILES = ['../lib/demo-seed.ts', '../i18n/pl.json', '../i18n/en.json', '../../../../../../docs/recording/department-routing/plan-nagrania.md', '../../../../../../docs/recording/department-routing/odcinek.md']

function digest(word: string): string {
  return createHash('sha256').update(word).digest('hex')
}

describe('demo data is generic', () => {
  it.each(FILES)('%s carries no client, supplier or brand names', (file) => {
    const words = readFileSync(join(__dirname, file), 'utf8').toLowerCase().match(/[\p{L}]+/gu) ?? []
    const hits = words.filter((word) => FORBIDDEN_WORD_DIGESTS.has(digest(word)))
    expect(hits).toEqual([])
  })

  it('the guard recognises a listed word', () => {
    expect(FORBIDDEN_WORD_DIGESTS.size).toBeGreaterThan(0)
  })
})
