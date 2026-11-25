import { LockMode } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import {
  Department,
  DepartmentTask,
  OrderLine,
  ProductionOrder,
  RoutedProduct,
  TaskReport,
  type OrderStatus,
  type TaskStatus,
} from '../data/entities'
import type { OrderLineInput, ReportTaskInput } from '../data/validators'
import { applyReport, orderStatusFor, planDepartmentTasks, summarizeDepartments, type RoutingProblem } from './routing'

export type Scope = { tenantId: string; organizationId: string }

const inScope = (scope: Scope) => ({ tenantId: scope.tenantId, organizationId: scope.organizationId })

export async function findOrderInScope(em: EntityManager, scope: Scope, orderId: string): Promise<ProductionOrder | null> {
  return em.findOne(ProductionOrder, { id: orderId, ...inScope(scope), deletedAt: null })
}

/** Next free `ZAM/<year>/<NNNN>` in the organisation. Display only — uniqueness is not a database constraint. */
export async function nextOrderNumber(em: EntityManager, scope: Scope, now: Date = new Date()): Promise<string> {
  const prefix = `ZAM/${now.getFullYear()}/`
  const existing = await em.find(
    ProductionOrder,
    { ...inScope(scope), number: { $like: `${prefix}%` } },
    { fields: ['number'] },
  )
  const highest = existing.reduce((max, order) => {
    const value = Number(order.number.slice(prefix.length))
    return Number.isFinite(value) && value > max ? value : max
  }, 0)
  return `${prefix}${String(highest + 1).padStart(4, '0')}`
}

/** Rewrites status and progress of an order from its tasks. Call inside the transaction that changed a task. */
async function recomputeOrder(tem: EntityManager, order: ProductionOrder): Promise<{ previous: OrderStatus; next: OrderStatus }> {
  const tasks = await tem.find(DepartmentTask, { orderId: order.id, tenantId: order.tenantId, organizationId: order.organizationId })
  const previous = order.status
  const summary = orderStatusFor(tasks)
  order.status = summary.status
  order.departmentsDone = summary.departmentsDone
  order.departmentsTotal = summary.departmentsTotal
  if (summary.status === 'ready_to_ship' && previous !== 'ready_to_ship') order.readyAt = new Date()
  if (summary.status !== 'ready_to_ship') order.readyAt = null
  return { previous, next: summary.status }
}

export type ReplaceLinesResult =
  | { ok: true }
  | { ok: false; error: 'not_found' | 'order_not_editable' | 'product_not_found'; index?: number }

/** Lines are editable only while the order is `new` — once split, tasks already carry the quantities. */
export async function replaceOrderLines(
  em: EntityManager,
  scope: Scope,
  orderId: string,
  lines: OrderLineInput[],
): Promise<ReplaceLinesResult> {
  return em.transactional(async (tem) => {
    const order = await tem.findOne(
      ProductionOrder,
      { id: orderId, ...inScope(scope), deletedAt: null },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    )
    if (!order) return { ok: false, error: 'not_found' }
    if (order.status !== 'new') return { ok: false, error: 'order_not_editable' }
    const products = await tem.find(RoutedProduct, {
      id: { $in: Array.from(new Set(lines.map((line) => line.productId))) },
      ...inScope(scope),
      deletedAt: null,
    })
    const byId = new Map(products.map((product) => [product.id, product]))
    for (const [index, line] of lines.entries()) {
      if (!byId.has(line.productId)) return { ok: false, error: 'product_not_found', index }
    }
    await tem.nativeDelete(OrderLine, { orderId: order.id, ...inScope(scope) })
    lines.forEach((line, position) => {
      tem.persist(
        tem.create(OrderLine, {
          ...inScope(scope),
          orderId: order.id,
          productId: line.productId,
          productName: (byId.get(line.productId) as RoutedProduct).name,
          quantity: line.quantity,
          position,
        } as never),
      )
    })
    await tem.flush()
    return { ok: true }
  })
}

export type AcceptResult =
  | { ok: true; order: ProductionOrder; taskCount: number; departmentCount: number }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'already_accepted' }
  | { ok: false; error: 'routing_problem'; problem: RoutingProblem }

/**
 * Accepts an order for production: splits every line into one task per
 * department on its product's routing, in one transaction. The order row is
 * locked first, so a double click (or two people) cannot split it twice.
 */
