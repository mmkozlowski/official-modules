import {
  computeLineCost,
  computeMaterialCost,
  computeRequirements,
  formatQuantity,
  planProductDuplicate,
  quantityFromSegments,
  toScaled,
} from '../lib/bom-calculations'

const FABRIC = '00000000-0000-4000-8000-000000000001'
const FOAM = '00000000-0000-4000-8000-000000000002'
const ZIPPER = '00000000-0000-4000-8000-000000000003'
const THREAD = '00000000-0000-4000-8000-000000000004'

// A 45×45 garden chair cushion: fabric by the metre, foam by the piece, a zipper, thread by the kg.
const cushionBom = [
  { materialId: FABRIC, quantity: '0.45', unitPrice: '38.50' },
  { materialId: FOAM, quantity: '1', unitPrice: '24.90' },
  { materialId: ZIPPER, quantity: '1', unitPrice: '1.85' },
  { materialId: THREAD, quantity: '0.004', unitPrice: '89.00' },
]

describe('decimal parsing', () => {
  it('scales decimals without float error', () => {
    expect(toScaled('0.45', 6)).toBe(BigInt(450000))
    expect(toScaled(0.1, 6)).toBe(BigInt(100000))
    expect(toScaled('12', 4)).toBe(BigInt(120000))
  })

  it('rounds digits beyond the scale half-up', () => {
    expect(toScaled('0.0000005', 6)).toBe(BigInt(1))
    expect(toScaled('0.0000004', 6)).toBe(BigInt(0))
  })

  it('rejects text that is not a number', () => {
    expect(() => toScaled('abc', 6)).toThrow('Not a decimal number')
    expect(() => toScaled('1,5', 6)).toThrow('Not a decimal number')
  })

  it('formats quantities without trailing zeros', () => {
    expect(formatQuantity(BigInt(90_000_000))).toBe('90')
    expect(formatQuantity(BigInt(450_000))).toBe('0.45')
    expect(formatQuantity(BigInt(4_000))).toBe('0.004')
  })
})

describe('material cost', () => {
  it('costs one line as quantity × unit price, rounded to 2 decimals', () => {
    expect(computeLineCost({ quantity: '0.45', unitPrice: '38.50' })).toBe('17.33')
    expect(computeLineCost({ quantity: '0.004', unitPrice: '89.00' })).toBe('0.36')
  })

  it('sums Σ quantity × price for one unit of the product', () => {
    // 17.325 + 24.90 + 1.85 + 0.356 = 44.431
    expect(computeMaterialCost(cushionBom)).toBe('44.43')
  })

  it('rounds the exact sum once rather than adding rounded lines', () => {
    const lines = [
      { quantity: '1', unitPrice: '0.005' },
      { quantity: '1', unitPrice: '0.005' },
    ]
    expect(lines.map(computeLineCost)).toEqual(['0.01', '0.01'])
    expect(computeMaterialCost(lines)).toBe('0.01')
  })

  it('is zero for an empty BOM', () => {
    expect(computeMaterialCost([])).toBe('0.00')
  })
})

describe('requirements for N units', () => {
  it('multiplies every material by the number of units', () => {
    const result = computeRequirements(cushionBom, 200, 18)
    expect(result.rows.map((row) => [row.materialId, row.requiredQuantity])).toEqual([
      [FABRIC, '90'],
      [FOAM, '200'],
      [ZIPPER, '200'],
      [THREAD, '0.8'],
    ])
    expect(result.materialCost).toBe('8886.20')
    expect(result.laborMinutes).toBe(3600)
  })

  it('gives exactly the per-unit cost × N, with no float drift', () => {
    const result = computeRequirements([{ materialId: FABRIC, quantity: '0.1', unitPrice: '0.3' }], 3)
    expect(result.rows[0].requiredQuantity).toBe('0.3')
    expect(result.materialCost).toBe('0.09')
  })

  it('merges a material that appears on several lines into one row', () => {
    const result = computeRequirements(
      [
        { materialId: FABRIC, quantity: '0.40', unitPrice: '38.50' },
        { materialId: FOAM, quantity: '1', unitPrice: '24.90' },
        { materialId: FABRIC, quantity: '0.05', unitPrice: '38.50' },
      ],
      10,
    )
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({ materialId: FABRIC, quantityPerUnit: '0.45', requiredQuantity: '4.5' })
  })

  it('keeps six-decimal quantities intact at scale', () => {
    const result = computeRequirements([{ materialId: THREAD, quantity: '0.000125', unitPrice: '89' }], 1000)
    expect(result.rows[0].requiredQuantity).toBe('0.125')
  })

  it('returns nothing to issue for zero units', () => {
    const result = computeRequirements(cushionBom, 0, 18)
    expect(result.materialCost).toBe('0.00')
    expect(result.laborMinutes).toBe(0)
  })

  it('refuses a fractional or negative number of units', () => {
    expect(() => computeRequirements(cushionBom, 1.5)).toThrow('non-negative integer')
    expect(() => computeRequirements(cushionBom, -1)).toThrow('non-negative integer')
  })
})

