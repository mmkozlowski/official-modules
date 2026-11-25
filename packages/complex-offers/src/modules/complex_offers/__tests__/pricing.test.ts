import { computeVersionTotals, normalizeSelection, priceDelta, priceLine, resolveQuantityDiscount, type PricingModel } from '../lib/pricing'
import { DEMO_MODELS } from '../lib/demo-seed'

function demoModel(key: string): PricingModel {
  const seed = DEMO_MODELS.find((model) => model.key === key)!
  return {
    basePrice: seed.basePrice,
    bomMaterialCost: seed.bomMaterialCost,
    fabricConsumption: seed.fabricConsumption,
    marginPercent: seed.marginPercent,
    quantityDiscounts: seed.quantityDiscounts,
    currencyCode: 'PLN',
    options: seed.options.map((option) => ({
      id: option.key,
      kind: option.kind,
      label: option.label,
      surcharge: option.surcharge ?? '0',
      sizeFactor: option.sizeFactor ?? '1',
      fabricPricePerMeter: option.fabricPricePerMeter ?? '0',
      isDefault: option.isDefault,
    })),
  }
}

const amounts = (result: ReturnType<typeof priceLine>) =>
  Object.fromEntries(result.steps.filter((step) => step.code !== 'addon').map((step) => [step.code, step.amount]))

describe('priceLine — the recording example', () => {
  const bench = demoModel('bench')
  const selection = { sizeOptionId: 'size150', fabricOptionId: 'fabricGrey', colorOptionId: 'pipingSame', addonOptionIds: ['ties'] }

  it('prices 24 bench cushions 150×60 in grey fabric step by step', () => {
    const result = priceLine(bench, selection, 24)
    expect(amounts(result)).toEqual({
      base: '55.00',
      size: '10.00',
      materials: '102.63',
      fabric: '69.78',
      color: '0.00',
      subtotal: '243.41',
      margin: '85.19',
      list_price: '328.60',
      quantity_discount: '-9.86',
      unit_price: '318.74',
      line_total: '7649.76',
    })
    expect(result.discountPercent).toBe(3)
  })

  it('re-prices when only the fabric changes — the striped fabric costs more', () => {
    const before = priceLine(bench, selection, 24)
    const after = priceLine(bench, { ...selection, fabricOptionId: 'fabricStripe' }, 24)
    expect(after.steps.find((step) => step.code === 'fabric')?.amount).toBe('83.38')
    expect(after.unitPrice).toBe('336.55')
    expect(after.lineTotal).toBe('8077.20')
    expect(priceDelta(before.lineTotal, after.lineTotal)).toBe('427.44')
  })

  it('the steps add up exactly to every running total', () => {
    const result = priceLine(bench, { ...selection, addonOptionIds: ['ties', 'quickDry', 'impregnation'] }, 51)
    const cents = (value: string) => Math.round(Number(value) * 100)
    let running = 0
    for (const step of result.steps) {
      if (step.code === 'line_total') {
        expect(cents(step.amount)).toBe(running * 51)
        continue
      }
      if (step.isTotal) expect(cents(step.amount)).toBe(running)
      else running += cents(step.amount)
    }
  })
})

describe('quantity discounts', () => {
  const tiers = [
    { minQuantity: 50, percent: 8 },
    { minQuantity: 10, percent: 3 },
    { minQuantity: 25, percent: 5 },
  ]
  it('picks the highest tier the quantity reaches, whatever the order', () => {
    expect(resolveQuantityDiscount(tiers, 9)).toBeNull()
    expect(resolveQuantityDiscount(tiers, 10)?.percent).toBe(3)
    expect(resolveQuantityDiscount(tiers, 49)?.percent).toBe(5)
    expect(resolveQuantityDiscount(tiers, 50)?.percent).toBe(8)
  })
  it('adds no discount step below the first tier', () => {
    const result = priceLine(demoModel('bench'), {}, 1)
    expect(result.steps.some((step) => step.code === 'quantity_discount')).toBe(false)
    expect(result.unitPrice).toBe(result.listUnitPrice)
  })
})

describe('selection', () => {
  it('fills defaults for every single-choice parameter and drops unknown add-ons', () => {
    const normalized = normalizeSelection(demoModel('bench'), { addonOptionIds: ['ties', 'nope', 'ties'] })
    expect(normalized).toEqual({
      sizeOptionId: 'size120',
      fabricOptionId: 'fabricGrey',
      colorOptionId: 'pipingSame',
      addonOptionIds: ['ties'],
    })
  })
  it('a model without fabric has no fabric step', () => {
    const result = priceLine(demoModel('table'), { sizeOptionId: 'size160' }, 6)
    expect(result.steps.some((step) => step.code === 'fabric')).toBe(false)
    expect(result.selected.map((parameter) => parameter.kind)).toEqual(['size', 'color'])
  })
})

describe('version totals', () => {
  it('adds VAT 23% on the net total', () => {
    expect(computeVersionTotals(['100.00', '23.45'])).toEqual({ totalNet: '123.45', vatAmount: '28.39', totalGross: '151.84' })
  })
})
