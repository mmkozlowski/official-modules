import { updateModelSchema, updateOfferSchema, updateLineSchema } from '../data/validators'

/**
 * zod applies `.default()` inside `.partial()`. An update schema that inherits
 * defaults turns "change one field" into "reset every other field" — this is
 * how a "take cost from BOM" click once zeroed a model's margin. Each update
 * schema must return ONLY the keys that were sent.
 */
describe('partial updates send only what changed', () => {
  const id = '6f1c2a8e-4b1d-4c6e-9a51-2f7d3b0c9e11'

  it('model: refreshing the BOM cost does not touch margin, fabric or currency', () => {
    const parsed = updateModelSchema.parse({ id, bomMaterialCost: 82.1, bomCostRefreshed: true })
    expect(Object.keys(parsed).sort()).toEqual(['bomCostRefreshed', 'bomMaterialCost', 'id'])
  })

  it('model: bulk activate sends only isActive', () => {
    expect(Object.keys(updateModelSchema.parse({ id, isActive: false })).sort()).toEqual(['id', 'isActive'])
  })

  it('offer and line updates carry no defaults either', () => {
    expect(Object.keys(updateOfferSchema.parse({ id, title: 'x' })).sort()).toEqual(['id', 'title'])
    expect(Object.keys(updateLineSchema.parse({ quantity: 3 }))).toEqual(['quantity'])
  })
})
