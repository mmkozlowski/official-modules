'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import {
  buildMaterialFields,
  toMaterialPayload,
  type MaterialFormValues,
} from '../../../../components/materialFormFields'

export default function CreateMaterialPage() {
  const t = useT()
  const router = useRouter()
  const fields = React.useMemo(() => buildMaterialFields(t, { includeActive: false }), [t])

  const handleSubmit = React.useCallback(
    async (values: MaterialFormValues) => {
      const response = await createCrud<{ id: string }>('production_bom/materials', toMaterialPayload(values), {
        errorMessage: t('production_bom.materials.create.failed', 'Could not save the material.'),
      })
      flash(t('production_bom.materials.create.created', 'Material saved.'), 'success')
      const id = response.result?.id
      router.push(id ? `/backend/production-bom/materials/${id}` : '/backend/production-bom/materials')
    },
    [router, t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm<MaterialFormValues>
          fields={fields}
          initialValues={{ materialType: 'foam', unit: 'pcs', currencyCode: 'PLN', wastePercent: 0 }}
          title={t('production_bom.materials.create.title', 'New material')}
          backHref="/backend/production-bom/materials"
          cancelHref="/backend/production-bom/materials"
          submitLabel={t('production_bom.common.save', 'Save')}
          onSubmit={handleSubmit}
        />
      </PageBody>
    </Page>
  )
}
