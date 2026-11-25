/**
 * Pure rules of the module — no database, no framework. Everything that decides
 * what a task or an order looks like lives here, so the API routes and the seed
 * produce the same result and the tests pin it down.
 */
import type { OrderStatus, TaskStatus } from '../data/entities'

export type PlannedLine = { lineId: string; productId: string; productName: string; quantity: number }
export type RoutingByProduct = Map<string, string[]>

export type PlannedTask = {
  orderLineId: string
  departmentId: string
  productName: string
  quantityRequired: number
  routeStep: number
}

export type RoutingProblem = { kind: 'no_lines' } | { kind: 'no_routing'; productName: string }

/**
 * Splits order lines into department tasks: one task per line per department
 * on the product's routing. A product with no departments is a configuration
 * error and stops the whole order — accepting it would silently leave that
 * product with nobody to make it.
 */
export function planDepartmentTasks(
  lines: PlannedLine[],
  routing: RoutingByProduct,
): { ok: true; tasks: PlannedTask[] } | { ok: false; problem: RoutingProblem } {
  if (!lines.length) return { ok: false, problem: { kind: 'no_lines' } }
  const tasks: PlannedTask[] = []
  for (const line of lines) {
    const departmentIds = routing.get(line.productId) ?? []
    if (!departmentIds.length) return { ok: false, problem: { kind: 'no_routing', productName: line.productName } }
    departmentIds.forEach((departmentId, routeStep) => {
      tasks.push({
        orderLineId: line.lineId,
        departmentId,
        productName: line.productName,
        quantityRequired: line.quantity,
        routeStep,
      })
    })
  }
  return { ok: true, tasks }
}

export function taskStatusFor(quantityDone: number, quantityRequired: number): TaskStatus {
  if (quantityDone >= quantityRequired) return 'done'
  if (quantityDone > 0) return 'in_progress'
  return 'pending'
}

/**
 * Applies a report to a task. `add` is the usual "+3 done"; `set` is a
 * correction to an absolute number. Results outside 0…required are refused,
 * not clamped: "12 of 8 done" is a typo the department should see, not a
 * number to round away quietly.
 */
export function applyReport(
  current: { quantityDone: number; quantityRequired: number },
  report: { add?: number; set?: number },
): { ok: true; quantityDone: number; delta: number; status: TaskStatus } | { ok: false; error: 'over_required' | 'below_zero' | 'no_change' } {
  const next = report.set !== undefined ? report.set : current.quantityDone + (report.add ?? 0)
  if (next > current.quantityRequired) return { ok: false, error: 'over_required' }
  if (next < 0) return { ok: false, error: 'below_zero' }
  if (next === current.quantityDone) return { ok: false, error: 'no_change' }
  return {
    ok: true,
    quantityDone: next,
    delta: next - current.quantityDone,
    status: taskStatusFor(next, current.quantityRequired),
  }
}

export type TaskForSummary = {
  departmentId: string
  quantityRequired: number
  quantityDone: number
  status: TaskStatus
}

export type DepartmentProgress = {
  departmentId: string
  quantityRequired: number
  quantityDone: number
  taskCount: number
  tasksDone: number
  status: TaskStatus
}

/**
 * A department is done with an order when every one of its tasks on that
 * order is done. Departments are returned in the order given (the caller sorts
 * by department position), so "2/4" always counts the same departments.
 */
export function summarizeDepartments(tasks: TaskForSummary[], departmentOrder: string[] = []): DepartmentProgress[] {
  const byDepartment = new Map<string, DepartmentProgress>()
  for (const task of tasks) {
    const entry = byDepartment.get(task.departmentId) ?? {
      departmentId: task.departmentId,
      quantityRequired: 0,
      quantityDone: 0,
      taskCount: 0,
      tasksDone: 0,
      status: 'pending' as TaskStatus,
    }
    entry.quantityRequired += task.quantityRequired
    entry.quantityDone += task.quantityDone
    entry.taskCount += 1
    if (task.status === 'done') entry.tasksDone += 1
    byDepartment.set(task.departmentId, entry)
  }
  for (const entry of byDepartment.values()) {
    entry.status =
      entry.tasksDone === entry.taskCount ? 'done' : entry.quantityDone > 0 ? 'in_progress' : 'pending'
  }
  const rank = new Map(departmentOrder.map((id, index) => [id, index]))
  return Array.from(byDepartment.values()).sort(
    (a, b) => (rank.get(a.departmentId) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.departmentId) ?? Number.MAX_SAFE_INTEGER),
  )
}

/**
 * The order's status follows from its tasks, never from a click: no tasks yet
 * — still `new`; every department done — `ready_to_ship`; anything else —
 * `in_progress`. A correction that reopens a task moves a ready order back.
 */
export function orderStatusFor(
  tasks: TaskForSummary[],
): { status: OrderStatus; departmentsDone: number; departmentsTotal: number } {
  if (!tasks.length) return { status: 'new', departmentsDone: 0, departmentsTotal: 0 }
  const departments = summarizeDepartments(tasks)
  const departmentsDone = departments.filter((department) => department.status === 'done').length
  return {
    status: departmentsDone === departments.length ? 'ready_to_ship' : 'in_progress',
    departmentsDone,
    departmentsTotal: departments.length,
  }
}
