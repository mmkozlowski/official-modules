import type { CrudField } from '@open-mercato/ui/backend/CrudForm'
import type { TranslateFn } from '@open-mercato/shared/lib/i18n/context'

export type DepartmentFormValues = {
  name?: string
  code?: string
  position?: string | number
  description?: string
  isActive?: boolean
}

export function buildDepartmentFields(t: TranslateFn, options: { includeActive: boolean }): CrudField[] {
  const fields: CrudField[] = [
    { id: 'name', label: t('department_routing.departments.fields.name', 'Department'), type: 'text', required: true },
    { id: 'code', label: t('department_routing.departments.fields.code', 'Code'), type: 'text', layout: 'half' },
    {
      id: 'position',
      label: t('department_routing.departments.fields.position', 'Order of work'),
      type: 'number',
      layout: 'half',
      description: t(
        'department_routing.departments.fields.positionHint',
        'Lower comes first on the order screen. It does not block any department.',
      ),
    },
    { id: 'description', label: t('department_routing.departments.fields.description', 'Description'), type: 'textarea' },
  ]
  if (options.includeActive) {
    fields.push({ id: 'isActive', label: t('department_routing.common.active', 'Active'), type: 'checkbox' })
  }
  return fields
}

export function toDepartmentPayload(values: DepartmentFormValues): Record<string, unknown> {
  return {
    name: values.name,
    code: values.code || null,
    position: values.position === '' || values.position == null ? 0 : Math.trunc(Number(values.position)),
    description: values.description || null,
    ...(values.isActive === undefined ? {} : { isActive: values.isActive }),
  }
}

export type ProductFormValues = {
  name?: string
  code?: string
  description?: string
  isActive?: boolean
}

export function buildProductFields(t: TranslateFn, options: { includeActive: boolean }): CrudField[] {
  const fields: CrudField[] = [
    { id: 'name', label: t('department_routing.products.fields.name', 'Product'), type: 'text', required: true },
    { id: 'code', label: t('department_routing.products.fields.code', 'Code'), type: 'text', layout: 'half' },
    { id: 'description', label: t('department_routing.products.fields.description', 'Description'), type: 'textarea' },
  ]
  if (options.includeActive) {
    fields.push({ id: 'isActive', label: t('department_routing.common.active', 'Active'), type: 'checkbox' })
  }
  return fields
}

export function toProductPayload(values: ProductFormValues): Record<string, unknown> {
  return {
    name: values.name,
    code: values.code || null,
    description: values.description || null,
    ...(values.isActive === undefined ? {} : { isActive: values.isActive }),
  }
}

export type OrderFormValues = {
  number?: string
  customerName?: string
  dueDate?: string
  notes?: string
}

export function buildOrderFields(t: TranslateFn): CrudField[] {
  return [
    {
      id: 'customerName',
      label: t('department_routing.orders.fields.customerName', 'Customer'),
      type: 'text',
      required: true,
    },
    {
      id: 'number',
      label: t('department_routing.orders.fields.number', 'Order number'),
      type: 'text',
      layout: 'half',
      description: t('department_routing.orders.fields.numberHint', 'Leave empty — the next number is assigned.'),
    },
    { id: 'dueDate', label: t('department_routing.orders.fields.dueDate', 'Due date'), type: 'date', layout: 'half' },
    { id: 'notes', label: t('department_routing.orders.fields.notes', 'Notes'), type: 'textarea' },
  ]
}

export function toOrderPayload(values: OrderFormValues): Record<string, unknown> {
  return {
    number: values.number || null,
    customerName: values.customerName,
    dueDate: values.dueDate ? String(values.dueDate).slice(0, 10) : null,
    notes: values.notes || null,
  }
}
