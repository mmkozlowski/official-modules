'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight, Plus, RefreshCw } from 'lucide-react'
import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { buildPlanView, type PlanInput, type PlanOrder, type PlanView } from '../../../lib/plan-model'
import { shiftWorkingDays, workingDayOnOrAfter, type IsoDate } from '../../../lib/schedule'
import { PlanBoard } from '../../../components/PlanBoard'
import { RequirementsTable } from '../../../components/RequirementsTable'
import { UrgentOrderDialog } from '../../../components/UrgentOrderDialog'
import { formatShortDate } from '../../../components/planFormat'
import type { PlanResponse } from '../../../components/types'

const WINDOW_DAYS = 10
const PAGE_STEP_DAYS = 5
const HIGHLIGHT_MS = 1800

/** `centreId|date` keys whose minutes differ between two plans. */
function changedLoadCells(before: PlanView, after: PlanView): Set<string> {
  const minutes = new Map<string, number>()
  for (const row of before.load) for (const cell of row.cells) minutes.set(`${row.workCenterId}|${cell.date}`, cell.minutes)
  const changed = new Set<string>()
  for (const row of after.load) {
    for (const cell of row.cells) {
      const key = `${row.workCenterId}|${cell.date}`
      if ((minutes.get(key) ?? 0) !== cell.minutes) changed.add(key)
    }
  }
  return changed
}

function changedRequirements(before: PlanView, after: PlanView): Set<string> {
  const previous = new Map(before.requirements.map((line) => [line.materialId, line.requiredQuantity]))
  return new Set(
    after.requirements.filter((line) => previous.get(line.materialId) !== line.requiredQuantity).map((line) => line.materialId),
  )
}

/**
 * The production plan. Holds the plan INPUT in state and derives the whole plan
 * from it on every render, with the same pure functions the server uses. A moved
 * due date or a new urgent order is a state change: the load grid, the timeline
 * and the material list repaint immediately; the save runs behind it and is
 * rolled back on screen if the server refuses.
 */
