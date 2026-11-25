'use client'

import * as React from 'react'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import { formatDecimal } from '@open-mercato/production-bom/modules/production_bom/lib/format'
import type { PlanInput, RequirementLine } from '../lib/plan-model'
import { formatDate } from './planFormat'

/**
 * What the warehouse has to issue for the orders on screen, per material: the
 * norm from the BOM, the quantity with the cutting allowance, and the first day
 * it is needed (the first operation of the earliest order that uses it).
 */
export function RequirementsTable({
  lines,
  input,
  changedMaterials,
  title,
  description,
}: {
  lines: RequirementLine[]
  input: PlanInput
  changedMaterials?: ReadonlySet<string>
  title?: string
  description?: string
}) {
  const t = useT()
  const locale = useLocale()
  const numbers = React.useMemo(() => new Map(input.orders.map((order) => [order.id, order.number])), [input.orders])
  return (
    <section aria-labelledby="plan-requirements-heading" className="space-y-2">
      <div>
        <h2 id="plan-requirements-heading" className="text-base font-semibold">
          {title ?? t('production_planning.requirements.title', 'Material requirements')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {description ??
            t(
              'production_planning.requirements.description',
              'From the BOM of every order in this window: norm, quantity to issue with the cutting allowance, and the day the first operation needs it.',
            )}
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">{t('production_planning.requirements.columns.material', 'Material')}</th>
              <th className="px-3 py-2 font-medium">{t('production_planning.requirements.columns.neededBy', 'Needed by')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('production_planning.requirements.columns.issue', 'To issue')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('production_planning.requirements.columns.norm', 'Norm')}</th>
              <th className="px-3 py-2 font-medium">{t('production_planning.requirements.columns.orders', 'Orders')}</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  {t('production_planning.requirements.empty', 'No orders in this window — nothing to issue.')}
                </td>
              </tr>
            ) : null}
            {lines.map((line) => {
              const unit = t(`production_bom.unit.${line.unit}`, line.unit)
              const changed = changedMaterials?.has(line.materialId)
              return (
                <tr
                  key={line.materialId}
                  className={`border-b last:border-b-0 transition-colors duration-700 ${changed ? 'bg-primary/10' : ''}`}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{line.name}</span>
                      {line.isFabric ? (
                        <StatusBadge variant="info">{t('production_planning.requirements.fabric', 'fabric chosen per order')}</StatusBadge>
                      ) : null}
                    </div>
                    {line.code ? <div className="text-xs text-muted-foreground">{line.code}</div> : null}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{formatDate(line.neededBy, locale)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {formatDecimal(line.requiredQuantity, locale, 3)} {unit}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {formatDecimal(line.normQuantity, locale, 3)} {unit}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {line.orderIds.map((id) => numbers.get(id) ?? '—').join(', ')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
