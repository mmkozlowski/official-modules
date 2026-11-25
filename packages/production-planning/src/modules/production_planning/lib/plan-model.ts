/**
 * The plan as the browser and the API see it: the raw input (work centres,
 * routings, orders, BOMs) and the pure functions that turn it into a schedule,
 * a load grid and a material requirement list.
 *
 * The plan page keeps a `PlanInput` in state and recomputes everything from it
 * on every change. Moving an order's due date is a state update followed by
 * `buildPlanView` — no round trip before the screen repaints.
 *
 * Material arithmetic comes from `production_bom` (`computeRequirements`,
 * scaled BigInt decimals), not a copy: the requirement for a planned order is
 * exactly the requirement the BOM screen shows for the same quantity.
 */

import {
  QUANTITY_SCALE,
  computeRequirements,
  formatQuantity,
  toScaled,
  type CostedBomLine,
} from '@open-mercato/production-bom/modules/production_bom/lib/bom-calculations'
import {
  computePlan,
  type IsoDate,
  type PlanResult,
  type ScheduleRoutingStep,
  type ScheduledOrder,
} from './schedule'

export type PlanWorkCenter = {
  id: string
  name: string
  code: string | null
  stage: string
  dailyCapacityMinutes: number
  position: number
}

export type PlanProduct = {
  id: string
  name: string
  code: string | null
  laborMinutes: number
  fabricConsumption: string
}

export type PlanOrder = {
  id: string
  number: string
  productId: string
  quantity: number
  dueDate: IsoDate
  priority: string
  status: string
  fabricMaterialId: string | null
  reference: string | null
}

export type PlanMaterial = {
  id: string
  name: string
  code: string | null
  unit: string
  materialType: string
  unitPrice: string
  wastePercent: string
  currencyCode: string
}

export type PlanBomLine = Pick<CostedBomLine, 'materialId' | 'quantity' | 'segmentCount' | 'segmentLength'>

export type PlanInput = {
  today: IsoDate
  from: IsoDate
  days: number
  workCenters: PlanWorkCenter[]
  products: PlanProduct[]
  /** productId → routing steps in sequence order. */
  routings: Record<string, ScheduleRoutingStep[]>
  /** Orders that occupy work centres (planned and in progress). */
  orders: PlanOrder[]
  /** productId → BOM lines (one unit). */
  boms: Record<string, PlanBomLine[]>
  /** Every material a BOM line or an order's fabric points at. */
  materials: PlanMaterial[]
}

export type RequirementLine = {
  materialId: string
  name: string
  code: string | null
  unit: string
  materialType: string
  isFabric: boolean
  /** Σ norm over orders, without allowance. */
  normQuantity: string
  /** Σ to issue, allowance included. */
  requiredQuantity: string
  /** Earliest first-operation day among the orders that need it. */
  neededBy: IsoDate | null
  orderIds: string[]
}

export type PlanView = PlanResult & {
  /** Orders whose schedule touches the window, with their schedule. */
  requirements: RequirementLine[]
  /** orderId → schedule, for quick lookup on the page. */
  scheduleByOrder: Record<string, ScheduledOrder>
}

function routingMap(input: PlanInput): Map<string, ScheduleRoutingStep[]> {
  return new Map(Object.entries(input.routings))
}

/**
 * Material requirement for every order whose work falls into the window.
 * Each order is costed through the BOM module's `computeRequirements` (norm,
 * allowance, fabric chosen per order), then summed per material.
 */
