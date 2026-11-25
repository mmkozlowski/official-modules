'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { buildWorkCenterFields, toWorkCenterPayload, type WorkCenterFormValues } from '../../../../components/workCenterFormFields'

export default function CreateWorkCenterPage() {
  const t = useT()
  const router = useRouter()
  const fields = React.useMemo(() => buildWorkCenterFields(t, { includeActive: false }), [t])
  const handleSubmit = React.useCallback(
    async (values: WorkCenterFormValues) => {
      await createCrud<{ id: string }>('production_planning/work-centers', toWorkCenterPayload(values), {
        errorMessage: t('production_planning.workCenters.create.failed', 'Could not save the work centre.'),
      })
      flash(t('production_planning.common.saved', 'Saved.'), 'success')
      router.push('/backend/production-planning/work-centers')
    },
    [router, t],
  )
  return (
    <Page>
      <PageBody>
        <CrudForm<WorkCenterFormValues>
          fields={fields}
          initialValues={{ stage: 'other', dailyCapacityMinutes: 480, position: 100 }}
          title={t('production_planning.workCenters.create.title', 'New work centre')}
          backHref="/backend/production-planning/work-centers"
          cancelHref="/backend/production-planning/work-centers"
          submitLabel={t('production_planning.common.save', 'Save')}
          onSubmit={handleSubmit}
          twoColumn
        />
      </PageBody>
    </Page>
  )
}
