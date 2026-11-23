import type { CrudField } from '@open-mercato/ui/backend/CrudForm'
import type { TranslateFn } from '@open-mercato/shared/lib/i18n/context'
import { MATERIAL_TYPES, MATERIAL_UNITS } from '../data/validators'

export type MaterialFormValues = {
  name?: string
  code?: string
  materialType?: string
  unit?: string
  unitPrice?: string | number
  wastePercent?: string | number
  currencyCode?: string
  notes?: string
  isActive?: boolean
}

/** One field list for create and edit, so the two forms cannot drift apart. */
export function buildMaterialFields(t: TranslateFn, options: { includeActive: boolean }): CrudField[] {
  const fields: CrudField[] = [
    { id: 'name', label: t('production_bom.materials.fields.name', 'Material'), type: 'text', required: true },
    { id: 'code', label: t('production_bom.materials.fields.code', 'Code'), type: 'text', layout: 'half' },
    {
      id: 'materialType',
      label: t('production_bom.materials.fields.materialType', 'Type'),
      type: 'select',
      layout: 'half',
      required: true,
      description: t(
        'production_bom.materials.fields.materialTypeHint',
        'Fabric is chosen per order and never enters a product BOM or its cost.',
      ),
      options: MATERIAL_TYPES.map((value) => ({ value, label: t(`production_bom.materialType.${value}`, value) })),
    },
    {
      id: 'unit',
      label: t('production_bom.materials.fields.unit', 'Unit'),
      type: 'select',
      layout: 'third',
      required: true,
      options: MATERIAL_UNITS.map((value) => ({ value, label: t(`production_bom.unit.${value}`, value) })),
    },
    {
      id: 'unitPrice',
      label: t('production_bom.materials.fields.unitPrice', 'Unit price (net)'),
      type: 'number',
      layout: 'third',
      required: true,
    },
    {
      id: 'currencyCode',
      label: t('production_bom.materials.fields.currencyCode', 'Currency'),
      type: 'text',
      layout: 'third',
    },
    {
      id: 'wastePercent',
      label: t('production_bom.materials.fields.wastePercent', 'Allowance'),
      type: 'number',
      layout: 'half',
      description: t(
        'production_bom.materials.fields.wastePercentHint',
        'Percent added on top of the norm when issuing for an order (offcuts). The product cost stays on the norm.',
      ),
    },
    { id: 'notes', label: t('production_bom.materials.fields.notes', 'Notes'), type: 'textarea' },
  ]
  if (options.includeActive) {
    fields.push({ id: 'isActive', label: t('production_bom.common.active', 'Active'), type: 'checkbox' })
  }
  return fields
}

export function toMaterialPayload(values: MaterialFormValues): Record<string, unknown> {
  return {
    name: values.name,
    code: values.code || null,
    materialType: values.materialType || 'other',
    unit: values.unit || 'pcs',
    unitPrice: values.unitPrice === '' || values.unitPrice == null ? 0 : Number(values.unitPrice),
    wastePercent: values.wastePercent === '' || values.wastePercent == null ? 0 : Number(values.wastePercent),
    currencyCode: (values.currencyCode || 'PLN').toUpperCase(),
    notes: values.notes || null,
    ...(values.isActive === undefined ? {} : { isActive: values.isActive }),
  }
}
