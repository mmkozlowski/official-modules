'use client'

import * as React from 'react'
import { ArrowDown, ArrowUp, Plus, Scissors, Trash2 } from 'lucide-react'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@open-mercato/ui/primitives/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@open-mercato/ui/primitives/table'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { SectionHeader } from '@open-mercato/ui/backend/SectionHeader'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import { computeLineCost, computeMaterialCost, quantityFromSegments } from '../lib/bom-calculations'
import { formatMoney } from '../lib/format'
import type { BomView, MaterialRow } from './types'

type DraftLine = {
  key: string
  materialId: string
  quantity: string
  isSplit: boolean
  segmentCount: string
  segmentLength: string
  notes: string
}

let draftKeySeed = 0
const nextKey = () => `line-${++draftKeySeed}`

/** Accepts both "1,5" and "1.5" — a decimal comma is what a Polish keyboard types. */
function normalizeDecimal(value: string): string {
  return value.replace(',', '.').trim()
}

function isPositiveDecimal(value: string): boolean {
  const normalized = normalizeDecimal(value)
  return /^\d+(\.\d+)?$/.test(normalized) && Number(normalized) > 0
}

function draftQuantity(line: DraftLine): string | null {
  if (line.isSplit) {
    const count = Number(line.segmentCount)
    if (!Number.isInteger(count) || count < 1 || !isPositiveDecimal(line.segmentLength)) return null
    return quantityFromSegments(count, normalizeDecimal(line.segmentLength))
  }
  return isPositiveDecimal(line.quantity) ? normalizeDecimal(line.quantity) : null
}

/** Decimal separator of the UI locale, so a Polish screen shows "0,45", not "0.45". */
function decimalSeparator(locale: string | undefined): string {
  try {
    return new Intl.NumberFormat(locale).formatToParts(1.5).find((part) => part.type === 'decimal')?.value ?? '.'
  } catch {
    return '.'
  }
}

function toDraft(view: BomView, separator: string): DraftLine[] {
  const show = (value: string) => String(Number(value)).replace('.', separator)
  return view.lines.map((line) => ({
    key: nextKey(),
    materialId: line.materialId,
    quantity: show(line.quantity),
    isSplit: line.segmentCount != null && line.segmentLength != null,
    segmentCount: line.segmentCount != null ? String(line.segmentCount) : '',
    segmentLength: line.segmentLength != null ? show(line.segmentLength) : '',
    notes: line.notes ?? '',
  }))
}

/**
 * The BOM editor: pick a material, enter a quantity in the material's unit, or
 * split the line into pieces ("3 × 1.40 m" instead of "4.20 m") — the sewing
 * room cuts pieces, not a sum of metres. Cost per line and the material cost of
 * one unit update as you type, using the same arithmetic the server uses.
 *
 * Fabric materials are not offered: fabric is chosen per order (see the
 * requirements calculator below), never part of the product's recipe.
 */
