'use client'

import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Checkbox } from '@open-mercato/ui/primitives/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@open-mercato/ui/primitives/table'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { SectionHeader } from '@open-mercato/ui/backend/SectionHeader'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { PARAMETER_KINDS, type ParameterKind, type PricingModel } from '../lib/pricing'
import { parameterKindLabel } from '../lib/breakdown-labels'
import type { RulesResponse } from './types'

type DraftOption = {
  key: string
  id?: string
  kind: ParameterKind
  label: string
  surcharge: string
  sizeFactor: string
  fabricPricePerMeter: string
  isDefault: boolean
}
type DraftTier = { key: string; minQuantity: string; percent: string }

let seed = 0
const nextKey = () => `rule-${++seed}`
const show = (value: string) => String(Number(value)).replace('.', ',')
const parse = (value: string) => Number(String(value).replace(',', '.').trim())

function toDraft(pricing: PricingModel): { options: DraftOption[]; tiers: DraftTier[] } {
  return {
    options: pricing.options.map((option) => ({
      key: nextKey(),
      id: option.id,
      kind: option.kind,
      label: option.label,
      surcharge: show(option.surcharge),
      sizeFactor: show(option.sizeFactor),
      fabricPricePerMeter: show(option.fabricPricePerMeter),
      isDefault: Boolean(option.isDefault),
    })),
    tiers: pricing.quantityDiscounts.map((tier) => ({ key: nextKey(), minQuantity: String(tier.minQuantity), percent: show(String(tier.percent)) })),
  }
}

/**
 * The price list of one model: per parameter its values and surcharges, plus
 * quantity discount tiers. Saved as a whole. Changing it re-prices only DRAFT
 * versions (on their next change or copy) — a sent offer keeps its snapshot.
 */
