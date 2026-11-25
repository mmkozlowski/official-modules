import type { CrudField } from '@open-mercato/ui/backend/CrudForm'
import type { TranslateFn } from '@open-mercato/shared/lib/i18n/context'

export type ModelFormValues = {
  name?: string
  code?: string
  description?: string
  basePrice?: string | number
  marginPercent?: string | number
  bomProductCode?: string
  bomMaterialCost?: string | number
  fabricConsumption?: string | number
  isActive?: boolean
}

export function buildModelFields(t: TranslateFn, options: { includeActive: boolean }): CrudField[] {
  const fields: CrudField[] = [
    { id: 'name', label: t('complex_offers.models.fields.name', 'Model'), type: 'text', required: true },
    { id: 'code', label: t('complex_offers.models.fields.code', 'Code'), type: 'text', layout: 'half' },
    {
      id: 'basePrice',
      label: t('complex_offers.models.fields.basePrice', 'Base price (labour and overhead), net'),
      type: 'number',
      layout: 'half',
      required: true,
      description: t('complex_offers.models.fields.basePriceHint', 'For one unit of the base size, before margin.'),
    },
    {
      id: 'marginPercent',
      label: t('complex_offers.models.fields.marginPercent', 'Margin %'),
      type: 'number',
      layout: 'half',
      description: t('complex_offers.models.fields.marginPercentHint', 'Added on cost and surcharges. Internal — never printed.'),
    },
    {
      id: 'fabricConsumption',
      label: t('complex_offers.models.fields.fabricConsumption', 'Fabric per unit of the base size (m)'),
      type: 'number',
      layout: 'half',
      description: t('complex_offers.models.fields.fabricConsumptionHint', '0 for a model without fabric. Scaled by the size factor.'),
    },
    {
      id: 'bomProductCode',
      label: t('complex_offers.models.fields.bomProductCode', 'BOM product code'),
      type: 'text',
      layout: 'half',
      description: t('complex_offers.models.fields.bomProductCodeHint', 'The production BOM product the material cost is taken from.'),
    },
    {
      id: 'bomMaterialCost',
      label: t('complex_offers.models.fields.bomMaterialCost', 'Material cost from the BOM (base size)'),
      type: 'number',
      layout: 'half',
    },
    { id: 'description', label: t('complex_offers.models.fields.description', 'Description'), type: 'textarea' },
  ]
  if (options.includeActive) {
    fields.push({ id: 'isActive', label: t('complex_offers.common.active', 'Active'), type: 'checkbox' })
  }
  return fields
}

const toNumber = (value: string | number | undefined) => {
  if (value === undefined || value === '') return 0
  const parsed = Number(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

export function toModelPayload(values: ModelFormValues) {
  return {
    name: values.name ?? '',
    code: values.code ?? '',
    description: values.description ?? '',
    basePrice: toNumber(values.basePrice),
    marginPercent: toNumber(values.marginPercent),
    bomProductCode: values.bomProductCode ?? '',
    bomMaterialCost: toNumber(values.bomMaterialCost),
    fabricConsumption: toNumber(values.fabricConsumption),
    ...(values.isActive !== undefined ? { isActive: Boolean(values.isActive) } : {}),
  }
}