describe('product duplication', () => {
  const sourceId = '11111111-1111-4111-8111-111111111111'
  const source = {
    productType: 'cushion',
    laborMinutes: 18,
    fabricConsumption: '0.450000',
    description: 'Seat cushion with a zipped cover',
    catalogProductId: '22222222-2222-4222-8222-222222222222',
  }
  const lines = [
    { materialId: FOAM, quantity: '1.000000', position: 1, notes: null },
    { materialId: FABRIC, quantity: '0.450000', position: 0, notes: 'cut along the grain' },
  ]

  it('copies the fields and every BOM line, keeping the order', () => {
    const plan = planProductDuplicate(sourceId, source, lines, { name: 'Cushion 50×50' })
    expect(plan.product).toMatchObject({
      name: 'Cushion 50×50',
      productType: 'cushion',
      laborMinutes: 18,
      fabricConsumption: '0.450000',
      description: 'Seat cushion with a zipped cover',
      sourceProductId: sourceId,
    })
    expect(plan.lines).toEqual([
      { materialId: FABRIC, quantity: '0.450000', segmentCount: null, segmentLength: null, position: 0, notes: 'cut along the grain' },
      { materialId: FOAM, quantity: '1.000000', segmentCount: null, segmentLength: null, position: 1, notes: null },
    ])
  })

  it('keeps the quantities AND the split into pieces of every line', () => {
    const plan = planProductDuplicate(sourceId, source, [
      { materialId: ZIPPER, quantity: '4.200000', segmentCount: 3, segmentLength: '1.400000', position: 0 },
      { materialId: THREAD, quantity: '0.004000', position: 1 },
    ], { name: 'Copy' })
    expect(plan.lines[0]).toMatchObject({ quantity: '4.200000', segmentCount: 3, segmentLength: '1.400000' })
    expect(plan.lines[1]).toMatchObject({ quantity: '0.004000', segmentCount: null, segmentLength: null })
    expect(plan.product.fabricConsumption).toBe('0.450000')
  })

  it('does not copy the code or the catalog link', () => {
    const plan = planProductDuplicate(sourceId, source, lines, { name: 'Copy' })
    expect(plan.product.code).toBeNull()
    expect(plan.product.catalogProductId).toBeNull()
    expect(planProductDuplicate(sourceId, source, lines, { name: 'Copy', code: 'CU-50' }).product.code).toBe('CU-50')
  })

  it('produces an independent copy — editing the source lines afterwards changes nothing', () => {
    const mutableLines = lines.map((line) => ({ ...line }))
    const plan = planProductDuplicate(sourceId, source, mutableLines, { name: 'Copy' })
    mutableLines[0].quantity = '9.000000'
    mutableLines.push({ materialId: ZIPPER, quantity: '1', position: 2, notes: null })
    expect(plan.lines).toHaveLength(2)
    expect(plan.lines.map((line) => line.quantity)).toEqual(['0.450000', '1.000000'])
  })

  it('carries the same material cost as the source', () => {
    const prices: Record<string, string> = { [FABRIC]: '38.50', [FOAM]: '24.90' }
    const costOf = (items: ReadonlyArray<{ materialId: string; quantity: string }>) =>
      computeMaterialCost(items.map((item) => ({ quantity: item.quantity, unitPrice: prices[item.materialId] })))
    const plan = planProductDuplicate(sourceId, source, lines, { name: 'Copy' })
    expect(costOf(plan.lines)).toBe(costOf(lines))
  })
})

describe('pieces, allowance and fabric', () => {
  it('derives the quantity from pieces: 3 × 1.40 m = 4.2 m', () => {
    expect(quantityFromSegments(3, '1.40')).toBe('4.2')
    expect(quantityFromSegments(4, 0.5)).toBe('2')
    expect(() => quantityFromSegments(0, '1')).toThrow('positive integer')
  })

  it('turns split lines into a cut list for N units', () => {
    const result = computeRequirements(
      [
        { materialId: ZIPPER, quantity: '0', segmentCount: 3, segmentLength: '1.40', unitPrice: '2.10' },
        { materialId: THREAD, quantity: '0', segmentCount: 4, segmentLength: '0.5', unitPrice: '0.80' },
      ],
      10,
    )
    expect(result.rows[0]).toMatchObject({ requiredQuantity: '42', pieces: [{ count: 30, length: '1.4' }] })
    expect(result.rows[1]).toMatchObject({ requiredQuantity: '20', pieces: [{ count: 40, length: '0.5' }] })
  })

  it('keeps the product cost on the norm and puts the allowance on what is issued', () => {
    const result = computeRequirements(
      [{ materialId: FOAM, quantity: '1', unitPrice: '24.90', wastePercent: '10' }],
      200,
    )
    expect(result.rows[0]).toMatchObject({ normQuantity: '200', wastePercent: '10', requiredQuantity: '220' })
    expect(result.normMaterialCost).toBe('4980.00')
    expect(result.materialCost).toBe('5478.00')
  })

  it('reports the order fabric separately and never adds it to the material cost', () => {
    const result = computeRequirements(cushionBom.filter((line) => line.materialId !== FABRIC), 200, 18, {
      choice: { materialId: FABRIC, unitPrice: '38.50', wastePercent: '10' },
      consumptionPerUnit: '0.45',
    })
    expect(result.fabric).toMatchObject({ materialId: FABRIC, normQuantity: '90', requiredQuantity: '99', cost: '3811.50' })
    expect(result.rows.some((row) => row.materialId === FABRIC)).toBe(false)
    // 24.90 + 1.85 + 0.356 = 27.106 per unit → 5421.20 for 200
    expect(result.materialCost).toBe('5421.20')
  })
})