export default function ProductionPlanPage() {
  const t = useT()
  const locale = useLocale()
  const scopeVersion = useOrganizationScopeVersion()
  const [from, setFrom] = React.useState<IsoDate | null>(null)
  const [input, setInput] = React.useState<PlanInput | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)
  const [busyOrderId, setBusyOrderId] = React.useState<string | null>(null)
  const [urgentOpen, setUrgentOpen] = React.useState(false)
  const [changedCells, setChangedCells] = React.useState<ReadonlySet<string>>(new Set())
  const [changedOrders, setChangedOrders] = React.useState<ReadonlySet<string>>(new Set())
  const [changedMaterials, setChangedMaterials] = React.useState<ReadonlySet<string>>(new Set())
  const inputRef = React.useRef<PlanInput | null>(null)
  inputRef.current = input
  const highlightTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      setError(null)
      const query = new URLSearchParams({ days: String(WINDOW_DAYS) })
      if (from) query.set('from', from)
      const call = await apiCall<PlanResponse>(`/api/production_planning/plan?${query.toString()}`).catch(() => null)
      if (cancelled) return
      if (!call?.ok || !call.result?.input) {
        setError(t('production_planning.plan.loadFailed', 'Could not load the plan.'))
        setIsLoading(false)
        return
      }
      setInput(call.result.input)
      setIsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [from, reloadToken, scopeVersion, t])

  React.useEffect(() => () => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
  }, [])

  const view = React.useMemo(() => (input ? buildPlanView(input) : null), [input])

  /** Swaps in a new input and lights up what changed. */
  const commit = React.useCallback((next: PlanInput, orderIds: string[]) => {
    const current = inputRef.current
    if (current) {
      const before = buildPlanView(current)
      const after = buildPlanView(next)
      setChangedCells(changedLoadCells(before, after))
      setChangedMaterials(changedRequirements(before, after))
    }
    setChangedOrders(new Set(orderIds))
    setInput(next)
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => {
      setChangedCells(new Set())
      setChangedOrders(new Set())
      setChangedMaterials(new Set())
    }, HIGHLIGHT_MS)
  }, [])

  const setDueDate = React.useCallback(
    async (orderId: string, dueDate: IsoDate) => {
      const current = inputRef.current
      const order = current?.orders.find((entry) => entry.id === orderId)
      if (!current || !order || order.dueDate === dueDate) return
      const previousDueDate = order.dueDate
      const next: PlanInput = {
        ...current,
        orders: current.orders.map((entry) => (entry.id === orderId ? { ...entry, dueDate } : entry)),
      }
      const overloadedBefore = buildPlanView(current).overloadedCells
      const overloadedAfter = buildPlanView(next).overloadedCells
      commit(next, [orderId])
      setBusyOrderId(orderId)
      const call = await apiCall(`/api/production_planning/orders/${encodeURIComponent(orderId)}/reschedule`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dueDate }),
      }).catch(() => null)
      setBusyOrderId(null)
      if (!call?.ok) {
        const latest = inputRef.current
        if (latest) {
          commit(
            { ...latest, orders: latest.orders.map((entry) => (entry.id === orderId ? { ...entry, dueDate: previousDueDate } : entry)) },
            [orderId],
          )
        }
        flash(t('production_planning.plan.moveFailed', 'The new due date could not be saved — the plan is back as it was.'), 'error')
        return
      }
      const message = t(
        'production_planning.plan.moved',
        '{number}: due {from} → {to}. Overloaded work-centre days: {before} → {after}.',
        {
          number: order.number,
          from: formatShortDate(previousDueDate, locale),
          to: formatShortDate(dueDate, locale),
          before: overloadedBefore,
          after: overloadedAfter,
        },
      )
      flash(message, overloadedAfter > overloadedBefore ? 'warning' : 'success')
    },
    [commit, locale, t],
  )

  const moveOrder = React.useCallback(
    (orderId: string, workingDays: number) => {
      const order = inputRef.current?.orders.find((entry) => entry.id === orderId)
      if (!order) return
      void setDueDate(orderId, shiftWorkingDays(order.dueDate, workingDays))
    },
    [setDueDate],
  )

  const addOrder = React.useCallback(
    (order: PlanOrder) => {
      const current = inputRef.current
      setUrgentOpen(false)
      if (!current) return
      const overloadedBefore = buildPlanView(current).overloadedCells
      const next = { ...current, orders: [...current.orders, order] }
      const overloadedAfter = buildPlanView(next).overloadedCells
      commit(next, [order.id])
      flash(
        t('production_planning.plan.added', '{number} added. Overloaded work-centre days: {before} → {after}.', {
          number: order.number,
          before: overloadedBefore,
          after: overloadedAfter,
        }),
        overloadedAfter > overloadedBefore ? 'warning' : 'success',
      )
    },
    [commit, t],
  )

  if (isLoading && !input) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('production_planning.common.loading', 'Loading…')} />
        </PageBody>
      </Page>
    )
  }
  if (error || !input || !view) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={error ?? t('production_planning.plan.loadFailed', 'Could not load the plan.')} />
        </PageBody>
      </Page>
    )
  }

  const first = view.days[0]
  const last = view.days[view.days.length - 1]
  const peak = view.load.reduce<{ name: string; percent: number } | null>((best, row) => {
    const centre = input.workCenters.find((entry) => entry.id === row.workCenterId)
    if (!centre) return best
    return !best || row.peakPercent > best.percent ? { name: centre.name, percent: row.peakPercent } : best
  }, null)
  const ordersInWindow = new Set(view.load.flatMap((row) => row.cells.flatMap((cell) => cell.orderIds))).size

  return (
    <Page>
      <PageHeader
        title={t('production_planning.plan.title', 'Production plan')}
        description={t('production_planning.plan.window', '{from} – {to} · {days} working days', {
          from: formatShortDate(first, locale),
          to: formatShortDate(last, locale),
          days: view.days.length,
        })}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFrom(shiftWorkingDays(first, -PAGE_STEP_DAYS))}
              aria-label={t('production_planning.plan.previous', 'Previous week')}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setFrom(workingDayOnOrAfter(input.today))}>
              {t('production_planning.plan.fromToday', 'From today')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFrom(shiftWorkingDays(first, PAGE_STEP_DAYS))}
              aria-label={t('production_planning.plan.next', 'Next week')}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReloadToken((token) => token + 1)}
              aria-label={t('production_planning.common.refresh', 'Refresh')}
            >
              <RefreshCw className="size-4" />
            </Button>
            <Button size="sm" onClick={() => setUrgentOpen(true)} data-testid="urgent-open">
              <Plus className="size-4" />
              {t('production_planning.urgent.open', 'Urgent order')}
            </Button>
          </>
        }
      />
      <PageBody>
        <div className="space-y-8">
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryTile
              label={t('production_planning.plan.summary.overloaded', 'Overloaded work-centre days')}
              value={String(view.overloadedCells)}
              tone={view.overloadedCells > 0 ? 'bad' : 'good'}
              testId="summary-overloaded"
            />
            <SummaryTile
              label={t('production_planning.plan.summary.orders', 'Orders in this window')}
              value={String(ordersInWindow)}
            />
            <SummaryTile
              label={t('production_planning.plan.summary.peak', 'Busiest work centre')}
              value={peak ? `${peak.percent}%` : '—'}
              hint={peak?.name}
              tone={peak && peak.percent > 100 ? 'bad' : undefined}
            />
          </div>

          <PlanBoard
            input={input}
            view={view}
            changedCells={changedCells}
            changedOrders={changedOrders}
            busyOrderId={busyOrderId}
            onMove={moveOrder}
            onSetDueDate={(orderId, dueDate) => void setDueDate(orderId, dueDate)}
          />

          <RequirementsTable lines={view.requirements} input={input} changedMaterials={changedMaterials} />
        </div>
      </PageBody>
      <UrgentOrderDialog open={urgentOpen} input={input} onClose={() => setUrgentOpen(false)} onCreated={addOrder} />
    </Page>
  )
}

function SummaryTile({
  label,
  value,
  hint,
  tone,
  testId,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'good' | 'bad'
  testId?: string
}) {
  const toneClass =
    tone === 'bad'
      ? 'border-red-600/40 bg-red-600/10 text-red-700 dark:text-red-300'
      : tone === 'good'
        ? 'border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
        : 'bg-card'
  return (
    <div className={`rounded-lg border px-4 py-3 transition-colors duration-500 ${toneClass}`} data-testid={testId}>
      <div className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {hint ? <span className="text-sm opacity-80">{hint}</span> : null}
      </div>
    </div>
  )
}
