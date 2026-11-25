'use client'

import * as React from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Flag } from 'lucide-react'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import type { PlanInput, PlanView } from '../lib/plan-model'
import type { IsoDate, LoadCell } from '../lib/schedule'
import { LOAD_BAR_CLASSES, LOAD_CELL_CLASSES, STAGE_CLASSES, formatDayHeader, formatHours, formatShortDate } from './planFormat'

type Props = {
  input: PlanInput
  view: PlanView
  /** `centreId|date` keys whose load changed in the last recompute — they pulse once. */
  changedCells: ReadonlySet<string>
  /** Orders that just moved or arrived — their row is highlighted for a moment. */
  changedOrders: ReadonlySet<string>
  busyOrderId: string | null
  onMove: (orderId: string, workingDays: number) => void
}

const DAY_COLUMN = 'minmax(64px, 1fr)'

/**
 * The plan in two stacked grids sharing one day axis:
 *
 * 1. Work-centre load — one row per work centre, one cell per working day,
 *    percent of capacity, green / amber / red.
 * 2. Orders — one row per order, its operations as coloured blocks on the
 *    days they occupy, the due date flagged, and buttons to move it.
 *
 * Hovering an order lights up the load cells it contributes to; hovering a load
 * cell lights up the orders behind it. That is the question asked of a red cell:
 * "who is in there?".
 */
