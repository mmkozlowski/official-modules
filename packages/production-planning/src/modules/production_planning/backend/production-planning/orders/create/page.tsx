'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { buildOrderFields, toOrderPayload, type OrderFormValues } from '../../../../components/orderFormFields'
import { localIsoDate } from '../../../../lib/plan-model'
import { shiftWorkingDays, workingDayOnOrAfter } from '../../../../lib/schedule'

export default function CreateOrderPage() {
  const t = useT()
  const router = useRouter()
  const fields = React.useMemo(() => buildOrderFields(t), [t])
  const defaultDue = React.useMemo(() => shiftWorkingDays(workingDayOnOrAfter(localIsoDate()), 7), [])

  const handleSubmit = React.useCallback(
    async (values: OrderFormValues) => {
      const response = await createCrud<{ id: string; number: string }>('production_planning/orders', toOrderPayload(values), {
        errorMessage: t('production_planning.orders.create.failed', 'Could not save the order.'),
      })
      flash(
        t('production_planning.orders.create.created', 'Order {number} saved — it is on the plan.', { number: response.result?.number ?? '' }),
        'success',
      )
      const id = response.result?.id
      router.push(id ? `/backend/production-planning/orders/${id}` : '/backend/production-planning/orders')
    },
    [router, t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm<OrderFormValues>
          fields={fields}
          initialValues={{ priority: 'normal', status: 'planned', dueDate: defaultDue }}
          title={t('production_planning.orders.create.title', 'New production order')}
          backHref="/backend/production-planning/orders"
          cancelHref="/backend/production-planning/orders"
          submitLabel={t('production_planning.orders.create.submit', 'Save and plan')}
          onSubmit={handleSubmit}
          twoColumn
        />
      </PageBody>
    </Page>
  )
}
