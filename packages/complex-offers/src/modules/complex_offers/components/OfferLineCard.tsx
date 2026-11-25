'use client'

import * as React from 'react'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Checkbox } from '@open-mercato/ui/primitives/checkbox'
import { Label } from '@open-mercato/ui/primitives/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@open-mercato/ui/primitives/select'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import type { BreakdownStep, LineSelection, ParameterKind, PricingModel } from '../lib/pricing'
import { parameterKindLabel } from '../lib/breakdown-labels'
import { formatDecimal, formatMoney } from '../lib/format'
import { PriceBreakdown } from './PriceBreakdown'
import type { LineView } from './types'

export type LineChange = { quantity?: number; selection?: LineSelection }

const SELECTION_KEY: Record<Exclude<ParameterKind, 'addon'>, keyof LineSelection> = {
  size: 'sizeOptionId',
  fabric: 'fabricOptionId',
  color: 'colorOptionId',
}

/**
 * One offer line: model, quantity, a picker per parameter, the price and —
 * one click away — the full breakdown. Editable only in a draft version; in a
 * sent one the same card is read-only and shows the frozen snapshot.
 */
export function OfferLineCard({
  index,
  line,
  rules,
  editable,
  currencyCode,
  isBusy,
  lastChange,
  isExpanded,
  onToggleExpanded,
  onChange,
  onRemove,
}: {
  index: number
  line: LineView
  rules: PricingModel | null
  editable: boolean
  currencyCode: string
  isBusy: boolean
  /** The breakdown and total from before the last change of THIS line, if any. */
  lastChange: { previousTotal: string; previousSteps: BreakdownStep[] } | null
  isExpanded: boolean
  onToggleExpanded: () => void
  onChange: (change: LineChange) => void
  onRemove: () => void
}) {
  const t = useT()
  const locale = useLocale()
  const translate = React.useCallback(
    (key: string, fallback: string, params?: Record<string, string | number>) => t(key, fallback, params),
    [t],
  )
  const [quantity, setQuantity] = React.useState(String(line.quantity))
  React.useEffect(() => setQuantity(String(line.quantity)), [line.quantity])

  const canEdit = editable && rules !== null
  const money = (value: string) => formatMoney(value, currencyCode, locale)
  const delta = lastChange ? Number(line.lineTotal) - Number(lastChange.previousTotal) : 0

  const commitQuantity = () => {
    const parsed = Number(quantity)
    if (!Number.isInteger(parsed) || parsed < 1) {
      setQuantity(String(line.quantity))
      return
    }
    if (parsed !== line.quantity) onChange({ quantity: parsed })
  }

  const optionsOf = (kind: ParameterKind) => rules?.options.filter((option) => option.kind === kind) ?? []
  const selectedLabel = (kind: ParameterKind) =>
    line.selected.filter((parameter) => parameter.kind === kind).map((parameter) => parameter.label)

  const singleKinds = (['size', 'fabric', 'color'] as const).filter((kind) =>
    canEdit ? optionsOf(kind).length > 0 : selectedLabel(kind).length > 0,
  )
  const addonOptions = optionsOf('addon')
  const addonIds = new Set(line.selection.addonOptionIds ?? [])

  return (
    <article
      className={cn('rounded-lg border bg-card shadow-xs transition-opacity', isBusy ? 'opacity-60' : '')}
      data-testid="offer-line"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex size-7 items-center justify-center rounded-full bg-muted text-sm font-medium tabular-nums">
            {index + 1}
          </span>
          <div>
            <div className="font-semibold">{line.modelName}</div>
            {Number(line.discountPercent) > 0 ? (
              <div className="text-xs text-muted-foreground">
                {t('complex_offers.lines.discountApplied', 'Quantity discount {percent}% applied', {
                  percent: formatDecimal(line.discountPercent, locale, 2),
                })}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Label htmlFor={`qty-${line.id}`} className="text-sm text-muted-foreground">
              {t('complex_offers.lines.quantity', 'Qty')}
            </Label>
            {canEdit ? (
              <Input
                id={`qty-${line.id}`}
                size="sm"
                className="w-20 text-right tabular-nums"
                inputMode="numeric"
                value={quantity}
                disabled={isBusy}
                onChange={(event) => setQuantity(event.target.value.replace(/[^0-9]/g, ''))}
                onBlur={commitQuantity}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    commitQuantity()
                  }
                }}
              />
            ) : (
              <span className="font-medium tabular-nums">{line.quantity}</span>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">
              {t('complex_offers.lines.unitPriceShort', '{price} / pc', { price: money(line.unitPrice) })}
            </div>
            <div className="flex items-center justify-end gap-2">
              {lastChange && delta !== 0 ? (
                <StatusBadge variant={delta > 0 ? 'warning' : 'success'}>
                  <span className="tabular-nums" data-testid="line-delta">
                    {delta > 0 ? '+' : '−'} {money(String(Math.abs(delta)))}
                  </span>
                </StatusBadge>
              ) : null}
              <span className="text-lg font-semibold tabular-nums" data-testid="line-total">
                {money(line.lineTotal)}
              </span>
            </div>
          </div>
          {canEdit ? (
            <Button
              type="button"
              variant="destructive-ghost"
              size="icon"
              className="size-8"
              onClick={onRemove}
              disabled={isBusy}
              aria-label={t('complex_offers.common.delete', 'Delete')}
            >
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 px-4 py-3 md:grid-cols-3">
        {singleKinds.map((kind) => (
          <div key={kind} className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">{parameterKindLabel(kind, translate)}</Label>
            {canEdit ? (
              <Select
                value={(line.selection[SELECTION_KEY[kind]] as string | null | undefined) ?? undefined}
                onValueChange={(value) => onChange({ selection: { [SELECTION_KEY[kind]]: value } as LineSelection })}
                disabled={isBusy}
              >
                <SelectTrigger size="sm" className="w-full" data-testid={`param-${kind}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {optionsOf(kind).map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                      {kind === 'fabric'
                        ? ` · ${money(option.fabricPricePerMeter)}/m`
                        : Number(option.surcharge) !== 0
                          ? ` · +${money(option.surcharge)}`
                          : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-sm">{selectedLabel(kind).join(', ') || '—'}</div>
            )}
          </div>
        ))}
        {(canEdit ? addonOptions.length > 0 : selectedLabel('addon').length > 0) ? (
          <div className="space-y-1.5 md:col-span-3">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">{parameterKindLabel('addon', translate)}</Label>
            {canEdit ? (
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {addonOptions.map((option) => {
                  const id = `addon-${line.id}-${option.id}`
                  return (
                    <label key={option.id} htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        id={id}
                        checked={addonIds.has(option.id)}
                        disabled={isBusy}
                        onCheckedChange={(checked) => {
                          const next = new Set(addonIds)
                          if (checked) next.add(option.id)
                          else next.delete(option.id)
                          onChange({ selection: { addonOptionIds: Array.from(next) } })
                        }}
                      />
                      {option.label}
                      <span className="text-muted-foreground tabular-nums">+{money(option.surcharge)}</span>
                    </label>
                  )
                })}
              </div>
            ) : (
              <div className="text-sm">{selectedLabel('addon').join(', ')}</div>
            )}
          </div>
        ) : null}
      </div>

      <div className="border-t px-4 py-2">
        <Button type="button" variant="ghost" size="sm" onClick={onToggleExpanded} data-testid="toggle-breakdown">
          {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          {t('complex_offers.lines.whereFrom', 'Where does this price come from?')}
        </Button>
        {isExpanded ? (
          <div className="pb-2 pt-1">
            <PriceBreakdown steps={line.breakdown} previous={lastChange?.previousSteps ?? null} currencyCode={currencyCode} />
          </div>
        ) : null}
      </div>
    </article>
  )
}
