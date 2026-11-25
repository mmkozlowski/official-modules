'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { buildProductFields, toProductPayload, type ProductFormValues } from '../../../../components/formFields'

export default function CreateRoutedProductPage() {
  const t = useT()
  const router = useRouter()
  const fields = React.useMemo(() => buildProductFields(t, { includeActive: false }), [t])

  const handleSubmit = React.useCallback(
    async (values: ProductFormValues) => {
      const response = await createCrud<{ id: string }>('department_routing/products', toProductPayload(values), {
        errorMessage: t('department_routing.products.create.failed', 'Could not save the product.'),
      })
      flash(t('department_routing.products.create.created', 'Product saved — now pick the departments that make it.'), 'success')
      const id = response.result?.id
      router.push(id ? `/backend/department-routing/products/${id}` : '/backend/department-routing/products')
    },
    [router, t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm<ProductFormValues>
          fields={fields}
          initialValues={{}}
          title={t('department_routing.products.create.title', 'New product')}
          backHref="/backend/department-routing/products"
          cancelHref="/backend/department-routing/products"
          submitLabel={t('department_routing.products.create.submit', 'Save and set departments')}
          onSubmit={handleSubmit}
        />
      </PageBody>
    </Page>
  )
}
