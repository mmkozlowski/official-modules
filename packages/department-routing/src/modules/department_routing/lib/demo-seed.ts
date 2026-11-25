import type { EntityManager } from '@mikro-orm/postgresql'
import {
  Department,
  DepartmentTask,
  OrderLine,
  ProductionOrder,
  RoutedProduct,
  TaskReport,
} from '../data/entities'
import { acceptOrder, replaceOrderLines, reportTask, type Scope } from './order-service'

/**
 * Example data for the same small garden-furniture workshop as the BOM demo:
 * five departments, six products with their routing, five orders at different
 * stages. Everything is invented — customers are described by kind and city,
 * not named, and there are no prices.
 */
type DepartmentSeed = { key: string; name: string; code: string; position: number; description: string }

const DEPARTMENTS: DepartmentSeed[] = [
  { key: 'joinery', name: 'Stolarnia', code: 'STO', position: 10, description: 'Cięcie, frezowanie i montaż elementów drewnianych.' },
  { key: 'paint', name: 'Lakiernia', code: 'LAK', position: 20, description: 'Olejowanie i lakierowanie drewna.' },
  { key: 'sewing', name: 'Szwalnia', code: 'SZW', position: 30, description: 'Szycie poduszek i pokrowców.' },
  { key: 'upholstery', name: 'Tapicernia', code: 'TAP', position: 40, description: 'Tapicerowanie siedzisk i oparć.' },
  { key: 'packing', name: 'Pakowanie', code: 'PAK', position: 50, description: 'Kontrola końcowa, pakowanie i etykiety.' },
]

type ProductSeed = { key: string; name: string; code: string; departments: string[]; description: string }

const PRODUCTS: ProductSeed[] = [
  {
    key: 'bench',
    name: 'Ławka ogrodowa z oparciem 150 cm',
    code: 'LA-150',
    departments: ['joinery', 'paint', 'upholstery', 'packing'],
    description: 'Ławka z drewna akacjowego z tapicerowanym siedziskiem.',
  },
  {
    key: 'table',
    name: 'Stół ogrodowy 120×80',
    code: 'ST-120',
    departments: ['joinery', 'paint', 'packing'],
    description: 'Stół z blatem z desek na stelażu aluminiowym.',
  },
  {
    key: 'armchair',
    name: 'Fotel ogrodowy tapicerowany',
    code: 'FO-01',
    departments: ['joinery', 'paint', 'upholstery', 'packing'],
    description: 'Fotel z drewnianą ramą i tapicerowanym siedziskiem.',
  },
  {
    key: 'chair',
    name: 'Krzesło ogrodowe składane',
    code: 'KR-01',
    departments: ['joinery', 'paint', 'packing'],
    description: 'Składane krzesło z drewna akacjowego.',
  },
  {
    key: 'cushion45',
    name: 'Poduszka na krzesło ogrodowe 45×45',
    code: 'PO-45',
    departments: ['sewing', 'packing'],
    description: 'Poduszka siedziska z zamkiem i wiązaniami.',
  },
  {
    key: 'cushion120',
    name: 'Poduszka na ławkę ogrodową 120×60',
    code: 'PO-120',
    departments: ['sewing', 'packing'],
    description: 'Długa poduszka na ławkę, zamek na trzech bokach.',
  },
]

type OrderSeed = {
  number: string
  customerName: string
  dueInDays: number
  notes?: string
  lines: Array<[product: string, quantity: number]>
  accept: boolean
  /** Done quantity per [product, department]; omitted pairs stay at 0. `'all'` finishes every task. */
  done?: Array<[product: string, department: string, quantity: number]> | 'all'
}

/**
 * ZAM/2026/0141 is the order for the recording: `new`, with two products that
 * split into four departments (5 tasks). The others fill the list with every
 * state: ready to ship, two in progress, one more waiting.
 */
const ORDERS: OrderSeed[] = [
  {
    number: 'ZAM/2026/0137',
    customerName: 'Sklep ogrodowy — Poznań',
    dueInDays: -1,
    lines: [
      ['chair', 6],
      ['table', 2],
    ],
    accept: true,
    done: 'all',
  },
  {
    number: 'ZAM/2026/0138',
    customerName: 'Restauracja z ogródkiem — Kraków',
    dueInDays: 3,
    lines: [
      ['table', 3],
      ['chair', 12],
    ],
    accept: true,
    done: [
      ['table', 'joinery', 3],
      ['chair', 'joinery', 12],
      ['table', 'paint', 3],
      ['chair', 'paint', 12],
      ['table', 'packing', 3],
      ['chair', 'packing', 5],
    ],
  },
  {
    number: 'ZAM/2026/0139',
    customerName: 'Kawiarnia — Sopot',
    dueInDays: 6,
    lines: [
      ['armchair', 4],
      ['cushion45', 8],
    ],
    accept: true,
    done: [
      ['armchair', 'joinery', 2],
      ['cushion45', 'sewing', 8],
    ],
  },
  {
    number: 'ZAM/2026/0140',
    customerName: 'Klient detaliczny — Gdynia',
    dueInDays: 10,
    lines: [
      ['armchair', 1],
      ['cushion45', 2],
    ],
    accept: false,
  },
  {
    number: 'ZAM/2026/0141',
    customerName: 'Pensjonat — Mazury',
    dueInDays: 8,
    notes: 'Taras przy jadalni — komplet na sezon.',
    lines: [
      ['bench', 4],
      ['table', 2],
    ],
    accept: false,
  },
]

