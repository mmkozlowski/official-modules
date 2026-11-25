'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { ListResponse, RoutingView, WorkCenterRow } from '../../../../components/types'
import { STAGE_CLASSES } from '../../../../components/planFormat'

type DraftStep = { key: string; workCenterId: string; minutesPerUnit: string; setupMinutes: string }

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

let keySeed = 0
const nextKey = () => `step-${(keySeed += 1)}`

/**
 * The routing of one product: the work centres it passes through, in order,
 * with minutes per unit and a fixed setup per order. Saved as a whole. The sum
 * of minutes is shown against the labour time the BOM declares, so a routing
 * that does not add up is visible before it skews the plan.
 */
export default function RoutingEditorPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const productId = String(params?.id ?? '')
  const [routing, setRouting] = React.useState<RoutingView | null>(null)
  const [centres, setCentres] = React.useState<WorkCenterRow[]>([])
  const [steps, setSteps] = React.useState<DraftStep[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const applyRouting = React.useCallback((view: RoutingView) => {
    setRouting(view)
    setSteps(
      view.steps.map((step) => ({
        key: nextKey(),
        workCenterId: step.workCenterId,
        minutesPerUnit: String(Number(step.minutesPerUnit)),
        setupMinutes: String(step.setupMinutes),
      })),
    )
  }, [])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      const [routingCall, centresCall] = await Promise.all([
        apiCall<RoutingView>(`/api/production_planning/routings/${encodeURIComponent(productId)}`).catch(() => null),
        apiCall<ListResponse<WorkCenterRow>>('/api/production_planning/work-centers?pageSize=100&isActive=true&sortField=position&sortDir=asc').catch(
          () => null,
        ),
      ])
      if (cancelled) return
      if (!routingCall?.ok || !routingCall.result) {
        setError(t('production_planning.routings.detail.notFound', 'Product not found.'))
      } else {
        applyRouting(routingCall.result)
        setCentres(centresCall?.ok ? centresCall.result?.items ?? [] : [])
      }
      setIsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [applyRouting, productId, t])

  const update = (key: string, patch: Partial<DraftStep>) =>
    setSteps((current) => current.map((step) => (step.key === key ? { ...step, ...patch } : step)))
  const move = (index: number, delta: number) =>
    setSteps((current) => {
      const target = index + delta
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  const totalMinutes = steps.reduce((sum, step) => sum + (Number(step.minutesPerUnit) || 0), 0)
  const valid = steps.every((step) => step.workCenterId && Number(step.minutesPerUnit) >= 0 && step.minutesPerUnit !== '')

  const save = React.useCallback(async () => {
    if (!valid || isSaving) return
    setIsSaving(true)
    const call = await apiCall<RoutingView>(`/api/production_planning/routings/${encodeURIComponent(productId)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        steps: steps.map((step) => ({
          workCenterId: step.workCenterId,
          minutesPerUnit: Number(step.minutesPerUnit),
          setupMinutes: Math.trunc(Number(step.setupMinutes) || 0),
        })),
      }),
    }).catch(() => null)
    setIsSaving(false)
    if (!call?.ok || !call.result) {
      flash(t('production_planning.routings.detail.saveFailed', 'The routing could not be saved.'), 'error')
      return
    }
    applyRouting(call.result)
    flash(t('production_planning.routings.detail.saved', 'Routing saved — the plan uses it from now on.'), 'success')
  }, [applyRouting, isSaving, productId, steps, t, valid])

  if (isLoading && !routing) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('production_planning.common.loading', 'Loading…')} />
        </PageBody>
      </Page>
    )
  }
  if (error || !routing) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={error ?? t('production_planning.routings.detail.notFound', 'Product not found.')} />
        </PageBody>
      </Page>
    )
  }

  const laborMinutes = routing.product.laborMinutes
  const matches = Math.abs(totalMinutes - laborMinutes) < 0.01
  const centreById = new Map(centres.map((centre) => [centre.id, centre]))

  return (
    <Page>
      <PageHeader
        title={t('production_planning.routings.detail.heading', 'Routing: {product}', { product: routing.product.name })}
        description={t(
          'production_planning.routings.detail.description',
          'The work centres the product passes through, in order. The plan schedules every order of this product along this route.',
        )}
        actions={
          <Button asChild variant="outline">
            <Link href={`/backend/production-bom/products/${routing.product.id}`}>
              {t('production_planning.routings.list.openBom', 'Open BOM')}
            </Link>
          </Button>
        }
      />
      <PageBody>
        <div
          className="space-y-4"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              void save()
            }
          }}
        >
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">{t('production_planning.workCenters.fields.name', 'Work centre')}</th>
                  <th className="w-40 px-3 py-2 font-medium">{t('production_planning.routings.detail.minutesPerUnit', 'Min / unit')}</th>
                  <th className="w-40 px-3 py-2 font-medium">{t('production_planning.routings.detail.setupMinutes', 'Setup min / order')}</th>
                  <th className="w-32 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {steps.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                      {t('production_planning.routings.detail.empty', 'No steps — orders of this product will not appear on the plan.')}
                    </td>
                  </tr>
                ) : null}
                {steps.map((step, index) => {
                  const centre = centreById.get(step.workCenterId)
                  return (
                    <tr key={step.key} className="border-b last:border-b-0">
                      <td className="px-3 py-2 tabular-nums">{index + 1}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block size-2.5 shrink-0 rounded-sm ${STAGE_CLASSES[centre?.stage ?? 'other']}`} />
                          <select
                            className={SELECT_CLASS}
                            value={step.workCenterId}
                            onChange={(event) => update(step.key, { workCenterId: event.target.value })}
                          >
                            <option value="">{t('production_planning.routings.detail.chooseCentre', '— choose a work centre —')}</option>
                            {centres.map((entry) => (
                              <option key={entry.id} value={entry.id}>
                                {entry.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          step="0.5"
                          value={step.minutesPerUnit}
                          onChange={(event) => update(step.key, { minutesPerUnit: event.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          value={step.setupMinutes}
                          onChange={(event) => update(step.key, { setupMinutes: event.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="ghost" size="sm" onClick={() => move(index, -1)} disabled={index === 0}
                            aria-label={t('production_planning.routings.detail.up', 'Move up')}>
                            <ArrowUp className="size-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => move(index, 1)} disabled={index === steps.length - 1}
                            aria-label={t('production_planning.routings.detail.down', 'Move down')}>
                            <ArrowDown className="size-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="sm"
                            onClick={() => setSteps((current) => current.filter((entry) => entry.key !== step.key))}
                            aria-label={t('production_planning.common.delete', 'Delete')}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setSteps((current) => [...current, { key: nextKey(), workCenterId: '', minutesPerUnit: '0', setupMinutes: '0' }])
              }
            >
              <Plus className="size-4" />
              {t('production_planning.routings.detail.addStep', 'Add step')}
            </Button>
            <div className="flex items-center gap-4">
              <span className={`text-sm tabular-nums ${matches ? 'text-muted-foreground' : 'font-medium text-amber-700'}`}>
                {t('production_planning.routings.detail.total', 'Routing: {routing} min / unit · BOM labour time: {labor} min', {
                  routing: Math.round(totalMinutes * 100) / 100,
                  labor: laborMinutes,
                })}
              </span>
              <Button type="button" onClick={() => void save()} disabled={!valid || isSaving}>
                {t('production_planning.routings.detail.save', 'Save routing')}
              </Button>
            </div>
          </div>
        </div>
      </PageBody>
    </Page>
  )
}
