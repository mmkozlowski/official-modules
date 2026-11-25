/**
 * Pricing engine for a configurable furniture model — pure functions, no I/O.
 *
 * The same code runs on the server (source of truth, when a line is saved) and
 * in the browser (the "where does this price come from" panel), so the number
 * on screen and the number in the database are produced by one formula.
 *
 * Per ONE unit:
 *
 *   base price of the model (labour and overhead)
 * + size surcharge
 * + material cost from the BOM          × size factor
 * + fabric: consumption × size factor   × fabric price per metre
 * + colour surcharge
 * + Σ add-on surcharges
 * = cost and surcharges
 * + margin %                             → list price per unit
 * − quantity discount % (best tier whose minimum the quantity reaches)
 * = unit price;  × quantity = line total
 *
 * Every step is rounded to whole grosze BEFORE it is added, so the steps shown
 * in the breakdown always add up to the total shown under them — a breakdown
 * that is off by a grosz is the first thing a customer asks about.
 */

export const PARAMETER_KINDS = ['size', 'fabric', 'color', 'addon'] as const
export type ParameterKind = (typeof PARAMETER_KINDS)[number]

/** Kinds where exactly one option is picked. Add-ons are any number. */
export const SINGLE_CHOICE_KINDS: ParameterKind[] = ['size', 'fabric', 'color']

export type PricingOption = {
  id: string
  kind: ParameterKind
  label: string
  /** Fixed amount per unit, may be 0. */
  surcharge: string
  /** Size only: how much more material a size uses than the base size (1 = base). */
  sizeFactor: string
  /** Fabric only: price of one metre. */
  fabricPricePerMeter: string
  isDefault?: boolean
}

export type QuantityDiscount = { minQuantity: number; percent: number }

export type PricingModel = {
  basePrice: string
  bomMaterialCost: string
  /** Metres of fabric one unit of the BASE size uses. */
  fabricConsumption: string
  marginPercent: string
  quantityDiscounts: QuantityDiscount[]
  currencyCode: string
  options: PricingOption[]
}

export type LineSelection = {
  sizeOptionId?: string | null
  fabricOptionId?: string | null
  colorOptionId?: string | null
  addonOptionIds?: string[]
}

export type BreakdownStepCode =
  | 'base'
  | 'size'
  | 'materials'
  | 'fabric'
  | 'color'
  | 'addon'
  | 'subtotal'
  | 'margin'
  | 'list_price'
  | 'quantity_discount'
  | 'unit_price'
  | 'line_total'

export type BreakdownStep = {
  code: BreakdownStepCode
  /** The option's own label (user data, not translated), when the step comes from an option. */
  label: string | null
  /** Numbers the UI puts into the step's description: factor, metres, percent… */
  params: Record<string, string | number>
  /** Signed amount as a decimal string with 2 places. Totals carry the running value. */
  amount: string
  /** True for running totals (subtotal, list price, unit price, line total). */
  isTotal: boolean
}

export type SelectedParameter = { kind: ParameterKind; optionId: string; label: string }

export type LinePricing = {
  steps: BreakdownStep[]
  selected: SelectedParameter[]
  listUnitPrice: string
  discountPercent: number
  unitPrice: string
  lineTotal: string
  currencyCode: string
}

export const VAT_PERCENT = 23

function toCents(value: string | number): number {
  const amount = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0
}

function toNumber(value: string | number): number {
  const amount = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  return Number.isFinite(amount) ? amount : 0
}

