'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { buildOfferFields, toOfferPayload, type OfferFormValues } from '../../../../components/offerFormFields'

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

export default function CreateOfferPage() {
  const t = useT()
  const router = useRouter()
  const fields = React.useMemo(() => buildOfferFields(t), [t])

  const handleSubmit = React.useCallback(
    async (values: OfferFormValues) => {
      const response = await createCrud<{ id: string; number: string }>('complex_offers/offers', toOfferPayload(values), {
        errorMessage: t('complex_offers.offers.create.failed', 'Could not save the offer.'),
      })
      flash(
        t('complex_offers.offers.create.created', 'Offer {number} created — add products to version 1.', {
          number: response.result?.number ?? '',
        }),
        'success',
      )
      const id = response.result?.id
      router.push(id ? `/backend/complex-offers/offers/${id}` : '/backend/complex-offers/offers')
    },
    [router, t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm<OfferFormValues>
          fields={fields}
          initialValues={{ validUntil: inDays(14) }}
          title={t('complex_offers.offers.create.title', 'New offer')}
          backHref="/backend/complex-offers/offers"
          cancelHref="/backend/complex-offers/offers"
          submitLabel={t('complex_offers.offers.create.submit', 'Create and add products')}
          onSubmit={handleSubmit}
        />
      </PageBody>
    </Page>
  )
}