export function PlanBoard({ input, view, changedCells, changedOrders, busyOrderId, onMove }: Props) {
  const t = useT()
  const locale = useLocale()
  const [hoverOrders, setHoverOrders] = React.useState<ReadonlySet<string>>(new Set())
  const [hoverCells, setHoverCells] = React.useState<ReadonlySet<string>>(new Set())

  const centres = React.useMemo(
    () => [...input.workCenters].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)),
    [input.workCenters],
  )
  const centreById = React.useMemo(() => new Map(centres.map((centre) => [centre.id, centre])), [centres])
  const productById = React.useMemo(() => new Map(input.products.map((product) => [product.id, product])), [input.products])
  const loadByCentre = React.useMemo(() => new Map(view.load.map((row) => [row.workCenterId, row])), [view.load])
  const cellLevel = React.useMemo(() => {
    const levels = new Map<string, LoadCell['level']>()
    for (const row of view.load) for (const cell of row.cells) levels.set(`${row.workCenterId}|${cell.date}`, cell.level)
    return levels
  }, [view.load])

  const first = view.days[0]
  const last = view.days[view.days.length - 1]
  const visibleOrders = React.useMemo(
    () =>
      input.orders
        .filter((order) => {
          const schedule = view.scheduleByOrder[order.id]
          if (!schedule || schedule.missingRouting) return order.dueDate >= first && order.dueDate <= last
          return !!schedule.start && !!schedule.end && schedule.end >= first && schedule.start <= last
        })
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.number.localeCompare(b.number)),
    [first, input.orders, last, view.scheduleByOrder],
  )
  const hiddenCount = input.orders.length - visibleOrders.length

  const gridTemplate = `minmax(320px, 360px) repeat(${view.days.length}, ${DAY_COLUMN})`

  const dayHeader = (
    <>
      <div />
      {view.days.map((date) => {
        const header = formatDayHeader(date, locale)
        const isToday = date === input.today
        return (
          <div key={date} className={`px-1 pb-1 text-center text-xs ${isToday ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
            <div className="uppercase tracking-wide">{header.weekday}</div>
            <div className="tabular-nums">{header.day}</div>
          </div>
        )
      })}
    </>
  )

  return (
    <div className="space-y-8">
      <section aria-labelledby="plan-load-heading" className="space-y-2">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="plan-load-heading" className="text-base font-semibold">
            {t('production_planning.plan.load.title', 'Work-centre load')}
          </h2>
          <Legend />
        </div>
        <div className="overflow-x-auto rounded-lg border bg-card p-3">
          <div className="grid min-w-[1000px] gap-1" style={{ gridTemplateColumns: gridTemplate }}>
            {dayHeader}
            {centres.map((centre) => {
              const row = loadByCentre.get(centre.id)
              return (
                <React.Fragment key={centre.id}>
                  <div className="flex flex-col justify-center pr-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span className={`inline-block size-2.5 rounded-sm ${STAGE_CLASSES[centre.stage] ?? STAGE_CLASSES.other}`} />
                      {centre.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t('production_planning.plan.load.capacity', '{hours} / day', { hours: formatHours(centre.dailyCapacityMinutes) })}
                    </span>
                  </div>
                  {(row?.cells ?? []).map((cell) => {
                    const key = `${centre.id}|${cell.date}`
                    const lit = cell.orderIds.some((id) => hoverOrders.has(id))
                    const pulse = changedCells.has(key)
                    return (
                      <div
                        key={key}
                        data-testid={`load-${centre.code ?? centre.id}-${cell.date}`}
                        data-level={cell.level}
                        className={[
                          'relative flex h-14 flex-col items-center justify-center rounded-md text-sm tabular-nums transition-colors duration-500',
                          LOAD_CELL_CLASSES[cell.level],
                          lit ? 'ring-2 ring-foreground ring-offset-1 ring-offset-background' : '',
                          pulse ? 'animate-pulse' : '',
                        ].join(' ')}
                        title={t('production_planning.plan.load.cellTitle', '{minutes} of {capacity} min · {orders} order(s)', {
                          minutes: cell.minutes,
                          capacity: cell.capacityMinutes,
                          orders: cell.orderIds.length,
                        })}
                        onMouseEnter={() => setHoverCells(new Set(cell.orderIds))}
                        onMouseLeave={() => setHoverCells(new Set())}
                      >
                        <span className={cell.level === 'over' ? 'text-base' : ''}>{cell.minutes > 0 ? `${cell.percent}%` : '·'}</span>
                        {cell.minutes > 0 ? (
                          <span className="absolute inset-x-2 bottom-1.5 h-1 overflow-hidden rounded-full bg-black/10">
                            <span
                              className={`block h-full rounded-full transition-all duration-500 ${LOAD_BAR_CLASSES[cell.level]}`}
                              style={{ width: `${Math.min(100, cell.percent)}%` }}
                            />
                          </span>
                        ) : null}
                      </div>
                    )
                  })}
                </React.Fragment>
              )
            })}
          </div>
        </div>
      </section>

      <section aria-labelledby="plan-orders-heading" className="space-y-2">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="plan-orders-heading" className="text-base font-semibold">
            {t('production_planning.plan.orders.title', 'Orders on the timeline')}
          </h2>
          {hiddenCount > 0 ? (
            <span className="text-xs text-muted-foreground">
              {t('production_planning.plan.orders.outsideWindow', '{count} more order(s) outside this window', { count: hiddenCount })}
            </span>
          ) : null}
        </div>
        <div className="overflow-x-auto rounded-lg border bg-card p-3">
          <div className="grid min-w-[1000px] gap-x-1 gap-y-1.5" style={{ gridTemplateColumns: gridTemplate }}>
            {dayHeader}
            {visibleOrders.length === 0 ? (
              <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
                {t('production_planning.plan.orders.empty', 'No orders in this window.')}
              </div>
            ) : null}
            {visibleOrders.map((order) => {
              const schedule = view.scheduleByOrder[order.id]
              const product = productById.get(order.productId)
              const lit = hoverCells.has(order.id)
              const highlighted = changedOrders.has(order.id)
              const atRisk = !!schedule?.startsInPast && order.status === 'planned'
              const operationByDay = new Map<IsoDate, { centreId: string; minutes: number }>()
              for (const operation of schedule?.operations ?? []) {
                for (const day of operation.days) operationByDay.set(day.date, { centreId: operation.workCenterId, minutes: day.minutes })
              }
              return (
                <React.Fragment key={order.id}>
                  <div
                    className={[
                      'flex items-center gap-2 rounded-md py-1 pl-1 pr-2 transition-colors duration-700',
                      lit ? 'bg-foreground/10' : '',
                      highlighted ? 'bg-primary/15' : '',
                    ].join(' ')}
                    onMouseEnter={() => setHoverOrders(new Set([order.id]))}
                    onMouseLeave={() => setHoverOrders(new Set())}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link
                          href={`/backend/production-planning/orders/${order.id}`}
                          className="text-sm font-semibold tabular-nums hover:underline"
                        >
                          {order.number}
                        </Link>
                        {order.priority === 'urgent' ? (
                          <StatusBadge variant="error">{t('production_planning.priority.urgent', 'Urgent')}</StatusBadge>
                        ) : null}
                        {order.status === 'in_progress' ? (
                          <StatusBadge variant="info">{t('production_planning.status.in_progress', 'In progress')}</StatusBadge>
                        ) : null}
                      </div>
                      <div className="truncate text-xs text-muted-foreground" title={product?.name}>
                        {t('production_planning.plan.orders.line', '{quantity} pcs · {product}', {
                          quantity: order.quantity,
                          product: product?.name ?? '—',
                        })}
                      </div>
                      {atRisk ? (
                        <div className="text-xs font-medium text-red-600">
                          {t('production_planning.plan.orders.startsInPast', 'Would have to start {date} — due date at risk', {
                            date: formatShortDate(schedule?.start, locale),
                          })}
                        </div>
                      ) : null}
                      {schedule?.missingRouting ? (
                        <div className="text-xs font-medium text-amber-700">
                          {t('production_planning.plan.orders.missingRouting', 'Product has no routing — not on the plan')}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                        aria-label={t('production_planning.plan.orders.earlier', 'One working day earlier')}
                        title={t('production_planning.plan.orders.earlier', 'One working day earlier')}
                        disabled={busyOrderId === order.id}
                        onClick={() => onMove(order.id, -1)}
                        data-testid={`move-earlier-${order.number}`}
                      >
                        <ChevronLeft className="size-4" />
                      </button>
                      <span
                        className="min-w-[4.5rem] rounded border bg-background px-1.5 py-0.5 text-center text-xs font-medium tabular-nums"
                        title={t('production_planning.orders.fields.dueDate', 'Due date')}
                        data-testid={`due-${order.number}`}
                      >
                        {formatDayHeader(order.dueDate, locale).weekday} {formatShortDate(order.dueDate, locale)}
                      </span>
                      <button
                        type="button"
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                        aria-label={t('production_planning.plan.orders.later', 'One working day later')}
                        title={t('production_planning.plan.orders.later', 'One working day later')}
                        disabled={busyOrderId === order.id}
                        onClick={() => onMove(order.id, 1)}
                        data-testid={`move-later-${order.number}`}
                      >
                        <ChevronRight className="size-4" />
                      </button>
                    </div>
                  </div>
                  {view.days.map((date) => {
                    const operation = operationByDay.get(date)
                    const centre = operation ? centreById.get(operation.centreId) : undefined
                    const overloaded = operation ? cellLevel.get(`${operation.centreId}|${date}`) === 'over' : false
                    const isDue = date === order.dueDate
                    return (
                      <div
                        key={date}
                        className={`relative flex h-11 items-center ${isDue ? 'border-r-2 border-foreground/70' : ''}`}
                        onMouseEnter={() => setHoverOrders(new Set([order.id]))}
                        onMouseLeave={() => setHoverOrders(new Set())}
                      >
                        {operation && centre ? (
                          <div
                            className={[
                              'flex h-8 w-full items-center justify-center rounded text-[11px] font-semibold tracking-wide transition-all duration-500',
                              STAGE_CLASSES[centre.stage] ?? STAGE_CLASSES.other,
                              overloaded ? 'ring-[3px] ring-red-600 ring-offset-1 ring-offset-background' : '',
                            ].join(' ')}
                            title={`${centre.name} · ${formatHours(operation.minutes)}`}
                          >
                            {centre.code ?? centre.name.slice(0, 3)}
                          </div>
                        ) : null}
                        {isDue ? (
                          <Flag
                            className="absolute -right-1 -top-1 size-3.5 fill-foreground text-foreground"
                            aria-label={t('production_planning.orders.fields.dueDate', 'Due date')}
                          />
                        ) : null}
                      </div>
                    )
                  })}
                </React.Fragment>
              )
            })}
          </div>
        </div>
        <StageLegend centres={centres} />
      </section>
    </div>
  )
}

function Legend() {
  const t = useT()
  const items: Array<{ level: string; label: string }> = [
    { level: 'ok', label: t('production_planning.plan.legend.ok', 'up to 85%') },
    { level: 'high', label: t('production_planning.plan.legend.high', '85–100%') },
    { level: 'over', label: t('production_planning.plan.legend.over', 'overloaded') },
  ]
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      {items.map((item) => (
        <span key={item.level} className="flex items-center gap-1.5">
          <span className={`inline-block h-3 w-5 rounded-sm ${LOAD_CELL_CLASSES[item.level]}`} />
          {item.label}
        </span>
      ))}
    </div>
  )
}

function StageLegend({ centres }: { centres: PlanInput['workCenters'] }) {
  return (
    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground">
      {centres.map((centre) => (
        <span key={centre.id} className="flex items-center gap-1.5">
          <span
            className={`inline-flex h-4 min-w-8 items-center justify-center rounded px-1 text-[10px] font-semibold ${STAGE_CLASSES[centre.stage] ?? STAGE_CLASSES.other}`}
          >
            {centre.code ?? '—'}
          </span>
          {centre.name}
        </span>
      ))}
    </div>
  )
}