export async function acceptOrder(em: EntityManager, scope: Scope, orderId: string, now: Date = new Date()): Promise<AcceptResult> {
  return em.transactional(async (tem) => {
    const order = await tem.findOne(
      ProductionOrder,
      { id: orderId, ...inScope(scope), deletedAt: null },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    )
    if (!order) return { ok: false as const, error: 'not_found' as const }
    if (order.status !== 'new') return { ok: false as const, error: 'already_accepted' as const }

    const lines = await tem.find(OrderLine, { orderId: order.id, ...inScope(scope) }, { orderBy: { position: 'asc' } })
    const products = await tem.find(RoutedProduct, {
      id: { $in: Array.from(new Set(lines.map((line) => line.productId))) },
      ...inScope(scope),
    })
    const activeDepartments = await tem.find(Department, { ...inScope(scope), deletedAt: null, isActive: true })
    const activeIds = new Set(activeDepartments.map((department) => department.id))
    // A routing step pointing at a deleted or inactive department is skipped —
    // nobody would ever see that task on a board.
    const routing = new Map(
      products.map((product) => [product.id, (product.departmentIds ?? []).filter((id) => activeIds.has(id))]),
    )
    const plan = planDepartmentTasks(
      lines.map((line) => ({ lineId: line.id, productId: line.productId, productName: line.productName, quantity: line.quantity })),
      routing,
    )
    if (!plan.ok) return { ok: false as const, error: 'routing_problem' as const, problem: plan.problem }

    for (const task of plan.tasks) {
      tem.persist(
        tem.create(DepartmentTask, {
          ...inScope(scope),
          orderId: order.id,
          orderLineId: task.orderLineId,
          departmentId: task.departmentId,
          orderNumber: order.number,
          customerName: order.customerName,
          productName: task.productName,
          dueDate: order.dueDate ?? null,
          quantityRequired: task.quantityRequired,
          quantityDone: 0,
          status: 'pending',
          routeStep: task.routeStep,
        } as never),
      )
    }
    await tem.flush()
    order.acceptedAt = now
    await recomputeOrder(tem, order)
    await tem.flush()
    return {
      ok: true as const,
      order,
      taskCount: plan.tasks.length,
      departmentCount: new Set(plan.tasks.map((task) => task.departmentId)).size,
    }
  })
}

export type ReportResult =
  | {
      ok: true
      task: DepartmentTask
      order: ProductionOrder
      delta: number
      previousOrderStatus: OrderStatus
    }
  | { ok: false; error: 'not_found' | 'over_required' | 'below_zero' | 'no_change' }

/**
 * Records a department's report on a task and recomputes the order in the same
 * transaction. The ORDER row is locked before the task is read: two departments
 * reporting on one order at the same second are serialised, so the second one
 * always counts the first one's finished department.
 */
export async function reportTask(
  em: EntityManager,
  scope: Scope,
  taskId: string,
  report: ReportTaskInput,
  actorUserId: string | null,
): Promise<ReportResult> {
  return em.transactional(async (tem) => {
    const probe = await tem.findOne(DepartmentTask, { id: taskId, ...inScope(scope) }, { fields: ['id', 'orderId'] })
    if (!probe) return { ok: false as const, error: 'not_found' as const }
    const order = await tem.findOne(
      ProductionOrder,
      { id: probe.orderId, ...inScope(scope), deletedAt: null },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    )
    if (!order) return { ok: false as const, error: 'not_found' as const }
    const task = await tem.findOne(DepartmentTask, { id: taskId, ...inScope(scope) }, { refresh: true })
    if (!task) return { ok: false as const, error: 'not_found' as const }

    const applied = applyReport(task, report)
    if (!applied.ok) return { ok: false as const, error: applied.error }
    const now = new Date()
    task.quantityDone = applied.quantityDone
    task.status = applied.status
    if (applied.quantityDone > 0 && !task.startedAt) task.startedAt = now
    task.completedAt = applied.status === 'done' ? now : null
    tem.persist(
      tem.create(TaskReport, {
        ...inScope(scope),
        taskId: task.id,
        orderId: order.id,
        departmentId: task.departmentId,
        quantityDelta: applied.delta,
        reportedBy: actorUserId,
      } as never),
    )
    await tem.flush()
    const { previous } = await recomputeOrder(tem, order)
    await tem.flush()
    return { ok: true as const, task, order, delta: applied.delta, previousOrderStatus: previous }
  })
}

