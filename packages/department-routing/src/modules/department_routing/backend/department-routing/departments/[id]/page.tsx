'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { apiCall, apiCallOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { DepartmentRow, ListResponse } from '../../../../components/types'
import { buildDepartmentFields, toDepartmentPayload, type DepartmentFormValues } from '../../../../components/formFields'

export default function DepartmentDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const departmentId = String(params?.id ?? '')
  const [department, setDepartment] = React.useState<DepartmentRow | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)
  const fields = React.useMemo(() => buildDepartmentFields(t, { includeActive: true }), [t])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      const call = await apiCall<ListResponse<DepartmentRow>>(
        `/api/department_routing/departments?id=${encodeURIComponent(departmentId)}`,
      ).catch(() => null)
      if (cancelled) return
      setDepartment(call?.ok ? call.result?.items?.[0] ?? null : null)
      setIsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [departmentId, reloadToken])

  const handleSubmit = React.useCallback(
    async (values: DepartmentFormValues) => {
      await updateCrud('department_routing/departments', { id: departmentId, ...toDepartmentPayload(values) }, {
        errorMessage: t('department_routing.departments.create.failed', 'Could not save the department.'),
      })
      flash(t('department_routing.common.saved', 'Saved.'), 'success')
      setReloadToken((token) => token + 1)
    },
    [departmentId, t],
  )

  const handleDelete = React.useCallback(async () => {
    await apiCallOrThrow(`/api/department_routing/departments?id=${encodeURIComponent(departmentId)}`, { method: 'DELETE' })
    flash(t('department_routing.common.deleted', 'Deleted.'), 'success')
    router.push('/backend/department-routing/departments')
  }, [departmentId, router, t])

  if (isLoading && !department) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('department_routing.common.loading', 'Loading…')} />
        </PageBody>
      </Page>
    )
  }
  if (!department) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={t('department_routing.departments.detail.notFound', 'Department not found.')} />
        </PageBody>
      </Page>
    )
  }

  return (
    <Page>
      <PageBody>
        <CrudForm<DepartmentFormValues>
          key={`${department.id}:${department.updated_at ?? ''}`}
          fields={fields}
          initialValues={{
            name: department.name,
            code: department.code ?? '',
            position: department.position,
            description: department.description ?? '',
            isActive: department.is_active,
          }}
          title={department.name}
          backHref="/backend/department-routing/departments"
          cancelHref="/backend/department-routing/departments"
          submitLabel={t('department_routing.common.save', 'Save')}
          onSubmit={handleSubmit}
          onDelete={handleDelete}
          twoColumn
        />
      </PageBody>
    </Page>
  )
}
