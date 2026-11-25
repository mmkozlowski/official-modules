import type { EntityManager } from '@mikro-orm/postgresql'
import { ProductionOrder } from '../data/entities'
import type { Scope } from './plan-repository'

/** `ZP/2026/7` → 7; anything else → 0. */
export function sequenceOf(number: string, year: string): number {
  const match = new RegExp(`^ZP/${year}/(\\d+)$`).exec(number)
  return match ? Number(match[1]) : 0
}

export function formatOrderNumber(year: string, sequence: number): string {
  return `ZP/${year}/${String(sequence).padStart(3, '0')}`
}

/**
 * Next free `ZP/<year>/<seq>` in the organisation. Counts soft-deleted orders
 * too, so a number is never handed out twice. Not race-proof under concurrent
 * creates — acceptable for a planner's screen, and the number is editable.
 */
export async function nextOrderNumber(em: EntityManager, scope: Scope, dueDate: string): Promise<string> {
  const year = dueDate.slice(0, 4)
  const existing = await em.find(
    ProductionOrder,
    { tenantId: scope.tenantId, organizationId: scope.organizationId, number: { $like: `ZP/${year}/%` } },
    { fields: ['number'] },
  )
  const highest = existing.reduce((max, order) => Math.max(max, sequenceOf(order.number, year)), 0)
  return formatOrderNumber(year, highest + 1)
}
