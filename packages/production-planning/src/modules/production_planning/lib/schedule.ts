/**
 * Production schedule — which work centre does what on which day, and how full
 * each work centre is.
 *
 * Backward scheduling from the due date, with infinite capacity:
 *
 * - The LAST step of an order's routing ends on the order's due date; each
 *   earlier step ends on the working day before the next one starts. Steps of
 *   one order never share a day, so the Gantt bar reads left-to-right as the
 *   order moves through the workshop.
 * - A step takes `max(1, ceil(minutes / dailyCapacity))` working days and its
 *   minutes are split evenly across them, so a single order never fills more
 *   than one work centre's day on its own.
 * - Capacity is NOT respected — two orders that land on the same work centre on
 *   the same day simply add up. That is the point: the plan shows overload
 *   instead of hiding it by silently pushing work around. Deciding what moves
 *   is the planner's job, the screen's job is to make the conflict visible.
 *
 * Pure functions on ISO date strings (`YYYY-MM-DD`, UTC arithmetic), no ORM or
 * framework imports — the plan page recomputes the whole plan in the browser
 * from the same code the server uses, which is what makes a moved due date
 * repaint instantly.
 */

export type IsoDate = string

export type ScheduleWorkCenter = {
  id: string
  dailyCapacityMinutes: number
}

export type ScheduleRoutingStep = {
  workCenterId: string
  sequence: number
  minutesPerUnit: number
  setupMinutes?: number
}

export type ScheduleOrder = {
  id: string
  productId: string
  quantity: number
  dueDate: IsoDate
}

export type ScheduledDay = { date: IsoDate; minutes: number }

export type ScheduledOperation = {
  workCenterId: string
  sequence: number
  minutes: number
  start: IsoDate
  end: IsoDate
  days: ScheduledDay[]
}

export type ScheduledOrder = {
  orderId: string
  operations: ScheduledOperation[]
  start: IsoDate | null
  end: IsoDate | null
  /** The first operation would have to start before `today` — the due date is at risk. */
  startsInPast: boolean
  /** The product has no routing, so the order cannot be placed on the plan. */
  missingRouting: boolean
}

export type LoadLevel = 'free' | 'ok' | 'high' | 'over'

export type LoadCell = {
  date: IsoDate
  minutes: number
  capacityMinutes: number
  /** Whole percent, rounded half-up. 0 when the work centre has no capacity. */
  percent: number
  level: LoadLevel
  orderIds: string[]
}

export type WorkCenterLoad = {
  workCenterId: string
  cells: LoadCell[]
  peakPercent: number
  overloadedDays: number
}

export type PlanResult = {
  days: IsoDate[]
  orders: ScheduledOrder[]
  load: WorkCenterLoad[]
  overloadedCells: number
}

/** At or above this share of capacity a day is shown as "nearly full". */
export const HIGH_LOAD_PERCENT = 85

const DAY_MS = 86_400_000
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function toUtcMs(date: IsoDate): number {
  if (!ISO_PATTERN.test(date)) throw new Error(`Not an ISO date: "${date}"`)
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function fromUtcMs(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10)
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS)
}

/** Monday–Friday. Holidays are out of scope for this module. */
export function isWorkingDay(date: IsoDate): boolean {
  const weekday = new Date(toUtcMs(date)).getUTCDay()
  return weekday !== 0 && weekday !== 6
}

/** The date itself when it is a working day, otherwise the nearest earlier one. */
export function workingDayOnOrBefore(date: IsoDate): IsoDate {
  let cursor = date
  while (!isWorkingDay(cursor)) cursor = addDays(cursor, -1)
  return cursor
}

/** The date itself when it is a working day, otherwise the nearest later one. */
export function workingDayOnOrAfter(date: IsoDate): IsoDate {
  let cursor = date
  while (!isWorkingDay(cursor)) cursor = addDays(cursor, 1)
  return cursor
}

/** Moves by `count` working days (negative = back). `count = 0` returns the date unchanged. */
export function shiftWorkingDays(date: IsoDate, count: number): IsoDate {
  let cursor = date
  const step = count < 0 ? -1 : 1
  for (let moved = 0; moved < Math.abs(count); ) {
    cursor = addDays(cursor, step)
    if (isWorkingDay(cursor)) moved += 1
  }
  return cursor
}

/** `count` consecutive working days starting at `from` (or the next working day after it). */
export function workingDays(from: IsoDate, count: number): IsoDate[] {
  const days: IsoDate[] = []
  let cursor = workingDayOnOrAfter(from)
  while (days.length < count) {
    days.push(cursor)
    cursor = workingDayOnOrAfter(addDays(cursor, 1))
  }
  return days
}

