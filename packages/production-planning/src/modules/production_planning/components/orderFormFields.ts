import type { CrudField } from '@open-mercato/ui/backend/CrudForm'
import type { TranslateFn } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import type { ListResponse, MaterialRow, ProductRow } from '@open-mercato/production-bom/modules/production_bom/components/types'
import { ORDER_PRIORITIES, ORDER_STATUSES } from '../data/validators'

export type OrderFormValues = {
  number?: string
  productId?: string
  quantity?: string | number
  dueDate?: string
  priority?: string
  status?: string
  fabricMaterialId?: string
  reference?: string
  notes?: string
}

async function loadProducts() {
  const call = await apiCall<ListResponse<ProductRow>>('/api/production_bom/products?pageSize=100&isActive=true&sortField=name&sortDir=asc')
  return (call.ok ? call.result?.items ?? [] : []).map((product) => ({
    value: product.id,
    label: product.code ? `${product.code} — ${product.name}` : product.name,
  }))
}

async function loadFabrics() {
  const call = await apiCall<ListResponse<MaterialRow>>(
    '/api/production_bom/materials?pageSize=100&materialType=fabric&isActive=true&sortField=name&sortDir=asc',
  )
  return (call.ok ? call.result?.items ?? [] : []).map((material) => ({ value: material.id, label: material.name }))
}

export function buildOrderFields(t: TranslateFn): CrudField[] {
  return [
    {
      id: 'productId',
      label: t('production_planning.orders.fields.product', 'Product'),
      type: 'select',
      required: true,
      loadOptions: loadProducts,
      description: t('production_planning.orders.fields.productHint', 'A product from the BOM. Its routing places the order on the plan.'),
    },
    { id: 'quantity', label: t('production_planning.orders.fields.quantity', 'Quantity'), type: 'number', required: true, layout: 'half' },
    {
      id: 'dueDate',
      label: t('production_planning.orders.fields.dueDate', 'Due date'),
      type: 'date',
      required: true,
      layout: 'half',
      description: t('production_planning.orders.fields.dueDateHint', 'The last routing step ends on this day; the rest is planned backwards.'),
    },
    {
      id: 'priority',
      label: t('production_planning.orders.fields.priority', 'Priority'),
      type: 'select',
      layout: 'half',
      options: ORDER_PRIORITIES.map((value) => ({ value, label: t(`production_planning.priority.${value}`, value) })),
    },
    {
      id: 'status',
      label: t('production_planning.orders.fields.status', 'Status'),
      type: 'select',
      layout: 'half',
      options: ORDER_STATUSES.map((value) => ({ value, label: t(`production_planning.status.${value}`, value) })),
    },
    {
      id: 'fabricMaterialId',
      label: t('production_planning.orders.fields.fabric', 'Fabric'),
      type: 'select',
      loadOptions: loadFabrics,
      description: t('production_planning.orders.fields.fabricHint', 'Chosen per order, never in the BOM — counted into the material requirement.'),
    },
    { id: 'number', label: t('production_planning.orders.fields.number', 'Number'), type: 'text', layout: 'half',
      description: t('production_planning.orders.fields.numberHint', 'Leave empty — assigned automatically.') },
    { id: 'reference', label: t('production_planning.orders.fields.reference', 'Reference'), type: 'text', layout: 'half' },
    { id: 'notes', label: t('production_planning.orders.fields.notes', 'Notes'), type: 'textarea' },
  ]
}

export function toOrderPayload(values: OrderFormValues): Record<string, unknown> {
  return {
    productId: values.productId,
    quantity: Math.trunc(Number(values.quantity)),
    dueDate: values.dueDate ? String(values.dueDate).slice(0, 10) : undefined,
    priority: values.priority || 'normal',
    status: values.status || 'planned',
    fabricMaterialId: values.fabricMaterialId || null,
    number: values.number || null,
    reference: values.reference || null,
    notes: values.notes || null,
  }
}
