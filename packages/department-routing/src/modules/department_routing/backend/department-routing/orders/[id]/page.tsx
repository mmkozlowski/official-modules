'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ExternalLink, PackageCheck, Split } from 'lucide-react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { SectionHeader } from '@open-mercato/ui/backend/SectionHeader'
import { Button } from '@open-mercato/ui/primitives/button'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { Progress } from '@open-mercato/ui/primitives/progress'
import { apiCall, apiCallOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import type { ListResponse, OrderView, ProductRow } from '../../../../components/types'
import { OrderLinesEditor } from '../../../../components/OrderLinesEditor'
import { OrderStatusLabel } from '../../../../components/OrderStatusLabel'
import { useLiveRefresh } from '../../../../components/useLiveRefresh'
import { ORDER_STATUS_VARIANT, TASK_STATUS_VARIANT, daysUntil, formatDate } from '../../../../components/presentation'

type DepartmentCard = OrderView['departments'][number]

/**
 * The order screen. While the order is `new`: its lines and where each product
 * will go. Once accepted: one card per department with what it has done — and
 * the status at the top follows the departments by itself, live.
 */
export default function OrderDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const orderId = String(params?.id ?? '')
  const { confirm, ConfirmDialogElement } = useConfirmDialog()

  const [view, setView] = React.useState<OrderView | null>(null)
  const [products, setProducts] = React.useState<ProductRow[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isAccepting, setIsAccepting] = React.useState(false)
  const [linesDirty, setLinesDirty] = React.useState(false)
  const [changedDepartments, setChangedDepartments] = React.useState<Set<string>>(new Set())
  const previousDone = React.useRef<Map<string, number> | null>(null)

  const applyView = React.useCallback((next: OrderView) => {
    // Remember which department moved since the last read, to light its card up for a moment.
    const before = previousDone.current
    const moved = new Set<string>()
    if (before) {
      for (const department of next.departments) {
        const was = before.get(department.id)
        if (was !== undefined && was !== department.quantityDone) moved.add(department.id)
      }
    }
    previousDone.current = new Map(next.departments.map((department) => [department.id, department.quantityDone]))
    setView(next)
    if (moved.size) {
      setChangedDepartments(moved)
      window.setTimeout(() => setChangedDepartments(new Set()), 1800)
    }
  }, [])

  const load = React.useCallback(
    async (silent: boolean) => {
      if (!orderId) return
      if (!silent) setIsLoading(true)
      const call = await apiCall<OrderView>(`/api/department_routing/orders/${encodeURIComponent(orderId)}/progress`).catch(
        () => null,
      )
      if (call?.ok && call.result) {
        applyView(call.result)
        setError(null)
      } else if (!silent) {
        setError(t('department_routing.orders.detail.notFound', 'Order not found.'))
      }
      if (!silent) setIsLoading(false)
    },
    [applyView, orderId, t],
  )

  React.useEffect(() => {
    void load(false)
    void apiCall<ListResponse<ProductRow>>('/api/department_routing/products?pageSize=100&isActive=true&sortField=name&sortDir=asc')
      .then((call) => setProducts(call.ok ? call.result?.items ?? [] : []))
      .catch(() => setProducts([]))
  }, [load])

  // Live: another window reports in a department → this screen follows. Paused
  // while unsaved line edits are open, so a refresh never wipes typing.
  useLiveRefresh(
    React.useCallback(() => {
      if (!linesDirty) void load(true)
    }, [linesDirty, load]),
    2000,
  )

  const accept = React.useCallback(async () => {
    if (!view) return
    if (linesDirty) {
      flash(t('department_routing.orders.accept.saveFirst', 'Save the order lines first.'), 'error')
      return
    }
    const departments = new Set(view.lines.flatMap((line) => line.departmentNames))
    const confirmed = await confirm({
      title: t('department_routing.orders.accept.confirmTitle', 'Accept {number} for production?', { number: view.order.number }),
      text: t(
        'department_routing.orders.accept.confirmText',
        'The order will split into tasks for {count} departments: {names}. Lines can no longer be changed.',
        { count: departments.size, names: Array.from(departments).join(', ') },
      ),
    })
    if (!confirmed) return
    setIsAccepting(true)
    try {
      const call = await apiCall<OrderView & { error?: string; productName?: string }>(
        `/api/department_routing/orders/${encodeURIComponent(view.order.id)}/accept`,
        { method: 'POST' },
      )
      if (!call.ok || !call.result) {
        const body = call.result as { error?: string; productName?: string } | null
        if (body?.error === 'no_routing') {
          flash(
            t('department_routing.orders.accept.noRouting', '"{product}" has no departments — set its routing first.', {
              product: body.productName ?? '',
            }),
            'error',
          )
        } else if (body?.error === 'no_lines') {
          flash(t('department_routing.orders.accept.noLines', 'Add at least one product first.'), 'error')
        } else {
          flash(t('department_routing.orders.accept.failed', 'The order was not accepted.'), 'error')
        }
        return
      }
      const result = call.result
      const taskCount = result.departments.reduce((sum, department) => sum + department.taskCount, 0)
      flash(
        t('department_routing.orders.accept.done', 'Accepted — split into {tasks} tasks for {departments} departments.', {
          tasks: taskCount,
          departments: result.departments.length,
        }),
        'success',
      )
      applyView(result)
    } finally {
      setIsAccepting(false)
    }
  }, [applyView, confirm, linesDirty, t, view])

  const remove = React.useCallback(async () => {
    if (!view) return
    const confirmed = await confirm({
      title: t('department_routing.orders.list.deleteConfirm', 'Delete {count} order(s)?', { count: 1 }),
      variant: 'destructive',
    })
    if (!confirmed) return
    await apiCallOrThrow(`/api/department_routing/orders?id=${encodeURIComponent(view.order.id)}`, { method: 'DELETE' })
    flash(t('department_routing.common.deleted', 'Deleted.'), 'success')
    router.push('/backend/department-routing/orders')
  }, [confirm, router, t, view])

  if (isLoading && !view) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('department_routing.common.loading', 'Loading…')} />
        </PageBody>
      </Page>
    )
  }
  if (error || !view) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={error ?? t('department_routing.orders.detail.notFound', 'Order not found.')} />
        </PageBody>
      </Page>
    )
  }

  const { order } = view
  const days = daysUntil(order.dueDate)
  const plannedDepartments = Array.from(new Set(view.lines.flatMap((line) => line.departmentNames)))

  return (
    <Page>
      <PageBody>
        <div className="space-y-8">
          <div className="rounded-lg border bg-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <Link href="/backend/department-routing/orders" className="text-sm text-muted-foreground hover:underline">
                  ← {t('department_routing.orders.list.title', 'Production orders')}
                </Link>
                <h1 className="text-2xl font-semibold tabular-nums">{order.number}</h1>
                <p className="text-muted-foreground">
                  {order.customerName}
                  {' · '}
                  {t('department_routing.orders.fields.dueDate', 'Due date')}: {formatDate(order.dueDate, locale)}
                  {days !== null && order.status !== 'ready_to_ship' ? (
                    <span className={days < 0 ? ' font-medium text-destructive' : ''}>
                      {' '}
                      (
                      {days < 0
                        ? t('department_routing.orders.detail.overdue', '{count} days late', { count: -days })
                        : t('department_routing.orders.detail.daysLeft', 'in {count} days', { count: days })}
                      )
                    </span>
                  ) : null}
                </p>
                {order.notes ? <p className="text-sm text-muted-foreground">{order.notes}</p> : null}
              </div>
              <div className="flex flex-col items-end gap-3">
                <StatusBadge variant={ORDER_STATUS_VARIANT[order.status]} dot className="px-3 py-1 text-base" data-testid="order-status">
                  <OrderStatusLabel
                    status={order.status}
                    departmentsDone={order.departmentsDone}
                    departmentsTotal={order.departmentsTotal}
                  />
                </StatusBadge>
                <div className="flex gap-2">
                  {order.status === 'new' ? (
                    <Button type="button" onClick={() => void accept()} disabled={isAccepting} data-testid="accept-order">
                      <Split className="size-4" />
                      {t('department_routing.orders.accept.button', 'Accept for production')}
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" onClick={() => void remove()}>
                    {t('department_routing.common.delete', 'Delete')}
                  </Button>
                </div>
              </div>
            </div>
            {order.departmentsTotal > 0 ? (
              <div className="mt-6 flex items-center gap-3">
                <Progress value={order.departmentsDone} max={order.departmentsTotal} className="h-3 flex-1" />
                <span className="text-sm font-medium tabular-nums" data-testid="order-progress">
                  {t('department_routing.orders.detail.departmentsDone', '{done} of {total} departments done', {
                    done: order.departmentsDone,
                    total: order.departmentsTotal,
                  })}
                </span>
              </div>
            ) : null}
            {order.status === 'ready_to_ship' ? (
              <div className="mt-6 flex items-center gap-3 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">
                <PackageCheck className="size-6 shrink-0" />
                <span className="font-medium">
                  {t('department_routing.orders.detail.readyBanner', 'Ready to ship — every department has finished its work.')}
                </span>
              </div>
            ) : null}
          </div>

          {order.status === 'new' ? (
            <>
              <OrderLinesEditor
                key={order.updatedAt}
                view={view}
                products={products}
                onSaved={applyView}
                onDirtyChange={setLinesDirty}
              />
              {plannedDepartments.length ? (
                <p className="text-sm text-muted-foreground">
                  {t('department_routing.orders.detail.willSplit', 'After acceptance this order goes to: {names}.', {
                    names: plannedDepartments.join(', '),
                  })}
                </p>
              ) : null}
            </>
          ) : (
            <div className="space-y-3">
              <SectionHeader
                title={t('department_routing.orders.detail.departments', 'Departments')}
                count={view.departments.length}
              />
              <div className="grid gap-4 md:grid-cols-2" data-testid="department-cards">
                {view.departments.map((department) => (
                  <DepartmentProgressCard
                    key={department.id}
                    department={department}
                    highlighted={changedDepartments.has(department.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </PageBody>
      {ConfirmDialogElement}
    </Page>
  )
}

function DepartmentProgressCard({ department, highlighted }: { department: DepartmentCard; highlighted: boolean }) {
  const t = useT()
  const done = department.status === 'done'
  return (
    <div
      data-testid="department-card"
      data-department={department.name}
      className={[
        'rounded-lg border bg-card p-4 transition-all duration-500',
        done ? 'border-emerald-300 dark:border-emerald-800' : '',
        highlighted ? 'ring-4 ring-amber-300 dark:ring-amber-600' : '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {done ? <CheckCircle2 className="size-5 text-emerald-600" /> : null}
          <h3 className="text-lg font-semibold">{department.name}</h3>
        </div>
        <StatusBadge variant={TASK_STATUS_VARIANT[department.status]} dot>
          {t(`department_routing.departmentStatus.${department.status}`, department.status)}
        </StatusBadge>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Progress value={department.quantityDone} max={department.quantityRequired || 1} className="h-2 flex-1" />
        <span className="text-sm tabular-nums">
          {department.quantityDone}/{department.quantityRequired} {t('department_routing.common.pcs', 'pcs')}
        </span>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {department.tasks.map((task) => (
          <li key={task.id} className="flex items-center justify-between gap-2">
            <span className={task.status === 'done' ? 'text-muted-foreground line-through' : ''}>{task.productName}</span>
            <span className="tabular-nums text-muted-foreground">
              {task.quantityDone}/{task.quantityRequired}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <Link
          href={`/backend/department-routing/board?department=${encodeURIComponent(department.id)}`}
          target="_blank"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          {t('department_routing.orders.detail.openBoard', 'Open department board')}
          <ExternalLink className="size-3" />
        </Link>
      </div>
    </div>
  )
}
