import type { IsoDate } from '../lib/schedule'

function asUtcDate(date: IsoDate): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** `pn 30.11` — weekday and day.month, the way a planner reads a week. */
export function formatDayHeader(date: IsoDate, locale?: string): { weekday: string; day: string } {
  const value = asUtcDate(date)
  return {
    weekday: new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(value),
    day: new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(value),
  }
}

/** `30.11.2026` */
export function formatDate(date: IsoDate | null | undefined, locale?: string): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(
    asUtcDate(date),
  )
}

/** `30.11` */
export function formatShortDate(date: IsoDate | null | undefined, locale?: string): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(asUtcDate(date))
}

/** `1 230` minutes → `20 h 30 min`. */
export function formatHours(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (!hours) return `${rest} min`
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

/** Tailwind classes per work-centre stage — kept off red/amber/green, which mean load. */
export const STAGE_CLASSES: Record<string, string> = {
  cutting: 'bg-sky-500 text-white',
  sewing: 'bg-indigo-500 text-white',
  upholstery: 'bg-fuchsia-500 text-white',
  assembly: 'bg-cyan-600 text-white',
  finishing: 'bg-violet-500 text-white',
  packing: 'bg-slate-500 text-white',
  other: 'bg-zinc-500 text-white',
}

export const LOAD_CELL_CLASSES: Record<string, string> = {
  free: 'bg-muted/40 text-muted-foreground',
  ok: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
  high: 'bg-amber-400/25 text-amber-900 dark:text-amber-200',
  over: 'bg-red-600 text-white font-semibold',
}

export const LOAD_BAR_CLASSES: Record<string, string> = {
  free: 'bg-transparent',
  ok: 'bg-emerald-500',
  high: 'bg-amber-500',
  over: 'bg-white/80',
}
