'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, Minus, Plus } from 'lucide-react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Progress } from '@open-mercato/ui/primitives/progress'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { EmptyState } from '@open-mercato/ui/primitives/empty-state'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import type { BoardTask, DepartmentRow, ListResponse, TaskStatus } from '../../../components/types'
import { OrderStatusLabel } from '../../../components/OrderStatusLabel'
import { useLiveRefresh } from '../../../components/useLiveRefresh'
import { ORDER_STATUS_VARIANT, daysUntil, formatDate } from '../../../components/presentation'

const COLUMNS: TaskStatus[] = ['pending', 'in_progress', 'done']

/**
 * A department's board: its tasks in three columns — to do, in progress, done.
 * Each card takes a report in one click (+1, a typed amount, or "all"), also
 * partial. The department is in the URL, so two windows can show two
 * departments side by side.
 */
export default function DepartmentBoardPage() {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const departmentId = searchParams?.get('department') ?? ''

  const [departments, setDepartments] = React.useState<DepartmentRow[] | null>(null)
  const [tasks, setTasks] = React.useState<BoardTask[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [busyTaskId, setBusyTaskId] = React.useState<string | null>(null)

  React.useEffect(() => {
    void apiCall<ListResponse<DepartmentRow>>('/api/department_routing/departments?pageSize=100&isActive=true&sortField=position&sortDir=asc')
      .then((call) => {
        if (!call.ok || !call.result) {
          setError(t('department_routing.board.loadFailed', 'Could not load departments.'))
          setDepartments([])
          return
        }
        setDepartments(call.result.items ?? [])
      })
      .catch(() => {
        setError(t('department_routing.board.loadFailed', 'Could not load departments.'))
        setDepartments([])
      })
  }, [t])

  // No department in the URL — open the first one.
  React.useEffect(() => {
    if (!departments?.length || departments.some((department) => department.id === departmentId)) return
    router.replace(`${pathname}?department=${encodeURIComponent(departments[0].id)}`)
  }, [departmentId, departments, pathname, router])

  const loadTasks = React.useCallback(
    async (silent: boolean) => {
      if (!departmentId) return
      if (!silent) setIsLoading(true)
      const call = await apiCall<{ items: BoardTask[] }>(
        `/api/department_routing/tasks?departmentId=${encodeURIComponent(departmentId)}`,
      ).catch(() => null)
      if (call?.ok && call.result) {
        setTasks(call.result.items ?? [])
        setError(null)
      } else if (!silent) {
        setError(t('department_routing.board.tasksFailed', 'Could not load the tasks.'))
      }
      if (!silent) setIsLoading(false)
    },
    [departmentId, t],
  )

  React.useEffect(() => {
    void loadTasks(false)
  }, [loadTasks])

  useLiveRefresh(
    React.useCallback(() => {
      if (!busyTaskId) void loadTasks(true)
    }, [busyTaskId, loadTasks]),
    2000,
  )

  const report = React.useCallback(
    async (task: BoardTask, body: { add?: number; set?: number }) => {
      setBusyTaskId(task.id)
      try {
        const call = await apiCall<{
          task: BoardTask
          order: { status: BoardTask['orderStatus']; departmentsDone: number; departmentsTotal: number; number: string }
          error?: string
        }>(`/api/department_routing/tasks/${encodeURIComponent(task.id)}/report`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!call.ok || !call.result?.task) {
          const code = (call.result as { error?: string } | null)?.error
          flash(
            code === 'over_required'
              ? t('department_routing.board.overRequired', 'That is more than the task needs ({count} pcs).', {
                  count: task.quantityRequired - task.quantityDone,
                })
              : t('department_routing.board.reportFailed', 'The report was not saved.'),
            'error',
          )
          return
        }
        const { task: saved, order } = call.result
        setTasks((current) =>
          current.map((item) =>
            item.id === saved.id
              ? { ...item, ...saved, orderStatus: order.status, orderDepartmentsDone: order.departmentsDone, orderDepartmentsTotal: order.departmentsTotal }
              : item.orderId === saved.orderId
                ? { ...item, orderStatus: order.status, orderDepartmentsDone: order.departmentsDone, orderDepartmentsTotal: order.departmentsTotal }
                : item,
          ),
        )
        if (order.status === 'ready_to_ship' && task.orderStatus !== 'ready_to_ship') {
          flash(t('department_routing.board.orderReady', 'Order {number} is ready to ship.', { number: order.number }), 'success')
        } else if (saved.status === 'done' && task.status !== 'done') {
          flash(t('department_routing.board.taskDone', '{product} — done in this department.', { product: saved.productName }), 'success')
        }
      } finally {
        setBusyTaskId(null)
      }
    },
    [t],
  )

  if (departments === null) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('department_routing.common.loading', 'Loading…')} />
        </PageBody>
      </Page>
    )
  }
  if (!departments.length) {
    return (
      <Page>
        <PageBody>
          {error ? (
            <ErrorMessage label={error} />
          ) : (
            <EmptyState
              title={t('department_routing.board.noDepartments', 'No departments yet')}
              description={t('department_routing.board.noDepartmentsHint', 'Add departments first, then set which products they make.')}
            />
          )}
        </PageBody>
      </Page>
    )
  }

  const current = departments.find((department) => department.id === departmentId)
  const openUnits = tasks.filter((task) => task.status !== 'done').reduce((sum, task) => sum + task.quantityRequired - task.quantityDone, 0)

  return (
    <Page>
      <PageBody>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold" data-testid="board-title">
                {current ? current.name : t('department_routing.board.title', 'Department board')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('department_routing.board.openUnits', '{count} pcs left to make', { count: openUnits })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2" role="tablist">
              {departments.map((department) => (
                <Button
                  key={department.id}
                  type="button"
                  size="sm"
                  role="tab"
                  aria-selected={department.id === departmentId}
                  variant={department.id === departmentId ? 'default' : 'outline'}
                  onClick={() => router.replace(`${pathname}?department=${encodeURIComponent(department.id)}`)}
                >
                  {department.name}
                </Button>
              ))}
            </div>
          </div>

          {error ? <ErrorMessage label={error} /> : null}
          {isLoading && !tasks.length ? <LoadingMessage label={t('department_routing.common.loading', 'Loading…')} /> : null}

          <div className="grid gap-4 lg:grid-cols-3">
            {COLUMNS.map((column) => {
              const columnTasks = tasks.filter((task) => task.status === column)
              return (
                <div key={column} className="rounded-lg border bg-muted/30 p-3" data-testid={`board-column-${column}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-semibold">{t(`department_routing.board.column.${column}`, column)}</h2>
                    <span className="text-sm tabular-nums text-muted-foreground">{columnTasks.length}</span>
                  </div>
                  <div className="space-y-3">
                    {columnTasks.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        {t('department_routing.board.columnEmpty', 'Nothing here.')}
                      </p>
                    ) : null}
                    {columnTasks.map((task) => (
                      <TaskCard key={task.id} task={task} busy={busyTaskId === task.id} onReport={report} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </PageBody>
    </Page>
  )
}

function TaskCard({
  task,
  busy,
  onReport,
}: {
  task: BoardTask
  busy: boolean
  onReport: (task: BoardTask, body: { add?: number; set?: number }) => Promise<void>
}) {
  const t = useT()
  const locale = useLocale()
  const [amount, setAmount] = React.useState('')
  const remaining = task.quantityRequired - task.quantityDone
  const days = daysUntil(task.dueDate)

  const submitAmount = async () => {
    const value = Number(amount)
    if (!Number.isInteger(value) || value < 1) return
    await onReport(task, { add: value })
    setAmount('')
  }

  return (
    <div className="rounded-md border bg-card p-3 shadow-sm" data-testid="task-card" data-product={task.productName} data-order={task.orderNumber}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link href={`/backend/department-routing/orders/${task.orderId}`} className="text-sm font-medium tabular-nums hover:underline">
            {task.orderNumber}
          </Link>
          <p className="text-xs text-muted-foreground">{task.customerName}</p>
        </div>
        <span className={['text-xs tabular-nums', days !== null && days < 0 && task.status !== 'done' ? 'font-medium text-destructive' : 'text-muted-foreground'].join(' ')}>
          {formatDate(task.dueDate, locale)}
        </span>
      </div>
      <p className="mt-2 font-medium">{task.productName}</p>
      <div className="mt-2 flex items-center gap-3">
        <Progress value={task.quantityDone} max={task.quantityRequired} className="h-2 flex-1" />
        <span className="text-lg font-semibold tabular-nums" data-testid="task-quantity">
          {task.quantityDone}/{task.quantityRequired}
        </span>
      </div>
      {task.status !== 'done' ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void onReport(task, { add: 1 })} data-testid="report-one">
            <Plus className="size-4" />1
          </Button>
          <Input
            inputMode="numeric"
            className="h-8 w-16 tabular-nums"
            placeholder={String(remaining)}
            value={amount}
            aria-label={t('department_routing.board.amount', 'Done now (pcs)')}
            onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ''))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submitAmount()
            }}
          />
          <Button type="button" size="sm" variant="outline" disabled={busy || !amount} onClick={() => void submitAmount()}>
            {t('department_routing.board.report', 'Report')}
          </Button>
          <Button type="button" size="sm" disabled={busy} onClick={() => void onReport(task, { add: remaining })} data-testid="report-all">
            <Check className="size-4" />
            {t('department_routing.board.all', 'All ({count})', { count: remaining })}
          </Button>
          {task.quantityDone > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void onReport(task, { set: task.quantityDone - 1 })}
              aria-label={t('department_routing.board.undoOne', 'Take one back')}
            >
              <Minus className="size-4" />1
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-2">
          <StatusBadge variant={ORDER_STATUS_VARIANT[task.orderStatus]}>
            <OrderStatusLabel
              status={task.orderStatus}
              departmentsDone={task.orderDepartmentsDone}
              departmentsTotal={task.orderDepartmentsTotal}
            />
          </StatusBadge>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => void onReport(task, { set: task.quantityDone - 1 })}
            aria-label={t('department_routing.board.undoOne', 'Take one back')}
          >
            <Minus className="size-4" />1
          </Button>
        </div>
      )}
    </div>
  )
}
