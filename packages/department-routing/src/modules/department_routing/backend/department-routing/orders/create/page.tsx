'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { buildOrderFields, toOrderPayload, type OrderFormValues } from '../../../../components/formFields'

export default function CreateOrderPage() {
  const t = useT()
  const router = useRouter()
  const fields = React.useMemo(() => buildOrderFields(t), [t])

  const handleSubmit = React.useCallback(
    async (values: OrderFormValues) => {
      const response = await createCrud<{ id: string }>('department_routing/orders', toOrderPayload(values), {
        errorMessage: t('department_routing.orders.create.failed', 'Could not save the order.'),
      })
      flash(t('department_routing.orders.create.created', 'Order saved — now add what the customer ordered.'), 'success')
      const id = response.result?.id
      router.push(id ? `/backend/department-routing/orders/${id}` : '/backend/department-routing/orders')
    },
    [router, t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm<OrderFormValues>
          fields={fields}
          initialValues={{}}
          title={t('department_routing.orders.create.title', 'New order')}
          backHref="/backend/department-routing/orders"
          cancelHref="/backend/department-routing/orders"
          submitLabel={t('department_routing.orders.create.submit', 'Save and add products')}
          onSubmit={handleSubmit}
        />
      </PageBody>
    </Page>
  )
}
