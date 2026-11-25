import type { EntityManager } from '@mikro-orm/postgresql'
import { Material, Product } from '@open-mercato/production-bom/modules/production_bom/data/entities'
import { seedProductionBomExamples } from '@open-mercato/production-bom/modules/production_bom/lib/demo-seed'
import { ProductionOrder, RoutingStep, WorkCenter, type OrderStatus, type WorkCenterStage } from '../data/entities'
import { demoData } from './demo-data'
import { formatOrderNumber } from './order-number'
import { localIsoDate } from './plan-model'
import { shiftWorkingDays, workingDayOnOrAfter, type IsoDate } from './schedule'

/**
 * Example plan for the same invented upholstery and garden-furniture workshop
 * the BOM demo uses: five work centres, a routing for every demo product and a
 * fortnight of orders. Everything is made up — see `demo-data.ts`.
 *
 * Due dates are RELATIVE: counted in working days from the first working day on
 * or after the day the data is created, so the plan always opens on a busy,
 * readable fortnight instead of on dates that drifted into the past.
 */

type DemoWorkCenter = (typeof demoData.workCenters)[number]
type DemoRoutingStep = { workCenter: string; minutesPerUnit: number; setupMinutes?: number }
export type DemoOrder = {
  product: string
  quantity: number
  dueInWorkingDays: number
  status?: string
  fabric?: string
  reference?: string
}

export const DEMO_WORK_CENTERS: ReadonlyArray<DemoWorkCenter> = demoData.workCenters
export const DEMO_ROUTINGS: Readonly<Record<string, DemoRoutingStep[]>> = demoData.routings
export const DEMO_ORDERS: ReadonlyArray<DemoOrder> = demoData.orders

/** Seeded orders in due-date order, numbered `ZP/<year>/001…`, with absolute due dates. */
export function planDemoOrders(today: IsoDate): Array<DemoOrder & { dueDate: IsoDate; number: string }> {
  const firstDay = workingDayOnOrAfter(today)
  const dated = DEMO_ORDERS.map((order, index) => ({ ...order, index, dueDate: shiftWorkingDays(firstDay, order.dueInWorkingDays) }))
  dated.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.index - b.index)
  return dated.map(({ index: _index, ...order }, position) => ({
    ...order,
    number: formatOrderNumber(order.dueDate.slice(0, 4), position + 1),
  }))
}

export async function seedProductionPlanningExamples(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
  options: { today?: IsoDate } = {},
): Promise<{ seeded: boolean; workCenters: number; orders: number }> {
  const base = { tenantId: scope.tenantId, organizationId: scope.organizationId }
  const existing = await em.count(WorkCenter, base)
  if (existing > 0) return { seeded: false, workCenters: 0, orders: 0 }

  // Routings and orders point at BOM products. The BOM seed is idempotent, so
  // calling it here makes the order of module seeding irrelevant.
  await seedProductionBomExamples(em, scope)
  const products = await em.find(Product, { ...base, deletedAt: null })
  const productByCode = new Map(products.map((product) => [product.code ?? '', product]))
  const fabrics = await em.find(Material, { ...base, materialType: 'fabric', deletedAt: null })
  const fabricByCode = new Map(fabrics.map((fabric) => [fabric.code ?? '', fabric]))

  const centreByCode = new Map<string, WorkCenter>()
  for (const seed of DEMO_WORK_CENTERS) {
    const centre = em.create(WorkCenter, {
      ...base,
      name: seed.name,
      code: seed.code,
      stage: seed.stage as WorkCenterStage,
      dailyCapacityMinutes: seed.dailyCapacityMinutes,
      position: seed.position,
      notes: seed.notes,
      isActive: true,
    } as never) as WorkCenter
    em.persist(centre)
    centreByCode.set(seed.code, centre)
  }
  await em.flush()

  for (const [productCode, steps] of Object.entries(DEMO_ROUTINGS)) {
    const product = productByCode.get(productCode)
    if (!product) continue
    steps.forEach((step, index) => {
      const centre = centreByCode.get(step.workCenter)
      if (!centre) throw new Error(`Unknown demo work centre ${step.workCenter}`)
      em.persist(
        em.create(RoutingStep, {
          ...base,
          productId: product.id,
          workCenterId: centre.id,
          sequence: index + 1,
          minutesPerUnit: String(step.minutesPerUnit),
          setupMinutes: step.setupMinutes ?? 0,
        } as never),
      )
    })
  }
  await em.flush()

  let orders = 0
  for (const order of planDemoOrders(options.today ?? localIsoDate())) {
    const product = productByCode.get(order.product)
    if (!product) continue
    em.persist(
      em.create(ProductionOrder, {
        ...base,
        number: order.number,
        productId: product.id,
        quantity: order.quantity,
        dueDate: order.dueDate,
        priority: 'normal',
        status: (order.status ?? 'planned') as OrderStatus,
        fabricMaterialId: order.fabric ? fabricByCode.get(order.fabric)?.id ?? null : null,
        reference: order.reference ?? null,
      } as never),
    )
    orders += 1
  }
  await em.flush()

  return { seeded: true, workCenters: DEMO_WORK_CENTERS.length, orders }
}
