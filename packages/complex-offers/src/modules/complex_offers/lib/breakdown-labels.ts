import type { BreakdownStep, ParameterKind } from './pricing'
import { formatDecimal, formatMoney } from './format'

type Translate = (key: string, fallback: string, params?: Record<string, string | number>) => string

/**
 * One human sentence per breakdown step — "Fabric: grey outdoor, 1.81 m ×
 * 46.00 zł/m". Shared by the offer screen and the print view, so the customer's
 * document and the salesperson's screen explain a price in the same words.
 */
export function describeStep(step: BreakdownStep, t: Translate, currencyCode: string, locale?: string): string {
  const money = (value: string | number) => formatMoney(value, currencyCode, locale)
  const p = step.params
  switch (step.code) {
    case 'base':
      return t('complex_offers.breakdown.base', 'Base price of the model (labour and overhead)')
    case 'size':
      return Number(p.factor) !== 1
        ? t('complex_offers.breakdown.sizeWithFactor', 'Size {label} — surcharge (material ×{factor})', {
            label: step.label ?? '',
            factor: formatDecimal(p.factor, locale, 3),
          })
        : t('complex_offers.breakdown.size', 'Size {label} — surcharge', { label: step.label ?? '' })
    case 'materials':
      return Number(p.factor) !== 1
        ? t('complex_offers.breakdown.materialsWithFactor', 'Materials from the BOM: {bomCost} × {factor}', {
            bomCost: money(p.bomCost),
            factor: formatDecimal(p.factor, locale, 3),
          })
        : t('complex_offers.breakdown.materials', 'Materials from the BOM')
    case 'fabric':
      return t('complex_offers.breakdown.fabric', '{label}: {meters} m × {price}/m', {
        label: step.label ?? '',
        meters: formatDecimal(p.meters, locale, 3),
        price: money(p.pricePerMeter),
      })
    case 'color':
      return t('complex_offers.breakdown.color', 'Colour {label}', { label: step.label ?? '' })
    case 'addon':
      return t('complex_offers.breakdown.addon', 'Add-on: {label}', { label: step.label ?? '' })
    case 'subtotal':
      return t('complex_offers.breakdown.subtotal', 'Cost and surcharges')
    case 'margin':
      return t('complex_offers.breakdown.margin', 'Margin {percent}%', { percent: formatDecimal(p.percent, locale, 2) })
    case 'list_price':
      return t('complex_offers.breakdown.listPrice', 'List price per unit')
    case 'quantity_discount':
      return t('complex_offers.breakdown.quantityDiscount', 'Quantity discount {percent}% (from {minQuantity} pcs)', {
        percent: formatDecimal(p.percent, locale, 2),
        minQuantity: p.minQuantity,
      })
    case 'unit_price':
      return t('complex_offers.breakdown.unitPrice', 'Unit price')
    case 'line_total':
      return t('complex_offers.breakdown.lineTotal', 'Line value ({quantity} pcs)', { quantity: p.quantity })
    default:
      return String(step.code)
  }
}

export function parameterKindLabel(kind: ParameterKind, t: Translate): string {
  switch (kind) {
    case 'size':
      return t('complex_offers.parameter.size', 'Size')
    case 'fabric':
      return t('complex_offers.parameter.fabric', 'Fabric')
    case 'color':
      return t('complex_offers.parameter.color', 'Colour')
    case 'addon':
      return t('complex_offers.parameter.addon', 'Add-ons')
    default:
      return kind
  }
}