export function BomEditor({
  productId,
  bom,
  materials,
  onSaved,
}: {
  productId: string
  bom: BomView
  materials: MaterialRow[]
  onSaved: (view: BomView) => void
}) {
  const t = useT()
  const locale = useLocale()
  const separator = React.useMemo(() => decimalSeparator(locale), [locale])
  const [lines, setLines] = React.useState<DraftLine[]>(() => toDraft(bom, separator))
  const [isDirty, setIsDirty] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    setLines(toDraft(bom, separator))
    setIsDirty(false)
  }, [bom, separator])

  const bomMaterials = React.useMemo(() => materials.filter((material) => material.material_type !== 'fabric'), [materials])
  const materialById = React.useMemo(() => {
    const map = new Map<string, { name: string; unit: string; unitPrice: string; currencyCode: string; missing: boolean }>()
    for (const line of bom.lines) {
      map.set(line.materialId, {
        name: line.materialName,
        unit: line.unit,
        unitPrice: line.unitPrice,
        currencyCode: line.currencyCode,
        missing: line.materialMissing,
      })
    }
    for (const material of materials) {
      map.set(material.id, {
        name: material.name,
        unit: material.unit,
        unitPrice: material.unit_price,
        currencyCode: material.currency_code,
        missing: false,
      })
    }
    return map
  }, [bom.lines, materials])

  const update = (key: string, patch: Partial<DraftLine>) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))
    setIsDirty(true)
  }
  const remove = (key: string) => {
    setLines((current) => current.filter((line) => line.key !== key))
    setIsDirty(true)
  }
  const move = (key: string, direction: -1 | 1) => {
    setLines((current) => {
      const index = current.findIndex((line) => line.key === key)
      const target = index + direction
      if (index < 0 || target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    setIsDirty(true)
  }
  const add = () => {
    setLines((current) => [
      ...current,
      { key: nextKey(), materialId: '', quantity: '1', isSplit: false, segmentCount: '', segmentLength: '', notes: '' },
    ])
    setIsDirty(true)
  }
  const toggleSplit = (line: DraftLine) => {
    if (line.isSplit) {
      update(line.key, { isSplit: false, quantity: (draftQuantity(line) ?? line.quantity).replace('.', separator) })
    } else {
      update(line.key, { isSplit: true, segmentCount: '1', segmentLength: line.quantity })
    }
  }

  const costedLines = lines.map((line) => {
    const material = materialById.get(line.materialId)
    const quantity = draftQuantity(line)
    return {
      line,
      material,
      quantity,
      cost: material && quantity ? computeLineCost({ quantity, unitPrice: material.unitPrice }) : null,
    }
  })
  const total = computeMaterialCost(
    costedLines
      .filter((entry) => entry.material && entry.quantity)
      .map((entry) => ({ quantity: entry.quantity as string, unitPrice: entry.material!.unitPrice })),
  )
  const currency = costedLines.find((entry) => entry.material)?.material?.currencyCode ?? bom.currencyCode
  const invalidCount = costedLines.filter((entry) => !entry.material || !entry.quantity).length

  const save = async () => {
    if (invalidCount > 0) {
      flash(t('production_bom.bom.invalidLines', 'Every line needs a material and a quantity greater than zero.'), 'error')
      return
    }
    setIsSaving(true)
    const call = await apiCall<BomView>(`/api/production_bom/products/${encodeURIComponent(productId)}/bom`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        lines: lines.map((line) =>
          line.isSplit
            ? {
                materialId: line.materialId,
                segmentCount: Number(line.segmentCount),
                segmentLength: Number(normalizeDecimal(line.segmentLength)),
                notes: line.notes || null,
              }
            : { materialId: line.materialId, quantity: Number(normalizeDecimal(line.quantity)), notes: line.notes || null },
        ),
      }),
    })
    setIsSaving(false)
    if (!call.ok || !call.result) {
      const error = (call.result as unknown as { error?: string } | null)?.error
      flash(
        error === 'fabric_not_in_bom'
          ? t('production_bom.bom.fabricRefused', 'Fabric cannot be part of a BOM — it is chosen per order.')
          : t('production_bom.bom.saveFailed', 'The BOM was not saved.'),
        'error',
      )
      return
    }
    flash(t('production_bom.bom.saved', 'BOM saved ({count} lines).', { count: call.result.lines.length }), 'success')
    onSaved(call.result)
  }

  return (
    <section className="space-y-3" data-testid="bom-editor">
      <SectionHeader
        title={t('production_bom.bom.title', 'Bill of materials — per 1 unit')}
        count={lines.length}
        action={
          <div className="flex items-center gap-2">
            {isDirty ? (
              <StatusBadge variant="warning">{t('production_bom.bom.unsaved', 'Unsaved changes')}</StatusBadge>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={add}>
              <Plus className="size-4" />
              {t('production_bom.bom.addLine', 'Add material')}
            </Button>
            <Button type="button" size="sm" onClick={() => void save()} disabled={isSaving || !isDirty}>
              {t('production_bom.bom.save', 'Save BOM')}
            </Button>
          </div>
        }
      />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead className="min-w-[260px]">{t('production_bom.bom.columns.material', 'Material')}</TableHead>
              <TableHead className="min-w-[260px]">{t('production_bom.bom.columns.quantity', 'Quantity')}</TableHead>
              <TableHead className="text-right">{t('production_bom.bom.columns.unitPrice', 'Unit price')}</TableHead>
              <TableHead className="text-right">{t('production_bom.bom.columns.cost', 'Cost')}</TableHead>
              <TableHead className="w-[150px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {costedLines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {t('production_bom.bom.empty', 'No materials yet. Add foam, a zipper, cord, thread…')}
                </TableCell>
              </TableRow>
            ) : null}
            {costedLines.map(({ line, material, cost }, index) => {
              const unitLabel = material ? t(`production_bom.unit.${material.unit}`, material.unit) : ''
              return (
                <TableRow key={line.key} data-testid="bom-line">
                  <TableCell className="tabular-nums text-muted-foreground">{index + 1}</TableCell>
                  <TableCell>
                    <Select value={line.materialId || undefined} onValueChange={(value) => update(line.key, { materialId: value })}>
                      <SelectTrigger size="sm" className="w-full" aria-label={t('production_bom.bom.columns.material', 'Material')}>
                        <SelectValue placeholder={t('production_bom.bom.pickMaterial', 'Pick a material…')} />
                      </SelectTrigger>
                      <SelectContent>
                        {material?.missing ? (
                          <SelectItem value={line.materialId}>{material.name}</SelectItem>
                        ) : null}
                        {bomMaterials.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {material?.missing ? (
                      <div className="mt-1">
                        <StatusBadge variant="error">{t('production_bom.bom.materialMissing', 'Material deleted')}</StatusBadge>
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {line.isSplit ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          size="sm"
                          className="w-16"
                          inputMode="numeric"
                          value={line.segmentCount}
                          onChange={(event) => update(line.key, { segmentCount: event.target.value })}
                          aria-label={t('production_bom.bom.pieces', 'Pieces')}
                        />
                        <span className="text-sm text-muted-foreground">×</span>
                        <Input
                          size="sm"
                          className="w-20"
                          inputMode="decimal"
                          value={line.segmentLength}
                          onChange={(event) => update(line.key, { segmentLength: event.target.value })}
                          aria-label={t('production_bom.bom.pieceLength', 'Piece length')}
                        />
                        <span className="text-sm text-muted-foreground">{unitLabel}</span>
                        <span className="ml-1 text-xs tabular-nums text-muted-foreground">
                          = {(draftQuantity(line) ?? '—').replace('.', separator)} {unitLabel}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Input
                          size="sm"
                          className="w-28"
                          inputMode="decimal"
                          value={line.quantity}
                          onChange={(event) => update(line.key, { quantity: event.target.value })}
                          aria-label={t('production_bom.bom.columns.quantity', 'Quantity')}
                        />
                        <span className="text-sm text-muted-foreground">{unitLabel}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {material ? `${formatMoney(material.unitPrice, material.currencyCode, locale)} / ${unitLabel}` : '—'}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {cost && material ? formatMoney(cost, material.currencyCode, locale) : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        type="button"
                        variant={line.isSplit ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => toggleSplit(line)}
                        title={t('production_bom.bom.split', 'Split into pieces')}
                      >
                        <Scissors className="size-4" />
                        {t('production_bom.bom.splitShort', 'Split')}
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => move(line.key, -1)} aria-label={t('production_bom.bom.moveUp', 'Move up')}>
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => move(line.key, 1)} aria-label={t('production_bom.bom.moveDown', 'Move down')}>
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button type="button" variant="destructive-ghost" size="icon" className="size-8" onClick={() => remove(line.key)} aria-label={t('production_bom.common.delete', 'Delete')}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-3">
          <span className="text-sm text-muted-foreground">
            {t('production_bom.bom.totalHint', 'Fabric is not included — it is chosen per order.')}
          </span>
          <span className="text-sm">
            {t('production_bom.bom.total', 'Material cost of 1 unit')}:{' '}
            <span className="text-base font-semibold tabular-nums" data-testid="bom-total">
              {formatMoney(total, currency, locale)}
            </span>
          </span>
        </div>
      </div>
    </section>
  )
}
