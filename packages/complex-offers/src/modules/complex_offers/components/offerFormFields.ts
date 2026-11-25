import type { CrudField } from '@open-mercato/ui/backend/CrudForm'
import type { TranslateFn } from '@open-mercato/shared/lib/i18n/context'

export type OfferFormValues = {
  title?: string
  customerName?: string
  contactPerson?: string
  validUntil?: string
  notes?: string
}

export function buildOfferFields(t: TranslateFn): CrudField[] {
  return [
    { id: 'customerName', label: t('complex_offers.fields.customerName', 'Customer'), type: 'text', required: true, layout: 'half' },
    { id: 'contactPerson', label: t('complex_offers.fields.contactPerson', 'Contact'), type: 'text', layout: 'half' },
    { id: 'title', label: t('complex_offers.fields.title', 'Subject'), type: 'text', required: true },
    { id: 'validUntil', label: t('complex_offers.fields.validUntil', 'Valid until'), type: 'date', layout: 'half' },
    {
      id: 'notes',
      label: t('complex_offers.fields.notes', 'Notes printed on the offer'),
      type: 'textarea',
      description: t('complex_offers.fields.notesHint', 'Lead time, transport, payment terms — printed under the totals.'),
    },
  ]
}

export function toOfferPayload(values: OfferFormValues) {
  return {
    title: values.title ?? '',
    customerName: values.customerName ?? '',
    contactPerson: values.contactPerson ?? '',
    validUntil: values.validUntil ? values.validUntil : null,
    notes: values.notes ?? '',
  }
}