export function centsToString(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(Math.round(cents))
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

/** Rounds `value` to `digits` decimals and drops trailing zeros: 1.8125 → "1.81". */
function trimDecimal(value: number, digits: number): string {
  return String(Number(value.toFixed(digits)))
}

/** The best tier the quantity reaches — tiers may come in any order. */
export function resolveQuantityDiscount(tiers: QuantityDiscount[], quantity: number): QuantityDiscount | null {
  let best: QuantityDiscount | null = null
  for (const tier of tiers) {
    if (quantity >= tier.minQuantity && tier.percent > 0 && (!best || tier.minQuantity > best.minQuantity)) best = tier
  }
  return best
}

/**
 * The option actually used for a single-choice kind: the picked one when it
 * belongs to the model, else the model's default, else the first. A model with
 * no options of that kind simply has no such parameter.
 */
export function resolveSingleOption(
  options: PricingOption[],
  kind: ParameterKind,
  pickedId: string | null | undefined,
): PricingOption | null {
  const ofKind = options.filter((option) => option.kind === kind)
  if (!ofKind.length) return null
  return (
    ofKind.find((option) => option.id === pickedId) ??
    ofKind.find((option) => option.isDefault) ??
    ofKind[0]
  )
}

/** A selection with every single-choice kind filled in, so a new line is priceable at once. */
export function normalizeSelection(model: Pick<PricingModel, 'options'>, selection: LineSelection = {}): Required<LineSelection> {
  const addonIds = new Set(model.options.filter((option) => option.kind === 'addon').map((option) => option.id))
  return {
    sizeOptionId: resolveSingleOption(model.options, 'size', selection.sizeOptionId)?.id ?? null,
    fabricOptionId: resolveSingleOption(model.options, 'fabric', selection.fabricOptionId)?.id ?? null,
    colorOptionId: resolveSingleOption(model.options, 'color', selection.colorOptionId)?.id ?? null,
    addonOptionIds: Array.from(new Set((selection.addonOptionIds ?? []).filter((id) => addonIds.has(id)))),
  }
}

export function priceLine(model: PricingModel, rawSelection: LineSelection, quantity: number): LinePricing {
  const selection = normalizeSelection(model, rawSelection)
  const size = resolveSingleOption(model.options, 'size', selection.sizeOptionId)
  const fabric = resolveSingleOption(model.options, 'fabric', selection.fabricOptionId)
  const color = resolveSingleOption(model.options, 'color', selection.colorOptionId)
  const addons = model.options.filter((option) => option.kind === 'addon' && selection.addonOptionIds.includes(option.id))
  const factor = size ? toNumber(size.sizeFactor) || 1 : 1
  const units = Math.max(1, Math.trunc(quantity))

  const steps: BreakdownStep[] = []
  let running = 0
  const add = (code: BreakdownStepCode, cents: number, label: string | null, params: BreakdownStep['params'] = {}) => {
    running += cents
    steps.push({ code, label, params, amount: centsToString(cents), isTotal: false })
  }
  const total = (code: BreakdownStepCode, cents: number, params: BreakdownStep['params'] = {}) => {
    steps.push({ code, label: null, params, amount: centsToString(cents), isTotal: true })
  }

  add('base', toCents(model.basePrice), null)
  if (size) add('size', toCents(size.surcharge), size.label, { factor: trimDecimal(factor, 3) })
  const bomCost = toNumber(model.bomMaterialCost)
  if (bomCost > 0) {
    add('materials', Math.round(toCents(bomCost) * factor), null, {
      bomCost: centsToString(toCents(bomCost)),
      factor: trimDecimal(factor, 3),
    })
  }
  if (fabric) {
    const meters = toNumber(model.fabricConsumption) * factor
    // Price in grosze × metres: multiplying cents keeps x.5 cases exact (1.8125 m × 4600 gr = 8337.5 → 8338).
    add('fabric', Math.round(meters * toCents(fabric.fabricPricePerMeter)), fabric.label, {
      meters: trimDecimal(meters, 3),
      pricePerMeter: centsToString(toCents(fabric.fabricPricePerMeter)),
    })
  }
  if (color) add('color', toCents(color.surcharge), color.label)
  for (const addon of addons) add('addon', toCents(addon.surcharge), addon.label)

  const subtotal = running
  total('subtotal', subtotal)

  const marginPercent = toNumber(model.marginPercent)
  const marginCents = Math.round((subtotal * marginPercent) / 100)
  steps.push({ code: 'margin', label: null, params: { percent: trimDecimal(marginPercent, 2) }, amount: centsToString(marginCents), isTotal: false })
  const listUnit = subtotal + marginCents
  total('list_price', listUnit)

  const tier = resolveQuantityDiscount(model.quantityDiscounts, units)
  const discountPercent = tier?.percent ?? 0
  const discountCents = Math.round((listUnit * discountPercent) / 100)
  if (tier) {
    steps.push({
      code: 'quantity_discount',
      label: null,
      params: { percent: trimDecimal(discountPercent, 2), minQuantity: tier.minQuantity },
      amount: centsToString(-discountCents),
      isTotal: false,
    })
  }
  const unitCents = listUnit - discountCents
  total('unit_price', unitCents)
  const lineCents = unitCents * units
  total('line_total', lineCents, { quantity: units })

  const selected: SelectedParameter[] = []
  if (size) selected.push({ kind: 'size', optionId: size.id, label: size.label })
  if (fabric) selected.push({ kind: 'fabric', optionId: fabric.id, label: fabric.label })
  if (color) selected.push({ kind: 'color', optionId: color.id, label: color.label })
  for (const addon of addons) selected.push({ kind: 'addon', optionId: addon.id, label: addon.label })

  return {
    steps,
    selected,
    listUnitPrice: centsToString(listUnit),
    discountPercent,
    unitPrice: centsToString(unitCents),
    lineTotal: centsToString(lineCents),
    currencyCode: model.currencyCode || 'PLN',
  }
}

export type VersionTotals = { totalNet: string; vatAmount: string; totalGross: string }

export function computeVersionTotals(lineTotals: string[]): VersionTotals {
  const net = lineTotals.reduce((sum, value) => sum + toCents(value), 0)
  const vat = Math.round((net * VAT_PERCENT) / 100)
  return { totalNet: centsToString(net), vatAmount: centsToString(vat), totalGross: centsToString(net + vat) }
}

/** Signed difference `after − before`, for the "+75,40 zł" chip after a parameter change. */
export function priceDelta(before: string, after: string): string {
  return centsToString(toCents(after) - toCents(before))
}
