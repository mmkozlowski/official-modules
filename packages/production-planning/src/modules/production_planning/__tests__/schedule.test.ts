import {
  computePlan,
  scheduleOrder,
  shiftWorkingDays,
  workingDayOnOrBefore,
  workingDays,
  type ScheduleRoutingStep,
  type ScheduleWorkCenter,
} from '../lib/schedule'

const cutting: ScheduleWorkCenter = { id: 'cut', dailyCapacityMinutes: 960 }
const sewing: ScheduleWorkCenter = { id: 'sew', dailyCapacityMinutes: 1920 }
const packing: ScheduleWorkCenter = { id: 'pack', dailyCapacityMinutes: 480 }
const centres = new Map([cutting, sewing, packing].map((c) => [c.id, c]))

const cushionRouting: ScheduleRoutingStep[] = [
  { workCenterId: 'cut', sequence: 1, minutesPerUnit: 4 },
  { workCenterId: 'sew', sequence: 2, minutesPerUnit: 9 },
  { workCenterId: 'pack', sequence: 3, minutesPerUnit: 2 },
]

describe('working-day calendar', () => {
  it('skips weekends in both directions', () => {
    // 2026-11-27 is a Friday, 2026-11-30 a Monday.
    expect(shiftWorkingDays('2026-11-27', 1)).toBe('2026-11-30')
    expect(shiftWorkingDays('2026-11-30', -1)).toBe('2026-11-27')
    expect(workingDayOnOrBefore('2026-11-29')).toBe('2026-11-27')
    expect(workingDays('2026-11-28', 3)).toEqual(['2026-11-30', '2026-12-01', '2026-12-02'])
  })
})

describe('scheduleOrder', () => {
  it('ends the last step on the due date and walks backwards one step per day', () => {
    const plan = scheduleOrder(
      { id: 'o1', productId: 'p', quantity: 100, dueDate: '2026-12-04' },
      cushionRouting,
      centres,
      '2026-11-30',
    )
    expect(plan.operations.map((op) => [op.workCenterId, op.start, op.end, op.minutes])).toEqual([
      ['cut', '2026-12-02', '2026-12-02', 400],
      ['sew', '2026-12-03', '2026-12-03', 900],
      ['pack', '2026-12-04', '2026-12-04', 200],
    ])
    expect(plan.startsInPast).toBe(false)
  })

  it('spreads a step longer than one day evenly over consecutive working days', () => {
    const plan = scheduleOrder(
      { id: 'o1', productId: 'p', quantity: 300, dueDate: '2026-12-07' },
      cushionRouting,
      centres,
      '2026-11-30',
    )
    // packing 600 min on a 480-min centre → 2 days, 300 each, ending Monday.
    const pack = plan.operations[2]
    expect(pack.days).toEqual([
      { date: '2026-12-04', minutes: 300 },
      { date: '2026-12-07', minutes: 300 },
    ])
    // sewing 2700 min on 1920 → 2 days ending the working day before packing starts.
    expect(plan.operations[1].days.map((d) => d.date)).toEqual(['2026-12-02', '2026-12-03'])
  })

  it('flags an order whose first step would have to start before today', () => {
    const plan = scheduleOrder(
      { id: 'o1', productId: 'p', quantity: 100, dueDate: '2026-12-01' },
      cushionRouting,
      centres,
      '2026-11-30',
    )
    expect(plan.start).toBe('2026-11-27')
    expect(plan.startsInPast).toBe(true)
  })

  it('reports a product without routing instead of inventing a schedule', () => {
    const plan = scheduleOrder({ id: 'o1', productId: 'p', quantity: 5, dueDate: '2026-12-01' }, [], centres, '2026-11-30')
    expect(plan.missingRouting).toBe(true)
    expect(plan.operations).toEqual([])
  })
})

describe('computePlan', () => {
  const base = {
    workCenters: [cutting, sewing, packing],
    routings: new Map([['p', cushionRouting]]),
    from: '2026-11-30',
    dayCount: 5,
    today: '2026-11-30',
  }

  it('adds up orders that meet on the same work centre and day, and marks the overload red', () => {
    const calm = computePlan({ ...base, orders: [{ id: 'a', productId: 'p', quantity: 120, dueDate: '2026-12-04' }] })
    const sewingCalm = calm.load.find((l) => l.workCenterId === 'sew')!
    expect(sewingCalm.cells.find((c) => c.date === '2026-12-03')).toMatchObject({ minutes: 1080, percent: 56, level: 'ok' })
    expect(calm.overloadedCells).toBe(0)

    const rush = computePlan({
      ...base,
      orders: [
        { id: 'a', productId: 'p', quantity: 120, dueDate: '2026-12-04' },
        { id: 'b', productId: 'p', quantity: 100, dueDate: '2026-12-04' },
      ],
    })
    const sewingRush = rush.load.find((l) => l.workCenterId === 'sew')!
    const day = sewingRush.cells.find((c) => c.date === '2026-12-03')!
    expect(day).toMatchObject({ minutes: 1980, percent: 103, level: 'over' })
    expect(day.orderIds.sort()).toEqual(['a', 'b'])
    expect(rush.overloadedCells).toBeGreaterThan(0)
  })

  it('moving a due date moves the load with it', () => {
    const before = computePlan({ ...base, orders: [{ id: 'a', productId: 'p', quantity: 100, dueDate: '2026-12-04' }] })
    const after = computePlan({ ...base, orders: [{ id: 'a', productId: 'p', quantity: 100, dueDate: '2026-12-03' }] })
    const packOn = (plan: typeof before, date: string) =>
      plan.load.find((l) => l.workCenterId === 'pack')!.cells.find((c) => c.date === date)!.minutes
    expect(packOn(before, '2026-12-04')).toBe(200)
    expect(packOn(after, '2026-12-04')).toBe(0)
    expect(packOn(after, '2026-12-03')).toBe(200)
  })

  it('marks a day at 85% or more as nearly full', () => {
    const plan = computePlan({ ...base, orders: [{ id: 'a', productId: 'p', quantity: 210, dueDate: '2026-12-04' }] })
    // packing 420 / 480 = 88%
    expect(plan.load.find((l) => l.workCenterId === 'pack')!.cells[4]).toMatchObject({ percent: 88, level: 'high' })
  })
})
