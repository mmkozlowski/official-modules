import type { StatusBadgeVariant } from '@open-mercato/ui/primitives/status-badge'
import type { OrderStatus, TaskStatus } from '../data/entities'

export const ORDER_STATUS_VARIANT: Record<OrderStatus, StatusBadgeVariant> = {
  new: 'neutral',
  in_progress: 'warning',
  ready_to_ship: 'success',
}

export const TASK_STATUS_VARIANT: Record<TaskStatus, StatusBadgeVariant> = {
  pending: 'neutral',
  in_progress: 'warning',
  done: 'success',
}

/** `2026-11-30` → `30.11.2026` in the user's locale, without a timezone shift. */
export function formatDate(value: string | null | undefined, locale?: string): string {
  if (!value) return '—'
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return value
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(year, month - 1, day),
  )
}

/** Whole days from today to a `YYYY-MM-DD` date; negative when it is past. */
export function daysUntil(value: string | null | undefined, now: Date = new Date()): number | null {
  if (!value) return null
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return null
  const due = new Date(year, month - 1, day).getTime()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((due - today) / 86_400_000)
}
