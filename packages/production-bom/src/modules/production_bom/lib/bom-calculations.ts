/**
 * BOM arithmetic — material cost of one product and the material requirement
 * for N units.
 *
 * Everything runs on scaled integers (BigInt), never on floats. `0.45 × 200` in
 * floating point is `90.00000000000001`, and a requirement list that tells the
 * warehouse to cut 90.00000000000001 metres of fabric is wrong in a way every
 * viewer notices. Quantities carry 6 decimals (the `numeric(13,6)` column),
 * prices 4 (`numeric(14,4)`), money is rounded half-up to 2 at the very end.
 *
 * Pure functions with no ORM or framework imports, so the API routes and the UI
 * compute the same numbers from the same code.
 */

export const QUANTITY_SCALE = 6
export const PRICE_SCALE = 4
export const MONEY_SCALE = 2

export type DecimalInput = string | number

export type CostedBomLine = {
  materialId: string
  quantity: DecimalInput
  unitPrice: DecimalInput
  /** Allowance on top of the norm, in percent. Applied to requirements only, never to the product cost. */
  wastePercent?: DecimalInput | null
  segmentCount?: number | null
  segmentLength?: DecimalInput | null
}

export type RequirementPieces = {
  /** Pieces to cut for N units. */
  count: number
  /** Length of one piece, in the material's unit. */
  length: string
}

export type RequirementRow = {
  materialId: string
  /** Norm for ONE unit (summed when a material appears on several lines). */
  quantityPerUnit: string
  /** `quantityPerUnit × units` — the norm, without allowance. */
  normQuantity: string
  wastePercent: string
  /** What to issue: `normQuantity × (1 + wastePercent / 100)`. */
  requiredQuantity: string
  unitPrice: string
  /** `requiredQuantity × unitPrice`, rounded to 2 decimals. */
  cost: string
  /** Pieces to cut, per piece length, when the BOM line is split. Empty otherwise. */
  pieces: RequirementPieces[]
}

export type FabricChoice = {
  materialId: string
  unitPrice: DecimalInput
  wastePercent?: DecimalInput | null
}

export type RequirementResult = {
  units: number
  rows: RequirementRow[]
  /** Σ row cost — BOM materials as issued, allowance included. Fabric excluded. */
  materialCost: string
  /** Σ norm cost — exactly `units × product material cost`. Fabric excluded. */
  normMaterialCost: string
  /** The fabric chosen for this order, when one was. Never part of `materialCost`. */
  fabric: RequirementRow | null
  laborMinutes: number
}

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/

function pow10(exponent: number): bigint {
  return BigInt(10) ** BigInt(exponent)
}

/**
 * Parses a decimal to an integer scaled by `10^scale`. Digits beyond `scale` are
 * rounded half-up rather than truncated, so "0.0000005" at scale 6 becomes 1.
 */
export function toScaled(value: DecimalInput, scale: number): bigint {
  const text = typeof value === 'number' ? numberToPlainString(value) : String(value).trim()
  if (text.length === 0) return BigInt(0)
  if (!DECIMAL_PATTERN.test(text)) {
    throw new Error(`Not a decimal number: "${text}"`)
  }
  const negative = text.startsWith('-')
  const unsigned = negative ? text.slice(1) : text
  const [integerPart, fractionPart = ''] = unsigned.split('.')
  const kept = fractionPart.slice(0, scale).padEnd(scale, '0')
  let scaled = BigInt(integerPart + kept)
  const firstDropped = fractionPart.charAt(scale)
  if (firstDropped !== '' && Number(firstDropped) >= 5) scaled += BigInt(1)
  return negative ? -scaled : scaled
}

function numberToPlainString(value: number): string {
  if (!Number.isFinite(value)) throw new Error(`Not a finite number: ${value}`)
  // toFixed(10) avoids exponent notation (1e-7) and is well past every scale used here.
  return value.toFixed(10)
}

/** Divides a scaled integer down to `toScale` decimals, rounding half-up (away from zero). */
export function rescale(value: bigint, fromScale: number, toScale: number): bigint {
  if (toScale >= fromScale) return value * pow10(toScale - fromScale)
  const divisor = pow10(fromScale - toScale)
  const negative = value < BigInt(0)
  const magnitude = negative ? -value : value
  let quotient = magnitude / divisor
  if ((magnitude % divisor) * BigInt(2) >= divisor) quotient += BigInt(1)
  return negative ? -quotient : quotient
}

/** Renders a scaled integer as a fixed-point string with exactly `scale` decimals. */
export function formatScaled(value: bigint, scale: number): string {
  const negative = value < BigInt(0)
  const digits = (negative ? -value : value).toString().padStart(scale + 1, '0')
  const integerPart = digits.slice(0, digits.length - scale)
  const fractionPart = scale > 0 ? `.${digits.slice(digits.length - scale)}` : ''
  return `${negative ? '-' : ''}${integerPart}${fractionPart}`
}

