import type { CrudField } from '@open-mercato/ui/backend/CrudForm'
import type { TranslateFn } from '@open-mercato/shared/lib/i18n/context'
import { PRODUCT_TYPES } from '../data/validators'

export type ProductFormValues = {
  name?: string
  code?: string
  productType?: string
  laborMinutes?: string | number
  fabricConsumption?: string | number
  description?: string
  isActive?: boolean
}

export function buildProductFields(t: TranslateFn, options: { includeActive: boolean }): CrudField[] {
  const fields: CrudField[] = [
    { id: 'name', label: t('production_bom.products.fields.name', 'Product'), type: 'text', required: true },
    { id: 'code', label: t('production_bom.products.fields.code', 'Code'), type: 'text', layout: 'half' },
    {
      id: 'productType',
      label: t('production_bom.products.fields.productType', 'Type'),
      type: 'select',
      layout: 'half',
      options: PRODUCT_TYPES.map((value) => ({ value, label: t(`production_bom.productType.${value}`, value) })),
    },
    {
      id: 'laborMinutes',
      label: t('production_bom.products.fields.laborMinutesInput', 'Labour time per unit (min)'),
      type: 'number',
      layout: 'half',
      description: t(
        'production_bom.products.fields.laborMinutesHint',
        'Kept separate from the BOM — minutes are not a material.',
      ),
    },
    {
      id: 'fabricConsumption',
      label: t('production_bom.products.fields.fabricConsumptionInput', 'Fabric per unit (m)'),
      type: 'number',
      layout: 'half',
      description: t(
        'production_bom.products.fields.fabricConsumptionHint',
        'How much fabric one unit takes. Which fabric is chosen per order — it is not in the BOM or the product cost.',
      ),
    },
    { id: 'description', label: t('production_bom.products.fields.description', 'Description'), type: 'textarea' },
  ]
  if (options.includeActive) {
    fields.push({ id: 'isActive', label: t('production_bom.common.active', 'Active'), type: 'checkbox' })
  }
  return fields
}

export function toProductPayload(values: ProductFormValues): Record<string, unknown> {
  return {
    name: values.name,
    code: values.code || null,
    productType: values.productType || 'other',
    laborMinutes: values.laborMinutes === '' || values.laborMinutes == null ? 0 : Math.trunc(Number(values.laborMinutes)),
    fabricConsumption:
      values.fabricConsumption === '' || values.fabricConsumption == null ? 0 : Number(values.fabricConsumption),
    description: values.description || null,
    ...(values.isActive === undefined ? {} : { isActive: values.isActive }),
  }
}
