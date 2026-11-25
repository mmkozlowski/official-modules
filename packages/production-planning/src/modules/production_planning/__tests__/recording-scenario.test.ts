import { demoData } from '../lib/demo-data'
import { URGENT_DEFAULT_LEAD_DAYS } from '../lib/plan-model'
import { computePlan, shiftWorkingDays, type ScheduleOrder, type ScheduleRoutingStep } from '../lib/schedule'

/**
 * Guard for the recording: the demo plan must open without a single red cell,
 * and the two live moves of the episode must each turn something red — and the
 * planner's fix must clear it again. Change the demo data and this test tells
 * you, before the camera does, that the "wow" no longer happens.
 *
 * Runs on working days only, so the result does not depend on the weekday the
 * data was reset on.
 */

const FIRST_DAY = '2026-11-30'
const TODAY = '2026-11-29'

const workCenters = demoData.workCenters.map((centre) => ({ id: centre.code, dailyCapacityMinutes: centre.dailyCapacityMinutes }))
const routings = new Map<string, ScheduleRoutingStep[]>(
  Object.entries(demoData.routings).map(([product, steps]) => [
    product,
    steps.map((step, index) => ({
      workCenterId: step.workCenter,
      sequence: index + 1,
      minutesPerUnit: step.minutesPerUnit,
      setupMinutes: 'setupMinutes' in step ? step.setupMinutes : 0,
    })),
  ]),
)

const baseOrders: ScheduleOrder[] = demoData.orders.map((order, index) => ({
  id: `o${index}`,
  productId: order.product,
  quantity: order.quantity,
  dueDate: shiftWorkingDays(FIRST_DAY, order.dueInWorkingDays),
}))

type Move = { product: string; quantity: number; dueInWorkingDays: number; toWorkingDays: number }

function moved(orders: ScheduleOrder[], move: Move): ScheduleOrder[] {
  const from = shiftWorkingDays(FIRST_DAY, move.dueInWorkingDays)
  const matches = orders.filter((o) => o.productId === move.product && o.quantity === move.quantity && o.dueDate === from)
  expect(matches).toHaveLength(1)
  return orders.map((o) => (o === matches[0] ? { ...o, dueDate: shiftWorkingDays(FIRST_DAY, move.toWorkingDays) } : o))
}

function plan(orders: ScheduleOrder[]) {
  return computePlan({ workCenters, routings, orders, from: FIRST_DAY, dayCount: 10, today: TODAY })
}

function redCentres(orders: ScheduleOrder[]): string[] {
  return plan(orders)
    .load.filter((centre) => centre.overloadedDays > 0)
    .map((centre) => centre.workCenterId)
}

const urgent: ScheduleOrder = {
  id: 'urgent',
  productId: demoData.rehearsal.urgent.product,
  quantity: demoData.rehearsal.urgent.quantity,
  dueDate: shiftWorkingDays(FIRST_DAY, demoData.rehearsal.urgent.dueInWorkingDays),
}

describe('recording scenario', () => {
  it('every demo order has a routing', () => {
    expect(plan(baseOrders).orders.filter((o) => o.missingRouting)).toEqual([])
  })

  it('the plan opens with no overloaded day', () => {
    expect(plan(baseOrders).overloadedCells).toBe(0)
  })

  it('pulling the order forward turns cutting and sewing red, clearly', () => {
    const after = plan(moved(baseOrders, demoData.rehearsal.move))
    expect(redCentres(moved(baseOrders, demoData.rehearsal.move))).toEqual(['KRO', 'SZW'])
    const sewing = after.load.find((centre) => centre.workCenterId === 'SZW')!
    expect(sewing.peakPercent).toBeGreaterThanOrEqual(115)
  })

  it('the urgent-order dialog proposes the due date the scenario uses, so nobody types a date on camera', () => {
    expect(URGENT_DEFAULT_LEAD_DAYS).toBe(demoData.rehearsal.urgent.dueInWorkingDays)
  })

  it('the urgent order overloads upholstery, and moving the stock inlets later clears it', () => {
    expect(redCentres([...baseOrders, urgent])).toEqual(['TAP'])
    expect(plan([...moved(baseOrders, demoData.rehearsal.fix), urgent]).overloadedCells).toBe(0)
  })
})