/** Like `formatScaled`, without trailing zeros: `"90.000000"` → `"90"`, `"0.450000"` → `"0.45"`. */
export function formatQuantity(value: bigint, scale: number = QUANTITY_SCALE): string {
  const fixed = formatScaled(value, scale)
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed
}

/** Cost of one BOM line, rounded to 2 decimals: `quantity × unitPrice`. */
export function computeLineCost(line: Pick<CostedBomLine, 'quantity' | 'unitPrice'>): string {
  const exact = toScaled(line.quantity, QUANTITY_SCALE) * toScaled(line.unitPrice, PRICE_SCALE)
  return formatScaled(rescale(exact, QUANTITY_SCALE + PRICE_SCALE, MONEY_SCALE), MONEY_SCALE)
}

/**
 * Material cost of ONE unit of the product: `Σ quantity × unitPrice`.
 *
 * The sum runs on exact line costs and is rounded once, so the total is the true
 * cost to the grosz. It can differ by 0.01 from adding up the rounded per-line
 * costs shown next to it — the same convention a spreadsheet `ROUND(SUM())` uses.
 */
export function computeMaterialCost(lines: ReadonlyArray<Pick<CostedBomLine, 'quantity' | 'unitPrice'>>): string {
  let exact = BigInt(0)
  for (const line of lines) {
    exact += toScaled(line.quantity, QUANTITY_SCALE) * toScaled(line.unitPrice, PRICE_SCALE)
  }
  return formatScaled(rescale(exact, QUANTITY_SCALE + PRICE_SCALE, MONEY_SCALE), MONEY_SCALE)
}

/** `segmentCount × segmentLength`, as the stored quantity string. */
export function quantityFromSegments(segmentCount: number, segmentLength: DecimalInput): string {
  if (!Number.isInteger(segmentCount) || segmentCount < 1) {
    throw new Error(`Piece count must be a positive integer, got ${segmentCount}`)
  }
  return formatQuantity(BigInt(segmentCount) * toScaled(segmentLength, QUANTITY_SCALE))
}

const WASTE_SCALE = 2
const HUNDRED_PERCENT = BigInt(100) * pow10(WASTE_SCALE)

function applyWaste(normScaled: bigint, wasteScaled: bigint): bigint {
  const withAllowance = normScaled * (HUNDRED_PERCENT + wasteScaled)
  return rescale(withAllowance, QUANTITY_SCALE + WASTE_SCALE + 2, QUANTITY_SCALE)
}

function toMoney(exact: bigint): string {
  return formatScaled(rescale(exact, QUANTITY_SCALE + PRICE_SCALE, MONEY_SCALE), MONEY_SCALE)
}

type MaterialAccumulator = {
  quantity: bigint
  unitPrice: bigint
  waste: bigint
  pieces: Map<string, number>
}

function buildRow(materialId: string, entry: MaterialAccumulator, units: number): {
  row: RequirementRow
  normCost: bigint
  issuedCost: bigint
} {
  const norm = entry.quantity * BigInt(units)
  const required = applyWaste(norm, entry.waste)
  const issuedCost = required * entry.unitPrice
  return {
    normCost: norm * entry.unitPrice,
    issuedCost,
    row: {
      materialId,
      quantityPerUnit: formatQuantity(entry.quantity),
      normQuantity: formatQuantity(norm),
      wastePercent: formatQuantity(entry.waste, WASTE_SCALE),
      requiredQuantity: formatQuantity(required),
      unitPrice: formatScaled(entry.unitPrice, PRICE_SCALE),
      cost: toMoney(issuedCost),
      pieces: Array.from(entry.pieces, ([length, count]) => ({ count: count * units, length })),
    },
  }
}

/**
 * What it takes to make `units` pieces: per material, the norm, what to issue
 * from the warehouse (norm plus the material's allowance) and what that costs,
 * plus the total labour time.
 *
 * - The product's cost stays on the NORM (`normMaterialCost` = units × cost of
 *   one product). Only the issued quantity carries the allowance, because the
 *   offcut is a property of cutting, not of the product's specification.
 * - A material that appears on several lines is one row here, because the
 *   warehouse issues one roll. Rows keep the BOM order of first appearance.
 * - Split lines (3 × 1.40 m of zipper) add their pieces to the row, so the
 *   sewing room gets a cut list, not just a sum of metres.
 * - Fabric is never a BOM line. When an order chooses one, `fabric` carries its
 *   row, computed from the product's fabric consumption — reported next to the
 *   materials, never added into `materialCost`.
 */