export function aggregateRequirements(
  input: PlanInput,
  schedules: ReadonlyArray<ScheduledOrder>,
  windowDays: ReadonlyArray<IsoDate>,
): RequirementLine[] {
  const first = windowDays[0]
  const last = windowDays[windowDays.length - 1]
  const materials = new Map(input.materials.map((material) => [material.id, material]))
  const products = new Map(input.products.map((product) => [product.id, product]))
  const scheduleById = new Map(schedules.map((schedule) => [schedule.orderId, schedule]))
  const totals = new Map<string, { norm: bigint; required: bigint; neededBy: IsoDate | null; orderIds: Set<string> }>()

  const add = (materialId: string, norm: string, required: string, start: IsoDate | null, orderId: string) => {
    const entry = totals.get(materialId) ?? { norm: BigInt(0), required: BigInt(0), neededBy: null, orderIds: new Set() }
    entry.norm += toScaled(norm, QUANTITY_SCALE)
    entry.required += toScaled(required, QUANTITY_SCALE)
    if (start && (!entry.neededBy || start < entry.neededBy)) entry.neededBy = start
    entry.orderIds.add(orderId)
    totals.set(materialId, entry)
  }

  for (const order of input.orders) {
    const schedule = scheduleById.get(order.id)
    if (!schedule || schedule.missingRouting || !schedule.start || !schedule.end) continue
    if (schedule.end < first || schedule.start > last) continue
    const product = products.get(order.productId)
    const lines: CostedBomLine[] = (input.boms[order.productId] ?? []).map((line) => {
      const material = materials.get(line.materialId)
      return {
        ...line,
        unitPrice: material?.unitPrice ?? '0',
        wastePercent: material?.wastePercent ?? '0',
      }
    })
    const fabric = order.fabricMaterialId ? materials.get(order.fabricMaterialId) : undefined
    const result = computeRequirements(
      lines,
      order.quantity,
      product?.laborMinutes ?? 0,
      fabric && product && Number(product.fabricConsumption) > 0
        ? {
            choice: { materialId: fabric.id, unitPrice: fabric.unitPrice, wastePercent: fabric.wastePercent },
            consumptionPerUnit: product.fabricConsumption,
          }
        : null,
    )
    for (const row of result.rows) add(row.materialId, row.normQuantity, row.requiredQuantity, schedule.start, order.id)
    if (result.fabric) {
      add(result.fabric.materialId, result.fabric.normQuantity, result.fabric.requiredQuantity, schedule.start, order.id)
    }
  }

  const lines: RequirementLine[] = []
  for (const [materialId, entry] of totals) {
    const material = materials.get(materialId)
    lines.push({
      materialId,
      name: material?.name ?? '—',
      code: material?.code ?? null,
      unit: material?.unit ?? 'pcs',
      materialType: material?.materialType ?? 'other',
      isFabric: material?.materialType === 'fabric',
      normQuantity: formatQuantity(entry.norm),
      requiredQuantity: formatQuantity(entry.required),
      neededBy: entry.neededBy,
      orderIds: Array.from(entry.orderIds),
    })
  }
  // Soonest needed first; fabric after the rest on the same day so the BOM
  // materials read as one block, as on the BOM screen.
  return lines.sort((a, b) =>
    (a.neededBy ?? '9999').localeCompare(b.neededBy ?? '9999') ||
    Number(a.isFabric) - Number(b.isFabric) ||
    a.name.localeCompare(b.name),
  )
}

export function buildPlanView(input: PlanInput): PlanView {
  const workCenters = [...input.workCenters].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
  const plan = computePlan({
    workCenters,
    routings: routingMap(input),
    orders: input.orders,
    from: input.from,
    dayCount: input.days,
    today: input.today,
  })
  return {
    ...plan,
    requirements: aggregateRequirements(input, plan.orders, plan.days),
    scheduleByOrder: Object.fromEntries(plan.orders.map((schedule) => [schedule.orderId, schedule])),
  }
}

/** Overloaded work-centre days in the window — the number a reschedule is judged by. */
export function countOverloads(input: PlanInput): number {
  return buildPlanView(input).overloadedCells
}

/** Local calendar date of `now`, as `YYYY-MM-DD` — not the UTC date, which is yesterday after midnight in Warsaw. */
export function localIsoDate(now: Date = new Date()): IsoDate {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