export function PricingRulesEditor({ modelId, pricing, onSaved }: { modelId: string; pricing: PricingModel; onSaved: (pricing: PricingModel) => void }) {
  const t = useT()
  const translate = React.useCallback((key: string, fallback: string) => t(key, fallback), [t])
  const [draft, setDraft] = React.useState(() => toDraft(pricing))
  const [isDirty, setIsDirty] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    setDraft(toDraft(pricing))
    setIsDirty(false)
  }, [pricing])

  const updateOption = (key: string, patch: Partial<DraftOption>) => {
    setDraft((current) => ({ ...current, options: current.options.map((option) => (option.key === key ? { ...option, ...patch } : option)) }))
    setIsDirty(true)
  }
  const setDefault = (option: DraftOption) => {
    setDraft((current) => ({
      ...current,
      options: current.options.map((candidate) =>
        candidate.kind === option.kind ? { ...candidate, isDefault: candidate.key === option.key } : candidate,
      ),
    }))
    setIsDirty(true)
  }
  const removeOption = (key: string) => {
    setDraft((current) => ({ ...current, options: current.options.filter((option) => option.key !== key) }))
    setIsDirty(true)
  }
  const addOption = (kind: ParameterKind) => {
    setDraft((current) => ({
      ...current,
      options: [...current.options, { key: nextKey(), kind, label: '', surcharge: '0', sizeFactor: '1', fabricPricePerMeter: '0', isDefault: false }],
    }))
    setIsDirty(true)
  }
  const updateTier = (key: string, patch: Partial<DraftTier>) => {
    setDraft((current) => ({ ...current, tiers: current.tiers.map((tier) => (tier.key === key ? { ...tier, ...patch } : tier)) }))
    setIsDirty(true)
  }

  const save = async () => {
    const invalid = draft.options.some((option) => !option.label.trim() || !Number.isFinite(parse(option.surcharge)))
    if (invalid) {
      flash(t('complex_offers.rules.invalid', 'Every value needs a name and a number in the surcharge.'), 'error')
      return
    }
    setIsSaving(true)
    const call = await apiCall<RulesResponse>(`/api/complex_offers/models/${encodeURIComponent(modelId)}/rules`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        options: draft.options.map((option) => ({
          id: option.id,
          kind: option.kind,
          label: option.label.trim(),
          surcharge: parse(option.surcharge),
          sizeFactor: parse(option.sizeFactor) || 1,
          fabricPricePerMeter: parse(option.fabricPricePerMeter) || 0,
          isDefault: option.isDefault,
        })),
        quantityDiscounts: draft.tiers
          .filter((tier) => tier.minQuantity.trim())
          .map((tier) => ({ minQuantity: parse(tier.minQuantity), percent: parse(tier.percent) || 0 })),
      }),
    })
    setIsSaving(false)
    if (!call.ok || !call.result?.pricing) {
      flash(t('complex_offers.rules.saveFailed', 'The price list was not saved.'), 'error')
      return
    }
    flash(t('complex_offers.rules.saved', 'Price list saved.'), 'success')
    onSaved(call.result.pricing)
  }

  return (
    <section className="space-y-4" data-testid="pricing-rules">
      <SectionHeader
        title={t('complex_offers.rules.title', 'Price list — parameters and surcharges')}
        count={draft.options.length}
        action={
          <div className="flex items-center gap-2">
            {isDirty ? <StatusBadge variant="warning">{t('complex_offers.common.unsaved', 'Unsaved changes')}</StatusBadge> : null}
            <Button type="button" size="sm" onClick={() => void save()} disabled={isSaving || !isDirty}>
              {t('complex_offers.rules.save', 'Save price list')}
            </Button>
          </div>
        }
      />
      {PARAMETER_KINDS.map((kind) => {
        const rows = draft.options.filter((option) => option.kind === kind)
        return (
          <div key={kind} className="rounded-md border">
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
              <span className="text-sm font-medium">{parameterKindLabel(kind, translate)}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => addOption(kind)}>
                <Plus className="size-4" />
                {t('complex_offers.rules.addValue', 'Add value')}
              </Button>
            </div>
            {rows.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[240px]">{t('complex_offers.rules.columns.value', 'Value')}</TableHead>
                    {kind === 'fabric' ? (
                      <TableHead className="text-right">{t('complex_offers.rules.columns.pricePerMeter', 'Price / m')}</TableHead>
                    ) : (
                      <TableHead className="text-right">{t('complex_offers.rules.columns.surcharge', 'Surcharge / pc')}</TableHead>
                    )}
                    {kind === 'size' ? <TableHead className="text-right">{t('complex_offers.rules.columns.sizeFactor', 'Material factor')}</TableHead> : null}
                    {kind !== 'addon' ? <TableHead className="w-24 text-center">{t('complex_offers.rules.columns.default', 'Default')}</TableHead> : null}
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((option) => (
                    <TableRow key={option.key}>
                      <TableCell>
                        <Input size="sm" value={option.label} onChange={(event) => updateOption(option.key, { label: event.target.value })} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          size="sm"
                          inputMode="decimal"
                          className="ml-auto w-28 text-right tabular-nums"
                          value={kind === 'fabric' ? option.fabricPricePerMeter : option.surcharge}
                          onChange={(event) =>
                            updateOption(option.key, kind === 'fabric' ? { fabricPricePerMeter: event.target.value } : { surcharge: event.target.value })
                          }
                        />
                      </TableCell>
                      {kind === 'size' ? (
                        <TableCell className="text-right">
                          <Input
                            size="sm"
                            inputMode="decimal"
                            className="ml-auto w-24 text-right tabular-nums"
                            value={option.sizeFactor}
                            onChange={(event) => updateOption(option.key, { sizeFactor: event.target.value })}
                          />
                        </TableCell>
                      ) : null}
                      {kind !== 'addon' ? (
                        <TableCell className="text-center">
                          <Checkbox checked={option.isDefault} onCheckedChange={() => setDefault(option)} aria-label={t('complex_offers.rules.columns.default', 'Default')} />
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <Button
                          type="button"
                          variant="destructive-ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => removeOption(option.key)}
                          aria-label={t('complex_offers.common.delete', 'Delete')}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                {t('complex_offers.rules.noValues', 'This model has no such parameter.')}
              </div>
            )}
          </div>
        )
      })}

      <div className="rounded-md border">
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
          <span className="text-sm font-medium">{t('complex_offers.rules.discounts', 'Quantity discounts')}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft((current) => ({ ...current, tiers: [...current.tiers, { key: nextKey(), minQuantity: '', percent: '' }] }))
              setIsDirty(true)
            }}
          >
            <Plus className="size-4" />
            {t('complex_offers.rules.addTier', 'Add tier')}
          </Button>
        </div>
        <div className="flex flex-wrap gap-4 px-4 py-3">
          {draft.tiers.length === 0 ? (
            <span className="text-sm text-muted-foreground">{t('complex_offers.rules.noTiers', 'No quantity discounts.')}</span>
          ) : null}
          {draft.tiers.map((tier) => (
            <div key={tier.key} className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm">
              <span className="text-muted-foreground">{t('complex_offers.rules.from', 'from')}</span>
              <Input size="sm" className="w-16 text-right tabular-nums" inputMode="numeric" value={tier.minQuantity} onChange={(event) => updateTier(tier.key, { minQuantity: event.target.value })} />
              <span className="text-muted-foreground">{t('complex_offers.rules.pcs', 'pcs')} →</span>
              <Input size="sm" className="w-16 text-right tabular-nums" inputMode="decimal" value={tier.percent} onChange={(event) => updateTier(tier.key, { percent: event.target.value })} />
              <span className="text-muted-foreground">%</span>
              <Button
                type="button"
                variant="destructive-ghost"
                size="icon"
                className="size-7"
                onClick={() => {
                  setDraft((current) => ({ ...current, tiers: current.tiers.filter((candidate) => candidate.key !== tier.key) }))
                  setIsDirty(true)
                }}
                aria-label={t('complex_offers.common.delete', 'Delete')}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
