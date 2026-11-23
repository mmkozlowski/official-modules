'use client'

import * as React from 'react'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@open-mercato/ui/primitives/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@open-mercato/ui/primitives/table'
import { SectionHeader } from '@open-mercato/ui/backend/SectionHeader'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import { computeRequirements, type RequirementRow } from '../lib/bom-calculations'
import { formatDecimal, formatMinutes, formatMoney } from '../lib/format'
import type { BomView, MaterialRow } from './types'

const NO_FABRIC = '__none__'

/**
 * "How much do I need for 200 cushions?" — the requirement for N units, per
 * material: the norm, the allowance, what to issue, and the cut list for split
 * lines. Fabric is picked here, per order, and reported on its own row next to
 * the BOM materials, never added into the product's material cost.
 *
 * Computed in the browser from the saved BOM with the same arithmetic the API
 * uses, so the numbers react while the units are being typed.
 */
export function RequirementsCalculator({
  bom,
  fabrics,
  laborMinutes,
  fabricConsumption,
}: {
  bom: BomView
  fabrics: MaterialRow[]
  laborMinutes: number
  fabricConsumption: string
}) {
  const t = useT()
  const locale = useLocale()
  const [unitsText, setUnitsText] = React.useState('200')
  const [fabricId, setFabricId] = React.useState<string>(NO_FABRIC)

  const units = /^\d+$/.test(unitsText.trim()) ? Math.min(Number(unitsText.trim()), 1_000_000) : 0
  const fabric = fabrics.find((item) => item.id === fabricId) ?? null
  const hasFabricConsumption = Number(fabricConsumption) > 0

  const lineById = new Map(bom.lines.map((line) => [line.materialId, line]))
  const result = computeRequirements(
    bom.lines
      .filter((line) => !line.materialMissing)
      .map((line) => ({
        materialId: line.materialId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        wastePercent: line.wastePercent,
        segmentCount: line.segmentCount,
        segmentLength: line.segmentLength,
      })),
    units,
    laborMinutes,
    fabric && hasFabricConsumption
      ? {
          choice: { materialId: fabric.id, unitPrice: fabric.unit_price, wastePercent: fabric.waste_percent },
          consumptionPerUnit: fabricConsumption,
        }
      : null,
  )
  const currency = bom.currencyCode
  const labor = formatMinutes(result.laborMinutes)

  const renderRow = (row: RequirementRow, name: string, unit: string, highlight: boolean) => {
    const unitLabel = t(`production_bom.unit.${unit}`, unit)
    return (
      <TableRow key={`${highlight ? 'fabric' : 'bom'}-${row.materialId}`} className={highlight ? 'bg-muted/40' : undefined} data-testid="requirement-row">
        <TableCell className="font-medium">
          {name}
          {highlight ? (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {t('production_bom.requirements.fabricFromOrder', 'fabric for this order — outside product cost')}
            </span>
          ) : null}
        </TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">
          {formatDecimal(row.quantityPerUnit, locale)} {unitLabel}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {formatDecimal(row.normQuantity, locale)} {unitLabel}
        </TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">
          {Number(row.wastePercent) > 0 ? `+${formatDecimal(row.wastePercent, locale, 2)}%` : '—'}
        </TableCell>
        <TableCell className="text-right font-semibold tabular-nums">
          {formatDecimal(row.requiredQuantity, locale, 3)} {unitLabel}
        </TableCell>
        <TableCell className="tabular-nums text-muted-foreground">
          {row.pieces.length
            ? row.pieces
                .map((piece) =>
                  t('production_bom.requirements.piecesOf', '{count} × {length} {unit}', {
                    count: piece.count,
                    length: formatDecimal(piece.length, locale),
                    unit: unitLabel,
                  }),
                )
                .join(', ')
            : '—'}
        </TableCell>
        <TableCell className="text-right tabular-nums">{formatMoney(row.cost, currency, locale)}</TableCell>
      </TableRow>
    )
  }

  return (
    <section className="space-y-3" data-testid="requirements">
      <SectionHeader title={t('production_bom.requirements.title', 'Material requirement for an order')} />
      <div className="flex flex-wrap items-end gap-4 rounded-md border p-4">
        <div className="space-y-1.5">
          <Label htmlFor="requirement-units">{t('production_bom.requirements.units', 'Units to make')}</Label>
          <Input
            id="requirement-units"
            className="w-32"
            inputMode="numeric"
            value={unitsText}
            onChange={(event) => setUnitsText(event.target.value)}
          />
        </div>
        <div className="min-w-[280px] space-y-1.5">
          <Label>{t('production_bom.requirements.fabric', 'Fabric for this order')}</Label>
          <Select value={fabricId} onValueChange={setFabricId} disabled={!hasFabricConsumption}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_FABRIC}>{t('production_bom.requirements.noFabric', 'No fabric (BOM materials only)')}</SelectItem>
              {fabrics.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto grid grid-cols-3 gap-6 text-right">
          <div>
            <div className="text-xs text-muted-foreground">{t('production_bom.requirements.normCost', 'Materials at norm')}</div>
            <div className="text-base font-semibold tabular-nums">{formatMoney(result.normMaterialCost, currency, locale)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{t('production_bom.requirements.issuedCost', 'Materials to issue (with allowance)')}</div>
            <div className="text-base font-semibold tabular-nums" data-testid="requirements-total">
              {formatMoney(result.materialCost, currency, locale)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{t('production_bom.requirements.labor', 'Labour')}</div>
            <div className="text-base font-semibold tabular-nums">
              {t('production_bom.requirements.laborValue', '{hours} h {minutes} min', {
                hours: labor.hours,
                minutes: labor.minutes,
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('production_bom.bom.columns.material', 'Material')}</TableHead>
              <TableHead className="text-right">{t('production_bom.requirements.columns.perUnit', 'Norm / unit')}</TableHead>
              <TableHead className="text-right">{t('production_bom.requirements.columns.norm', 'Norm × {units}', { units })}</TableHead>
              <TableHead className="text-right">{t('production_bom.requirements.columns.allowance', 'Allowance')}</TableHead>
              <TableHead className="text-right">{t('production_bom.requirements.columns.issue', 'To issue')}</TableHead>
              <TableHead>{t('production_bom.requirements.columns.pieces', 'Cut list')}</TableHead>
              <TableHead className="text-right">{t('production_bom.bom.columns.cost', 'Cost')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.length === 0 && !result.fabric ? (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                  {t('production_bom.requirements.empty', 'Save a BOM first — the requirement is calculated from it.')}
                </TableCell>
              </TableRow>
            ) : null}
            {result.rows.map((row) => {
              const line = lineById.get(row.materialId)
              return renderRow(row, line?.materialName ?? '—', line?.unit ?? 'pcs', false)
            })}
            {result.fabric && fabric ? renderRow(result.fabric, fabric.name, fabric.unit, true) : null}
          </TableBody>
        </Table>
      </div>
      {!hasFabricConsumption ? (
        <p className="text-xs text-muted-foreground">
          {t('production_bom.requirements.noFabricConsumption', 'This product has no fabric consumption set, so no fabric is calculated.')}
        </p>
      ) : null}
    </section>
  )
}
