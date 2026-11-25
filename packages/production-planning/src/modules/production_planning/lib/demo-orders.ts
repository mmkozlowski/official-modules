import { demoData } from './demo-data'
import { formatOrderNumber } from './order-number-format'
import { shiftWorkingDays, workingDayOnOrAfter, type IsoDate } from './schedule'

/**
 * Demo data turned into absolute dates. Pure (no ORM), so the seed and the
 * recording's reset script (`docs/recording/production-planning/reset-demo.cjs`,
 * which imports the built file) produce the very same orders.
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
export const DEMO_ROUTINGS: Readonly<Record<string, ReadonlyArray<DemoRoutingStep>>> = demoData.routings
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
