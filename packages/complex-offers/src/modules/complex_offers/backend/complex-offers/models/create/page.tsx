'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { buildModelFields, toModelPayload, type ModelFormValues } from '../../../../components/modelFormFields'

export default function CreateModelPage() {
  const t = useT()
  const router = useRouter()
  const fields = React.useMemo(() => buildModelFields(t, { includeActive: false }), [t])

  const handleSubmit = React.useCallback(
    async (values: ModelFormValues) => {
      const response = await createCrud<{ id: string }>('complex_offers/models', toModelPayload(values), {
        errorMessage: t('complex_offers.models.create.failed', 'Could not save the model.'),
      })
      flash(t('complex_offers.models.create.created', 'Model saved — now add its parameters and surcharges.'), 'success')
      const id = response.result?.id
      router.push(id ? `/backend/complex-offers/models/${id}` : '/backend/complex-offers/models')
    },
    [router, t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm<ModelFormValues>
          fields={fields}
          initialValues={{ basePrice: 0, marginPercent: 30, fabricConsumption: 0, bomMaterialCost: 0 }}
          title={t('complex_offers.models.create.title', 'New model')}
          backHref="/backend/complex-offers/models"
          cancelHref="/backend/complex-offers/models"
          submitLabel={t('complex_offers.models.create.submit', 'Save and set the price list')}
          onSubmit={handleSubmit}
        />
      </PageBody>
    </Page>
  )
}