/** Total minutes of one routing step for `quantity` units. */
export function stepMinutes(step: ScheduleRoutingStep, quantity: number): number {
  return Math.max(0, Math.round(step.minutesPerUnit * quantity + (step.setupMinutes ?? 0)))
}

/** Splits `total` across `parts` integers that differ by at most one, larger parts first. */
function splitEvenly(total: number, parts: number): number[] {
  const base = Math.floor(total / parts)
  const remainder = total - base * parts
  return Array.from({ length: parts }, (_, index) => base + (index < remainder ? 1 : 0))
}

export function scheduleOrder(
  order: ScheduleOrder,
  routing: ReadonlyArray<ScheduleRoutingStep>,
  workCenters: ReadonlyMap<string, ScheduleWorkCenter>,
  today: IsoDate,
): ScheduledOrder {
  const steps = [...routing].sort((a, b) => a.sequence - b.sequence)
  if (!steps.length) {
    return { orderId: order.id, operations: [], start: null, end: null, startsInPast: false, missingRouting: true }
  }
  const operations: ScheduledOperation[] = []
  let cursor = workingDayOnOrBefore(order.dueDate)
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index]
    const capacity = workCenters.get(step.workCenterId)?.dailyCapacityMinutes ?? 0
    const minutes = stepMinutes(step, order.quantity)
    const dayCount = capacity > 0 ? Math.max(1, Math.ceil(minutes / capacity)) : 1
    const dates: IsoDate[] = [cursor]
    while (dates.length < dayCount) dates.unshift(shiftWorkingDays(dates[0], -1))
    const shares = splitEvenly(minutes, dayCount)
    operations.unshift({
      workCenterId: step.workCenterId,
      sequence: step.sequence,
      minutes,
      start: dates[0],
      end: dates[dates.length - 1],
      days: dates.map((date, dayIndex) => ({ date, minutes: shares[dayIndex] })),
    })
    cursor = shiftWorkingDays(dates[0], -1)
  }
  const start = operations[0].start
  return {
    orderId: order.id,
    operations,
    start,
    end: operations[operations.length - 1].end,
    startsInPast: toUtcMs(start) < toUtcMs(today),
    missingRouting: false,
  }
}

export function loadLevel(percent: number, minutes: number): LoadLevel {
  if (minutes <= 0) return 'free'
  if (percent > 100) return 'over'
  if (percent >= HIGH_LOAD_PERCENT) return 'high'
  return 'ok'
}

/**
 * The whole plan for a window of working days: every order scheduled, and the
 * load of every work centre on every day of the window.
 */
export function computePlan(input: {
  workCenters: ReadonlyArray<ScheduleWorkCenter>
  routings: ReadonlyMap<string, ReadonlyArray<ScheduleRoutingStep>>
  orders: ReadonlyArray<ScheduleOrder>
  from: IsoDate
  dayCount: number
  today: IsoDate
}): PlanResult {
  const days = workingDays(input.from, input.dayCount)
  const centres = new Map(input.workCenters.map((centre) => [centre.id, centre]))
  const orders = input.orders.map((order) =>
    scheduleOrder(order, input.routings.get(order.productId) ?? [], centres, input.today),
  )

  const minutesByCell = new Map<string, { minutes: number; orderIds: Set<string> }>()
  for (const scheduled of orders) {
    for (const operation of scheduled.operations) {
      for (const day of operation.days) {
        const key = `${operation.workCenterId}|${day.date}`
        const cell = minutesByCell.get(key) ?? { minutes: 0, orderIds: new Set<string>() }
        cell.minutes += day.minutes
        cell.orderIds.add(scheduled.orderId)
        minutesByCell.set(key, cell)
      }
    }
  }

  let overloadedCells = 0
  const load: WorkCenterLoad[] = input.workCenters.map((centre) => {
    const cells = days.map((date): LoadCell => {
      const entry = minutesByCell.get(`${centre.id}|${date}`)
      const minutes = entry?.minutes ?? 0
      const capacity = centre.dailyCapacityMinutes
      const percent = capacity > 0 ? Math.round((minutes * 100) / capacity) : minutes > 0 ? 999 : 0
      return {
        date,
        minutes,
        capacityMinutes: capacity,
        percent,
        level: loadLevel(percent, minutes),
        orderIds: entry ? Array.from(entry.orderIds) : [],
      }
    })
    const overloadedDays = cells.filter((cell) => cell.level === 'over').length
    overloadedCells += overloadedDays
    return {
      workCenterId: centre.id,
      cells,
      peakPercent: cells.reduce((peak, cell) => Math.max(peak, cell.percent), 0),
      overloadedDays,
    }
  })

  return { days, orders, load, overloadedCells }
}
