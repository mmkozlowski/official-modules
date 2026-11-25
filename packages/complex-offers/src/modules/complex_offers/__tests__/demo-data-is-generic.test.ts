import { DEMO_MODELS, DEMO_OFFERS } from '../lib/demo-seed'

/**
 * The demo is recorded and published. It must not carry the name of any real
 * client the team works with — this list is the guard, not the honour system.
 */
const FORBIDDEN = ['frida', 'rezon', 'natura', 'doram', 'openkraft', 'kref', 'flowbiz', 'acme']

describe('demo data', () => {
  const text = JSON.stringify({ DEMO_MODELS, DEMO_OFFERS }).toLowerCase()
  it.each(FORBIDDEN)('does not mention %s', (name) => {
    expect(text).not.toContain(name)
  })
  it('names no people — contacts are roles, not persons', () => {
    for (const offer of DEMO_OFFERS) {
      if (offer.contactPerson) expect(offer.contactPerson).toMatch(/^(Dział|Kierownik|Recepcja)/)
    }
  })
})