export function computeRequirements(
  lines: ReadonlyArray<CostedBomLine>,
  units: number,
  laborMinutesPerUnit: number = 0,
  fabric?: { choice: FabricChoice; consumptionPerUnit: DecimalInput } | null,
): RequirementResult {
  if (!Number.isInteger(units) || units < 0) {
    throw new Error(`Units must be a non-negative integer, got ${units}`)
  }
  const byMaterial = new Map<string, MaterialAccumulator>()
  for (const line of lines) {
    const quantity =
      line.segmentCount != null && line.segmentLength != null
        ? BigInt(line.segmentCount) * toScaled(line.segmentLength, QUANTITY_SCALE)
        : toScaled(line.quantity, QUANTITY_SCALE)
    let entry = byMaterial.get(line.materialId)
    if (!entry) {
      entry = {
        quantity: BigInt(0),
        unitPrice: toScaled(line.unitPrice, PRICE_SCALE),
        waste: toScaled(line.wastePercent ?? 0, WASTE_SCALE),
        pieces: new Map(),
      }
      byMaterial.set(line.materialId, entry)
    }
    entry.quantity += quantity
    if (line.segmentCount != null && line.segmentLength != null) {
      const length = formatQuantity(toScaled(line.segmentLength, QUANTITY_SCALE))
      entry.pieces.set(length, (entry.pieces.get(length) ?? 0) + line.segmentCount)
    }
  }

  let issuedTotal = BigInt(0)
  let normTotal = BigInt(0)
  const rows: RequirementRow[] = []
  for (const [materialId, entry] of byMaterial) {
    const built = buildRow(materialId, entry, units)
    issuedTotal += built.issuedCost
    normTotal += built.normCost
    rows.push(built.row)
  }

  let fabricRow: RequirementRow | null = null
  if (fabric) {
    fabricRow = buildRow(
      fabric.choice.materialId,
      {
        quantity: toScaled(fabric.consumptionPerUnit, QUANTITY_SCALE),
        unitPrice: toScaled(fabric.choice.unitPrice, PRICE_SCALE),
        waste: toScaled(fabric.choice.wastePercent ?? 0, WASTE_SCALE),
        pieces: new Map(),
      },
      units,
    ).row
  }

  return {
    units,
    rows,
    materialCost: toMoney(issuedTotal),
    normMaterialCost: toMoney(normTotal),
    fabric: fabricRow,
    laborMinutes: Math.max(0, Math.trunc(laborMinutesPerUnit)) * units,
  }
}

export type DuplicableProduct = {
  productType: string
  laborMinutes: number
  fabricConsumption: string
  description?: string | null
  catalogProductId?: string | null
}

export type DuplicableBomLine = {
  materialId: string
  quantity: string
  segmentCount?: number | null
  segmentLength?: string | null
  position: number
  notes?: string | null
}

export type ProductDuplicatePlan = {
  product: {
    name: string
    code: string | null
    productType: string
    laborMinutes: number
    fabricConsumption: string
    description: string | null
    sourceProductId: string
    catalogProductId: null
    isActive: true
  }
  lines: Array<{
    materialId: string
    quantity: string
    segmentCount: number | null
    segmentLength: string | null
    position: number
    notes: string | null
  }>
}

/**
 * The deep copy behind "Duplicate product": a new product with the source's
 * fields and a fresh copy of every BOM line.
 *
 * Copied: type, labour time, fabric consumption, description, and every
 * line with its quantity AND its split into pieces.
 *
 * The copy is independent — it carries no line ids, so changing the original's
 * BOM afterwards never touches it. Two things are deliberately NOT copied: the
 * code (two products must not share one, so the caller supplies a new one or
 * none) and the catalog link (a copy is a new variant, not the same sellable
 * item). `sourceProductId` records where the copy came from.
 */
export function planProductDuplicate(
  sourceId: string,
  source: DuplicableProduct,
  lines: ReadonlyArray<DuplicableBomLine>,
  overrides: { name: string; code?: string | null },
): ProductDuplicatePlan {
  const ordered = [...lines].sort((a, b) => a.position - b.position)
  return {
    product: {
      name: overrides.name,
      code: overrides.code ?? null,
      productType: source.productType,
      laborMinutes: source.laborMinutes,
      fabricConsumption: source.fabricConsumption,
      description: source.description ?? null,
      sourceProductId: sourceId,
      catalogProductId: null,
      isActive: true,
    },
    lines: ordered.map((line, index) => ({
      materialId: line.materialId,
      quantity: line.quantity,
      // The split travels with the line. Losing it on copy is the failure this
      // function exists to prevent: the copy would cost the same but cut wrong.
      segmentCount: line.segmentCount ?? null,
      segmentLength: line.segmentLength ?? null,
      position: index,
      notes: line.notes ?? null,
    })),
  }
}
