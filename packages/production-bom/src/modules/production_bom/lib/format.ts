/**
 * Display formatting. Values arrive as decimal strings from `numeric` columns
 * and from `bom-calculations`; they are only turned into numbers here, at the
 * last step, for `Intl` to render.
 */

export function formatMoney(value: string | number, currencyCode: string, locale?: string): string {
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount)) return '—'
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode || 'PLN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currencyCode}`
  }
}

export function formatDecimal(value: string | number, locale?: string, maximumFractionDigits: number = 6): string {
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount)) return '—'
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(amount)
}

/** `90` → `1 h 30 min`; `3600` → `60 h`. */
export function formatMinutes(minutes: number): { hours: number; minutes: number } {
  const total = Math.max(0, Math.trunc(minutes))
  return { hours: Math.floor(total / 60), minutes: total % 60 }
}
