'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall, apiCallOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import { buildOrderFields, toOrderPayload, type OrderFormValues } from '../../../../components/orderFormFields'
import type { ListResponse, OrderRow, PlanResponse } from '../../../../components/types'
import { RequirementsTable } from '../../../../components/RequirementsTable'
import { STAGE_CLASSES, formatDate, formatHours } from '../../../../components/planFormat'
import { aggregateRequirements, buildPlanView, type PlanInput } from '../../../../lib/plan-model'

/**
 * One order: its fields, the operations the plan derives for it from the
 * product routing (which work centre, which days, how many minutes) and the
 * material it takes — the same numbers the plan screen shows for this order.
 */
export default function OrderDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const orderId = String(params?.id ?? '')
  const [order, setOrder] = React.useState<OrderRow | null>(null)
  const [input, setInput] = React.useState<PlanInput | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadToken, setReloadToken] = React.useState(0)

  React.useEffect(() => {
    if (!orderId) {
      setIsLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      setError(null)
      const [orderCall, planCall] = await Promise.all([
        apiCall<ListResponse<OrderRow>>(`/api/production_planning/orders?id=${encodeURIComponent(orderId)}`).catch(() => null),
        apiCall<PlanResponse>('/api/production_planning/plan?days=60').catch(() => null),
      ])
      if (cancelled) return
      const found = orderCall?.ok ? orderCall.result?.items?.[0] : undefined
      if (!found) {
        setError(t('production_planning.orders.detail.notFound', 'Order not found.'))
      } else {
        setOrder(found)
        setInput(planCall?.ok ? planCall.result?.input ?? null : null)
      }
      setIsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [orderId, reloadToken, t])

  const fields = React.useMemo(() => buildOrderFields(t), [t])

  const scheduled = React.useMemo(() => {
    if (!input || !order) return null
    const view = buildPlanView({ ...input, from: input.today, days: 1 })
    const schedule = view.scheduleByOrder[order.id] ?? null
    if (!schedule) return { schedule: null, requirements: [] }
    const requirements = aggregateRequirements(
      { ...input, orders: input.orders.filter((entry) => entry.id === order.id) },
      [schedule],
      [schedule.start ?? input.today, schedule.end ?? input.today],
    )
    return { schedule, requirements }
  }, [input, order])

  const handleSubmit = React.useCallback(
    async (values: OrderFormValues) => {
      await updateCrud('production_planning/orders', { id: orderId, ...toOrderPayload(values) }, {
        errorMessage: t('production_planning.orders.create.failed', 'Could not save the order.'),
      })
      flash(t('production_planning.common.saved', 'Saved.'), 'success')
      setReloadToken((token) => token + 1)
    },
    [orderId, t],
  )

  const handleDelete = React.useCallback(async () => {
    await apiCallOrThrow(`/api/production_planning/orders?id=${encodeURIComponent(orderId)}`, { method: 'DELETE' })
    flash(t('production_planning.common.deleted', 'Deleted.'), 'success')
    router.push('/backend/production-planning/orders')
  }, [orderId, router, t])

  if (isLoading && !order) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('production_planning.common.loading', 'Loading…')} />
        </PageBody>
      </Page>
    )
  }
  if (error || !order) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={error ?? t('production_planning.orders.detail.notFound', 'Order not found.')} />
        </PageBody>
      </Page>
    )
  }

  const centres = new Map((input?.workCenters ?? []).map((centre) => [centre.id, centre]))
  const schedule = scheduled?.schedule ?? null
  const onPlan = order.status === 'planned' || order.status === 'in_progress'

  return (
    <Page>
      <PageBody>
        <div className="space-y-8">
          <CrudForm<OrderFormValues>
            key={`${order.id}:${order.updated_at ?? ''}`}
            fields={fields}
            initialValues={{
              productId: order.product_id,
              quantity: order.quantity,
              dueDate: order.due_date,
              priority: order.priority,
              status: order.status,
              fabricMaterialId: order.fabric_material_id ?? '',
              number: order.number,
              reference: order.reference ?? '',
              notes: order.notes ?? '',
            }}
            title={`${order.number} · ${order.product_name ?? ''}`}
            backHref="/backend/production-planning/orders"
            cancelHref="/backend/production-planning/orders"
            submitLabel={t('production_planning.common.save', 'Save')}
            onSubmit={handleSubmit}
            onDelete={handleDelete}
            twoColumn
            extraActions={
              <Button asChild variant="outline" type="button">
                <Link href="/backend/production-planning/plan">{t('production_planning.orders.list.openPlan', 'Open the plan')}</Link>
              </Button>
            }
          />

          <section className="space-y-2">
            <div>
              <h2 className="text-base font-semibold">{t('production_planning.orders.detail.operations', 'Operations')}</h2>
              <p className="text-sm text-muted-foreground">
                {t(
                  'production_planning.orders.detail.operationsHint',
                  'Derived from the product routing, backwards from the due date. Change the due date or the routing and they follow.',
                )}
              </p>
            </div>
            {!onPlan ? (
              <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
                {t('production_planning.orders.detail.offPlan', 'Done and cancelled orders are not on the plan.')}
              </p>
            ) : !schedule || schedule.missingRouting ? (
              <p className="rounded-lg border bg-card px-4 py-3 text-sm text-amber-700">
                {t('production_planning.plan.orders.missingRouting', 'Product has no routing — not on the plan')}{' '}
                <Link href={`/backend/production-planning/routings/${order.product_id}`} className="font-medium underline">
                  {t('production_planning.orders.detail.setRouting', 'Set the routing')}
                </Link>
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border bg-card">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">{t('production_planning.workCenters.fields.name', 'Work centre')}</th>
                      <th className="px-3 py-2 font-medium">{t('production_planning.orders.detail.from', 'From')}</th>
                      <th className="px-3 py-2 font-medium">{t('production_planning.orders.detail.to', 'To')}</th>
                      <th className="px-3 py-2 text-right font-medium">{t('production_planning.orders.detail.time', 'Time')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.operations.map((operation) => {
                      const centre = centres.get(operation.workCenterId)
                      return (
                        <tr key={`${operation.sequence}-${operation.workCenterId}`} className="border-b last:border-b-0">
                          <td className="px-3 py-2 tabular-nums">{operation.sequence}</td>
                          <td className="px-3 py-2">
                            <span className="flex items-center gap-2">
                              <span className={`inline-block size-2.5 rounded-sm ${STAGE_CLASSES[centre?.stage ?? 'other']}`} />
                              {centre?.name ?? '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2 tabular-nums">{formatDate(operation.start, locale)}</td>
                          <td className="px-3 py-2 tabular-nums">{formatDate(operation.end, locale)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatHours(operation.minutes)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {input && scheduled && onPlan ? (
            <RequirementsTable
              lines={scheduled.requirements}
              input={input}
              title={t('production_planning.orders.detail.requirements', 'Material for this order')}
              description={t(
                'production_planning.orders.detail.requirementsHint',
                'From the product BOM × quantity, with the cutting allowance; the fabric chosen on the order is counted separately.',
              )}
            />
          ) : null}
        </div>
      </PageBody>
    </Page>
  )
}