function isoDateInDays(days: number, now: Date): string {
  const date = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
  return date.toISOString().slice(0, 10)
}

async function seedAll(em: EntityManager, scope: Scope, now: Date) {
  const departmentIds = new Map<string, string>()
  for (const seed of DEPARTMENTS) {
    const department = em.create(Department, {
      ...scope,
      name: seed.name,
      code: seed.code,
      position: seed.position,
      description: seed.description,
      isActive: true,
    } as never) as Department
    em.persist(department)
    await em.flush()
    departmentIds.set(seed.key, department.id)
  }

  const productIds = new Map<string, string>()
  for (const seed of PRODUCTS) {
    const product = em.create(RoutedProduct, {
      ...scope,
      name: seed.name,
      code: seed.code,
      departmentIds: seed.departments.map((key) => departmentIds.get(key) as string),
      description: seed.description,
      isActive: true,
    } as never) as RoutedProduct
    em.persist(product)
    await em.flush()
    productIds.set(seed.key, product.id)
  }

  for (const seed of ORDERS) {
    const order = em.create(ProductionOrder, {
      ...scope,
      number: seed.number,
      customerName: seed.customerName,
      dueDate: isoDateInDays(seed.dueInDays, now),
      notes: seed.notes ?? null,
      status: 'new',
    } as never) as ProductionOrder
    em.persist(order)
    await em.flush()
    await replaceOrderLines(
      em,
      scope,
      order.id,
      seed.lines.map(([product, quantity]) => ({ productId: productIds.get(product) as string, quantity })),
    )
    if (!seed.accept) continue
    const accepted = await acceptOrder(em, scope, order.id, now)
    if (!accepted.ok) throw new Error(`Seed order ${seed.number} could not be accepted: ${accepted.error}`)
    if (!seed.done) continue
    const tasks = await em.find(DepartmentTask, { orderId: order.id, ...scope })
    const lines = await em.find(OrderLine, { orderId: order.id, ...scope })
    const productOfLine = new Map(lines.map((line) => [line.id, line.productId]))
    for (const task of tasks) {
      let quantity = 0
      if (seed.done === 'all') {
        quantity = task.quantityRequired
      } else {
        const match = seed.done.find(
          ([product, department]) =>
            productIds.get(product) === productOfLine.get(task.orderLineId) && departmentIds.get(department) === task.departmentId,
        )
        quantity = match ? match[2] : 0
      }
      if (quantity > 0) await reportTask(em, scope, task.id, { set: quantity }, null)
    }
  }
}

/**
 * Seeds the example workshop once per organisation. Idempotent: an
 * organisation that already has any department is left untouched.
 */
export async function seedDepartmentRoutingExamples(
  em: EntityManager,
  scope: Scope,
  now: Date = new Date(),
): Promise<{ seeded: boolean }> {
  const existing = await em.count(Department, { tenantId: scope.tenantId, organizationId: scope.organizationId })
  if (existing > 0) return { seeded: false }
  await seedAll(em, scope, now)
  return { seeded: true }
}

/**
 * Wipes this module's data in ONE organisation and seeds the example again —
 * the clean state before a recording. Touches only this module's tables.
 */
export async function resetDepartmentRoutingDemo(em: EntityManager, scope: Scope, now: Date = new Date()): Promise<void> {
  const where = { tenantId: scope.tenantId, organizationId: scope.organizationId }
  await em.transactional(async (tem) => {
    await tem.nativeDelete(TaskReport, where)
    await tem.nativeDelete(DepartmentTask, where)
    await tem.nativeDelete(OrderLine, where)
    await tem.nativeDelete(ProductionOrder, where)
    await tem.nativeDelete(RoutedProduct, where)
    await tem.nativeDelete(Department, where)
  })
  em.clear()
  await seedAll(em, scope, now)
}

export const DEMO_ORDER_NUMBER = 'ZAM/2026/0141'
