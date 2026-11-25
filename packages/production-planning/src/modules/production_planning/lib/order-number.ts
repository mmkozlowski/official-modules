import type { EntityManager } from '@mikro-orm/postgresql'
import { ProductionOrder } from '../data/entities'
import type { Scope } from './plan-repository'
import { formatOrderNumber, sequenceOf } from './order-number-format'

export { formatOrderNumber, sequenceOf }

/**
 * Next `ZP/<year>/<seq>` in the organisation: one above the highest LIVE order.
 * Deleted orders are not counted, so after the demo data is reset the urgent
 * order recorded on camera always gets the same number — a deliberate demo-era
 * trade-off (a deleted number can be reused). Not race-proof under concurrent
 * creates; the number stays editable on the order.
 */
export async function nextOrderNumber(em: EntityManager, scope: Scope, dueDate: string): Promise<string> {
  const year = dueDate.slice(0, 4)
  const existing = await em.find(
    ProductionOrder,
    { tenantId: scope.tenantId, organizationId: scope.organizationId, deletedAt: null, number: { $like: `ZP/${year}/%` } },
    { fields: ['number'] },
  )
  const highest = existing.reduce((max, order) => Math.max(max, sequenceOf(order.number, year)), 0)
  return formatOrderNumber(year, highest + 1)
}
