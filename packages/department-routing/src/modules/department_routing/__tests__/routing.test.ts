import { applyReport, orderStatusFor, planDepartmentTasks, summarizeDepartments, taskStatusFor } from '../lib/routing'

const JOINERY = 'd-joinery'
const PAINT = 'd-paint'
const UPHOLSTERY = 'd-upholstery'
const PACKING = 'd-packing'

describe('planDepartmentTasks', () => {
  const routing = new Map([
    ['p-bench', [JOINERY, PAINT, UPHOLSTERY, PACKING]],
    ['p-table', [JOINERY, PAINT, PACKING]],
  ])

  it('makes one task per line per department on the routing, in routing order', () => {
    const result = planDepartmentTasks(
      [
        { lineId: 'l1', productId: 'p-bench', productName: 'Bench', quantity: 4 },
        { lineId: 'l2', productId: 'p-table', productName: 'Table', quantity: 2 },
      ],
      routing,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.tasks).toHaveLength(7)
    expect(result.tasks.filter((task) => task.orderLineId === 'l1').map((task) => [task.departmentId, task.routeStep])).toEqual([
      [JOINERY, 0],
      [PAINT, 1],
      [UPHOLSTERY, 2],
      [PACKING, 3],
    ])
    expect(result.tasks.every((task) => task.quantityRequired === (task.orderLineId === 'l1' ? 4 : 2))).toBe(true)
  })

  it('refuses an order with no lines', () => {
    expect(planDepartmentTasks([], routing)).toEqual({ ok: false, problem: { kind: 'no_lines' } })
  })

  it('refuses a product without departments and names it', () => {
    expect(
      planDepartmentTasks([{ lineId: 'l1', productId: 'p-unknown', productName: 'Chair', quantity: 1 }], routing),
    ).toEqual({ ok: false, problem: { kind: 'no_routing', productName: 'Chair' } })
  })
})

describe('applyReport', () => {
  it('adds a partial quantity', () => {
    expect(applyReport({ quantityDone: 0, quantityRequired: 8 }, { add: 3 })).toEqual({
      ok: true,
      quantityDone: 3,
      delta: 3,
      status: 'in_progress',
    })
  })

  it('finishes the task at the required quantity', () => {
    expect(applyReport({ quantityDone: 5, quantityRequired: 8 }, { add: 3 })).toMatchObject({ ok: true, status: 'done' })
  })

  it('refuses more than required instead of clamping', () => {
    expect(applyReport({ quantityDone: 5, quantityRequired: 8 }, { add: 4 })).toEqual({ ok: false, error: 'over_required' })
  })

  it('accepts a correction down, back to pending', () => {
    expect(applyReport({ quantityDone: 2, quantityRequired: 8 }, { set: 0 })).toEqual({
      ok: true,
      quantityDone: 0,
      delta: -2,
      status: 'pending',
    })
  })

  it('refuses a report that changes nothing', () => {
    expect(applyReport({ quantityDone: 2, quantityRequired: 8 }, { set: 2 })).toEqual({ ok: false, error: 'no_change' })
  })
})

describe('order status', () => {
  const task = (departmentId: string, quantityDone: number, quantityRequired = 4) => ({
    departmentId,
    quantityDone,
    quantityRequired,
    status: taskStatusFor(quantityDone, quantityRequired),
  })

  it('is new before any task exists', () => {
    expect(orderStatusFor([])).toEqual({ status: 'new', departmentsDone: 0, departmentsTotal: 0 })
  })

  it('counts a department done only when all its tasks are done', () => {
    const tasks = [task(JOINERY, 4), task(JOINERY, 2), task(PAINT, 4), task(PACKING, 0)]
    expect(orderStatusFor(tasks)).toEqual({ status: 'in_progress', departmentsDone: 1, departmentsTotal: 3 })
  })

  it('is ready to ship when every department is done', () => {
    expect(orderStatusFor([task(JOINERY, 4), task(PAINT, 4), task(PACKING, 4)])).toEqual({
      status: 'ready_to_ship',
      departmentsDone: 3,
      departmentsTotal: 3,
    })
  })

  it('summarises quantities per department in the given department order', () => {
    const summary = summarizeDepartments([task(PACKING, 0), task(JOINERY, 4), task(JOINERY, 1)], [JOINERY, PAINT, PACKING])
    expect(summary.map((entry) => [entry.departmentId, entry.quantityDone, entry.quantityRequired, entry.status])).toEqual([
      [JOINERY, 5, 8, 'in_progress'],
      [PACKING, 0, 4, 'pending'],
    ])
  })
})
