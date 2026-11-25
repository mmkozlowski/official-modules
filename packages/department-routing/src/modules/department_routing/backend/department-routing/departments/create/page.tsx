'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { buildDepartmentFields, toDepartmentPayload, type DepartmentFormValues } from '../../../../components/formFields'

export default function CreateDepartmentPage() {
  const t = useT()
  const router = useRouter()
  const fields = React.useMemo(() => buildDepartmentFields(t, { includeActive: false }), [t])

  const handleSubmit = React.useCallback(
    async (values: DepartmentFormValues) => {
      await createCrud('department_routing/departments', toDepartmentPayload(values), {
        errorMessage: t('department_routing.departments.create.failed', 'Could not save the department.'),
      })
      flash(t('department_routing.common.saved', 'Saved.'), 'success')
      router.push('/backend/department-routing/departments')
    },
    [router, t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm<DepartmentFormValues>
          fields={fields}
          initialValues={{ position: 60 }}
          title={t('department_routing.departments.create.title', 'New department')}
          backHref="/backend/department-routing/departments"
          cancelHref="/backend/department-routing/departments"
          submitLabel={t('department_routing.common.save', 'Save')}
          onSubmit={handleSubmit}
        />
      </PageBody>
    </Page>
  )
}
