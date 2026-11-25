import type { EntityManager } from '@mikro-orm/postgresql'
import { BomLine, Material, Product } from '@open-mercato/production-bom/modules/production_bom/data/entities'
import { ProductionOrder, RoutingStep, SCHEDULED_ORDER_STATUSES, WorkCenter } from '../data/entities'
import type { PlanBomLine, PlanInput, PlanMaterial, PlanOrder, PlanProduct, PlanWorkCenter } from './plan-model'
import { workingDayOnOrAfter, type IsoDate, type ScheduleRoutingStep } from './schedule'

export type Scope = { tenantId: string; organizationId: string }

/** `date` columns come back as a string or a Date depending on the driver path — normalise to `YYYY-MM-DD`. */
export function toIsoDate(value: unknown): IsoDate {
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return String(value).slice(0, 10)
}

export function toPlanOrder(order: ProductionOrder): PlanOrder {
  return {
    id: order.id,
    number: order.number,
    productId: order.productId,
    quantity: order.quantity,
    dueDate: toIsoDate(order.dueDate),
    priority: order.priority,
    status: order.status,
    fabricMaterialId: order.fabricMaterialId ?? null,
    reference: order.reference ?? null,
  }
}

export async function loadRoutings(
  em: EntityManager,
  scope: Scope,
  productIds?: string[],
): Promise<Record<string, ScheduleRoutingStep[]>> {
  const where: Record<string, unknown> = { tenantId: scope.tenantId, organizationId: scope.organizationId }
  if (productIds) where.productId = { $in: productIds }
  const steps = await em.find(RoutingStep, where as never, { orderBy: { productId: 'asc', sequence: 'asc' } })
  const routings: Record<string, ScheduleRoutingStep[]> = {}
  for (const step of steps) {
    ;(routings[step.productId] ??= []).push({
      workCenterId: step.workCenterId,
      sequence: step.sequence,
      minutesPerUnit: Number(step.minutesPerUnit),
      setupMinutes: step.setupMinutes,
    })
  }
  return routings
}

/**
 * Everything the plan needs, in one read: live work centres, every routing,
 * the orders that occupy work centres, the products they make (from
 * `production_bom`) with their BOM lines, and the materials those lines and the
 * orders' fabrics point at. Scoped to one organisation.
 */
export async function loadPlanInput(
  em: EntityManager,
  scope: Scope,
  window: { today: IsoDate; from?: IsoDate; days: number },
): Promise<PlanInput> {
  const base = { tenantId: scope.tenantId, organizationId: scope.organizationId }
  const [centres, orders] = await Promise.all([
    em.find(WorkCenter, { ...base, deletedAt: null, isActive: true }, { orderBy: { position: 'asc', name: 'asc' } }),
    em.find(
      ProductionOrder,
      { ...base, deletedAt: null, status: { $in: [...SCHEDULED_ORDER_STATUSES] } },
      { orderBy: { dueDate: 'asc', number: 'asc' } },
    ),
  ])
  // Every live product, not only those with orders: the "urgent order" dialog
  // offers all of them, and a product without routing is a visible gap, not a crash.
  const products = await em.find(Product, { ...base, deletedAt: null, isActive: true }, { orderBy: { name: 'asc' } })
  const productIds = products.map((product) => product.id)
  const [routings, lines] = await Promise.all([
    loadRoutings(em, scope),
    productIds.length
      ? em.find(BomLine, { ...base, productId: { $in: productIds } }, { orderBy: { productId: 'asc', position: 'asc' } })
      : Promise.resolve([] as BomLine[]),
  ])
  const materialIds = new Set<string>(lines.map((line) => line.materialId))
  for (const order of orders) if (order.fabricMaterialId) materialIds.add(order.fabricMaterialId)
  // Fabrics are offered in the order dialog, so they come along even when unused.
  const materials = await em.find(Material, {
    ...base,
    $or: [{ id: { $in: Array.from(materialIds) } }, { materialType: 'fabric', deletedAt: null, isActive: true }],
  } as never)

  const boms: Record<string, PlanBomLine[]> = {}
  for (const line of lines) {
    ;(boms[line.productId] ??= []).push({
      materialId: line.materialId,
      quantity: String(line.quantity),
      segmentCount: line.segmentCount ?? null,
      segmentLength: line.segmentLength != null ? String(line.segmentLength) : null,
    })
  }

  return {
    today: window.today,
    from: workingDayOnOrAfter(window.from ?? window.today),
    days: window.days,
    workCenters: centres.map(
      (centre): PlanWorkCenter => ({
        id: centre.id,
        name: centre.name,
        code: centre.code ?? null,
        stage: centre.stage,
        dailyCapacityMinutes: centre.dailyCapacityMinutes,
        position: centre.position,
      }),
    ),
    products: products.map(
      (product): PlanProduct => ({
        id: product.id,
        name: product.name,
        code: product.code ?? null,
        laborMinutes: product.laborMinutes,
        fabricConsumption: String(product.fabricConsumption),
      }),
    ),
    routings,
    orders: orders.map(toPlanOrder),
    boms,
    materials: materials.map(
      (material): PlanMaterial => ({
        id: material.id,
        name: material.name,
        code: material.code ?? null,
        unit: material.unit,
        materialType: material.materialType,
        unitPrice: String(material.unitPrice),
        wastePercent: String(material.wastePercent),
        currencyCode: material.currencyCode,
      }),
    ),
  }
}