export type TaskView = {
  id: string
  orderId: string
  orderLineId: string
  departmentId: string
  orderNumber: string
  customerName: string
  productName: string
  dueDate: string | null
  quantityRequired: number
  quantityDone: number
  status: TaskStatus
  routeStep: number
  updatedAt: string
}

export function toTaskView(task: DepartmentTask): TaskView {
  return {
    id: task.id,
    orderId: task.orderId,
    orderLineId: task.orderLineId,
    departmentId: task.departmentId,
    orderNumber: task.orderNumber,
    customerName: task.customerName,
    productName: task.productName,
    dueDate: task.dueDate ?? null,
    quantityRequired: task.quantityRequired,
    quantityDone: task.quantityDone,
    status: task.status,
    routeStep: task.routeStep,
    updatedAt: task.updatedAt.toISOString(),
  }
}

export type DepartmentView = { id: string; name: string; code: string | null; position: number }

export type OrderView = {
  order: {
    id: string
    number: string
    customerName: string
    dueDate: string | null
    status: OrderStatus
    departmentsDone: number
    departmentsTotal: number
    acceptedAt: string | null
    readyAt: string | null
    notes: string | null
    updatedAt: string
  }
  lines: Array<{ id: string; productId: string; productName: string; quantity: number; departmentNames: string[] }>
  departments: Array<
    DepartmentView & {
      quantityRequired: number
      quantityDone: number
      taskCount: number
      tasksDone: number
      status: TaskStatus
      tasks: TaskView[]
    }
  >
}

export async function loadDepartments(em: EntityManager, scope: Scope, includeInactive = true): Promise<Department[]> {
  return em.find(
    Department,
    { ...inScope(scope), deletedAt: null, ...(includeInactive ? {} : { isActive: true }) },
    { orderBy: { position: 'asc', name: 'asc' } },
  )
}

export function toDepartmentView(department: Department): DepartmentView {
  return { id: department.id, name: department.name, code: department.code ?? null, position: department.position }
}

/**
 * Everything the order screen shows, in one read: header, lines (with the
 * departments each product goes through, so a `new` order already shows how it
 * WILL split) and per-department progress with the tasks behind it.
 */
export async function buildOrderView(em: EntityManager, scope: Scope, orderId: string): Promise<OrderView | null> {
  const order = await findOrderInScope(em, scope, orderId)
  if (!order) return null
  const [lines, tasks, departments] = await Promise.all([
    em.find(OrderLine, { orderId: order.id, ...inScope(scope) }, { orderBy: { position: 'asc' } }),
    em.find(DepartmentTask, { orderId: order.id, ...inScope(scope) }, { orderBy: { routeStep: 'asc', createdAt: 'asc' } }),
    em.find(Department, { ...inScope(scope) }, { orderBy: { position: 'asc', name: 'asc' } }),
  ])
  const products = lines.length
    ? await em.find(RoutedProduct, { id: { $in: lines.map((line) => line.productId) }, ...inScope(scope) })
    : []
  const departmentById = new Map(departments.map((department) => [department.id, department]))
  const productById = new Map(products.map((product) => [product.id, product]))
  const summary = summarizeDepartments(
    tasks,
    departments.map((department) => department.id),
  )
  return {
    order: {
      id: order.id,
      number: order.number,
      customerName: order.customerName,
      dueDate: order.dueDate ?? null,
      status: order.status,
      departmentsDone: order.departmentsDone,
      departmentsTotal: order.departmentsTotal,
      acceptedAt: order.acceptedAt ? order.acceptedAt.toISOString() : null,
      readyAt: order.readyAt ? order.readyAt.toISOString() : null,
      notes: order.notes ?? null,
      updatedAt: order.updatedAt.toISOString(),
    },
    lines: lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      productName: line.productName,
      quantity: line.quantity,
      departmentNames: (productById.get(line.productId)?.departmentIds ?? [])
        .map((id) => departmentById.get(id))
        .filter((department): department is Department => !!department && !department.deletedAt && department.isActive)
        .map((department) => department.name),
    })),
    departments: summary.map((entry) => {
      const department = departmentById.get(entry.departmentId)
      return {
        id: entry.departmentId,
        name: department?.name ?? '—',
        code: department?.code ?? null,
        position: department?.position ?? 0,
        quantityRequired: entry.quantityRequired,
        quantityDone: entry.quantityDone,
        taskCount: entry.taskCount,
        tasksDone: entry.tasksDone,
        status: entry.status,
        tasks: tasks.filter((task) => task.departmentId === entry.departmentId).map(toTaskView),
      }
    }),
  }
}

