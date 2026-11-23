'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import {
  buildProductFields,
  toProductPayload,
  type ProductFormValues,
} from '../../../../components/productFormFields'

export default function CreateProductPage() {
  const t = useT()
  const router = useRouter()
  const fields = React.useMemo(() => buildProductFields(t, { includeActive: false }), [t])

  const handleSubmit = React.useCallback(
    async (values: ProductFormValues) => {
      const response = await createCrud<{ id: string }>('production_bom/products', toProductPayload(values), {
        errorMessage: t('production_bom.products.create.failed', 'Could not save the product.'),
      })
      flash(t('production_bom.products.create.created', 'Product saved — now build its BOM.'), 'success')
      const id = response.result?.id
      router.push(id ? `/backend/production-bom/products/${id}` : '/backend/production-bom/products')
    },
    [router, t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm<ProductFormValues>
          fields={fields}
          initialValues={{ productType: 'cushion', laborMinutes: 0, fabricConsumption: 0 }}
          title={t('production_bom.products.create.title', 'New product')}
          backHref="/backend/production-bom/products"
          cancelHref="/backend/production-bom/products"
          submitLabel={t('production_bom.products.create.submit', 'Save and build BOM')}
          onSubmit={handleSubmit}
        />
      </PageBody>
    </Page>
  )
}
