'use client'

import * as React from 'react'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import type { BreakdownStep } from '../lib/pricing'
import { describeStep } from '../lib/breakdown-labels'
import { formatMoney } from '../lib/format'

/**
 * "Where does this price come from" — every step of the formula with its
 * amount. When `previous` is given (the breakdown before the last change),
 * the steps whose amount moved are highlighted with the old value, so the
 * effect of one parameter is visible line by line.
 */
export function PriceBreakdown({
  steps,
  previous,
  currencyCode,
}: {
  steps: BreakdownStep[]
  previous?: BreakdownStep[] | null
  currencyCode: string
}) {
  const t = useT()
  const locale = useLocale()
  const translate = React.useCallback(
    (key: string, fallback: string, params?: Record<string, string | number>) => t(key, fallback, params),
    [t],
  )
  const previousByKey = React.useMemo(() => {
    const map = new Map<string, BreakdownStep>()
    for (const step of previous ?? []) map.set(`${step.code}:${step.label ?? ''}`, step)
    // A changed option (other fabric) has another label — fall back to the code.
    for (const step of previous ?? []) if (!map.has(step.code)) map.set(step.code, step)
    return map
  }, [previous])

  return (
    <div className="rounded-md border bg-muted/20" data-testid="price-breakdown">
      <table className="w-full text-sm">
        <tbody>
          {steps.map((step, index) => {
            const before = previous
              ? previousByKey.get(`${step.code}:${step.label ?? ''}`) ?? previousByKey.get(step.code)
              : undefined
            const changed = Boolean(previous) && (!before || before.amount !== step.amount)
            const isGrandTotal = step.code === 'line_total'
            return (
              <tr
                key={`${step.code}-${index}`}
                className={cn(
                  step.isTotal ? 'border-t font-medium' : '',
                  isGrandTotal ? 'bg-muted/50 text-base' : '',
                  changed ? 'bg-status-warning-bg/60' : '',
                )}
                data-changed={changed ? 'true' : undefined}
              >
                <td className={cn('px-3 py-1.5', step.isTotal ? '' : 'pl-6 text-muted-foreground')}>
                  {describeStep(step, translate, currencyCode, locale)}
                </td>
                <td className="w-40 px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                  {changed && before ? <span className="line-through">{formatMoney(before.amount, currencyCode, locale)}</span> : null}
                </td>
                <td className={cn('w-36 px-3 py-1.5 text-right tabular-nums', step.isTotal ? 'font-semibold' : '')}>
                  {!step.isTotal && Number(step.amount) > 0 ? '+ ' : ''}
                  {formatMoney(step.amount, currencyCode, locale)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
