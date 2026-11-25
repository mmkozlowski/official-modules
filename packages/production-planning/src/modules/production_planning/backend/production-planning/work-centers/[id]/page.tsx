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
import { buildWorkCenterFields, toWorkCenterPayload, type WorkCenterFormValues } from '../../../../components/workCenterFormFields'
import type { ListResponse, WorkCenterRow } from '../../../../components/types'

export default function WorkCenterDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const centreId = String(params?.id ?? '')
  const [centre, setCentre] = React.useState<WorkCenterRow | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      const call = centreId
        ? await apiCall<ListResponse<WorkCenterRow>>(`/api/production_planning/work-centers?id=${encodeURIComponent(centreId)}`).catch(() => null)
        : null
      if (cancelled) return
      setCentre(call?.ok ? call.result?.items?.[0] ?? null : null)
      setIsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [centreId, reloadToken])

  const fields = React.useMemo(() => buildWorkCenterFields(t, { includeActive: true }), [t])

  const handleSubmit = React.useCallback(
    async (values: WorkCenterFormValues) => {
      await updateCrud('production_planning/work-centers', { id: centreId, ...toWorkCenterPayload(values) }, {
        errorMessage: t('production_planning.workCenters.create.failed', 'Could not save the work centre.'),
      })
      flash(t('production_planning.common.saved', 'Saved.'), 'success')
      setReloadToken((token) => token + 1)
    },
    [centreId, t],
  )

  const handleDelete = React.useCallback(async () => {
    await apiCallOrThrow(`/api/production_planning/work-centers?id=${encodeURIComponent(centreId)}`, { method: 'DELETE' })
    flash(t('production_planning.common.deleted', 'Deleted.'), 'success')
    router.push('/backend/production-planning/work-centers')
  }, [centreId, router, t])

  if (isLoading && !centre) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('production_planning.common.loading', 'Loading…')} />
        </PageBody>
      </Page>
    )
  }
  if (!centre) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={t('production_planning.workCenters.detail.notFound', 'Work centre not found.')} />
        </PageBody>
      </Page>
    )
  }
  return (
    <Page>
      <PageBody>
        <CrudForm<WorkCenterFormValues>
          key={`${centre.id}:${centre.updated_at ?? ''}`}
          fields={fields}
          initialValues={{
            name: centre.name,
            code: centre.code ?? '',
            stage: centre.stage,
            dailyCapacityMinutes: centre.daily_capacity_minutes,
            position: centre.position,
            notes: centre.notes ?? '',
            isActive: centre.is_active,
          }}
          title={centre.name}
          backHref="/backend/production-planning/work-centers"
          cancelHref="/backend/production-planning/work-centers"
          submitLabel={t('production_planning.common.save', 'Save')}
          onSubmit={handleSubmit}
          onDelete={handleDelete}
          twoColumn
        />
      </PageBody>
    </Page>
  )
}
