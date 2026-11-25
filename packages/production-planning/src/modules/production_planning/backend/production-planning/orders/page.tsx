'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable, type DataTableExportFormat } from '@open-mercato/ui/backend/DataTable'
import type { FilterDef, FilterValues } from '@open-mercato/ui/backend/FilterBar'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { EmptyState } from '@open-mercato/ui/primitives/empty-state'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCallOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { buildCrudExportUrl } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import { PAGE_SIZE_OPTIONS, useListQuery } from '@open-mercato/production-bom/modules/production_bom/components/useListQuery'
import { ORDER_PRIORITIES, ORDER_STATUSES } from '../../../data/validators'
import type { OrderStatus } from '../../../data/entities'
import type { OrderRow } from '../../../components/types'
import { formatDate, formatHours } from '../../../components/planFormat'

const API_PATH = 'production_planning/orders'
const TABLE_ID = 'production_planning.orders'
const ENTITY_ID = 'production_planning:production_order'

const STATUS_VARIANT: Record<OrderStatus, 'info' | 'warning' | 'success' | 'neutral'> = {
  planned: 'neutral',
  in_progress: 'info',
  done: 'success',
  cancelled: 'neutral',
}

export default function OrdersListPage() {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const list = useListQuery<OrderRow>({
    apiPath: API_PATH,
    initialSort: [{ id: 'due_date', desc: false }],
    loadErrorMessage: t('production_planning.orders.list.loadFailed', 'Could not load production orders.'),
  })

  const openOrder = React.useCallback((id: string) => router.push(`/backend/production-planning/orders/${id}`), [router])

  const deleteOrders = React.useCallback(
    async (rows: OrderRow[]) => {
      const confirmed = await confirm({
        title: t('production_planning.orders.list.deleteConfirm', 'Delete {count} order(s)?', { count: rows.length }),
        variant: 'destructive',
      })
      if (!confirmed) return false
      let failed = 0
      for (const row of rows) {
        try {
          await apiCallOrThrow(`/api/${API_PATH}?id=${encodeURIComponent(row.id)}`, { method: 'DELETE' })
        } catch {
          failed += 1
        }
      }
      if (failed) flash(t('production_planning.orders.list.deleteFailed', 'Some orders could not be deleted.'), 'error')
      else flash(t('production_planning.common.deleted', 'Deleted.'), 'success')
      list.reload()
      return failed === 0
    },
    [confirm, list, t],
  )

  const setStatus = React.useCallback(
    async (rows: OrderRow[], status: OrderStatus) => {
      for (const row of rows) {
        await apiCallOrThrow(`/api/${API_PATH}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: row.id, status }),
        })
      }
      flash(t('production_planning.common.saved', 'Saved.'), 'success')
      list.reload()
      return true
    },
    [list, t],
  )

  const filters = React.useMemo<FilterDef[]>(
    () => [
      {
        id: 'status',
        label: t('production_planning.orders.fields.status', 'Status'),
        type: 'select',
        options: ORDER_STATUSES.map((value) => ({ value, label: t(`production_planning.status.${value}`, value) })),
      },
      {
        id: 'priority',
        label: t('production_planning.orders.fields.priority', 'Priority'),
        type: 'select',
        options: ORDER_PRIORITIES.map((value) => ({ value, label: t(`production_planning.priority.${value}`, value) })),
      },
    ],
    [t],
  )

  const exporter = React.useMemo(() => {
    const params = Object.fromEntries(list.params.entries())
    return {
      view: { getUrl: (format: DataTableExportFormat) => buildCrudExportUrl(API_PATH, { ...params, exportScope: 'view' }, format) },
      full: {
        getUrl: (format: DataTableExportFormat) =>
          buildCrudExportUrl(API_PATH, { ...params, exportScope: 'full', all: 'true' }, format),
      },
    }
  }, [list.params])

  const columns = React.useMemo<ColumnDef<OrderRow>[]>(
    () => [
      {
        accessorKey: 'number',
        header: t('production_planning.orders.fields.number', 'Number'),
        meta: { alwaysVisible: true, maxWidth: '150px' },
        cell: ({ row }) => (
          <Link href={`/backend/production-planning/orders/${row.original.id}`} className="font-medium tabular-nums hover:underline">
            {row.original.number}
          </Link>
        ),
      },
      {
        accessorKey: 'product_name',
        header: t('production_planning.orders.fields.product', 'Product'),
        enableSorting: false,
        meta: { maxWidth: '300px' },
        cell: ({ row }) => row.original.product_name ?? '—',
      },
      {
        accessorKey: 'quantity',
        header: t('production_planning.orders.fields.quantity', 'Quantity'),
        meta: { maxWidth: '100px' },
        cell: ({ row }) => <span className="tabular-nums">{row.original.quantity}</span>,
      },
      {
        accessorKey: 'due_date',
        header: t('production_planning.orders.fields.dueDate', 'Due date'),
        meta: { maxWidth: '130px' },
        cell: ({ row }) => <span className="tabular-nums">{formatDate(row.original.due_date, locale)}</span>,
      },
      {
        accessorKey: 'planned_start',
        header: t('production_planning.orders.columns.plannedStart', 'Planned start'),
        enableSorting: false,
        meta: { maxWidth: '140px' },
        cell: ({ row }) =>
          row.original.missing_routing ? (
            <StatusBadge variant="warning">{t('production_planning.orders.columns.noRouting', 'No routing')}</StatusBadge>
          ) : (
            <span className={`tabular-nums ${row.original.starts_in_past && row.original.status === 'planned' ? 'font-medium text-red-600' : ''}`}>
              {formatDate(row.original.planned_start, locale)}
            </span>
          ),
      },
      {
        accessorKey: 'on_overloaded_day',
        header: t('production_planning.orders.columns.plan', 'On the plan'),
        enableSorting: false,
        meta: { maxWidth: '150px' },
        cell: ({ row }) =>
          row.original.on_overloaded_day ? (
            <StatusBadge variant="error">{t('production_planning.orders.columns.overloaded', 'Overloaded day')}</StatusBadge>
          ) : row.original.starts_in_past && row.original.status === 'planned' ? (
            <StatusBadge variant="warning">{t('production_planning.orders.columns.atRisk', 'Due date at risk')}</StatusBadge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: 'status',
        header: t('production_planning.orders.fields.status', 'Status'),
        meta: { maxWidth: '130px' },
        cell: ({ row }) => (
          <StatusBadge variant={STATUS_VARIANT[row.original.status] ?? 'neutral'}>
            {t(`production_planning.status.${row.original.status}`, row.original.status)}
          </StatusBadge>
        ),
      },
      {
        accessorKey: 'priority',
        header: t('production_planning.orders.fields.priority', 'Priority'),
        meta: { maxWidth: '110px' },
        cell: ({ row }) =>
          row.original.priority === 'urgent' ? (
            <StatusBadge variant="error">{t('production_planning.priority.urgent', 'Urgent')}</StatusBadge>
          ) : (
            <span className="text-muted-foreground">{t('production_planning.priority.normal', 'Normal')}</span>
          ),
      },
      {
        accessorKey: 'labor_minutes_total',
        header: t('production_planning.orders.columns.labour', 'Labour'),
        enableSorting: false,
        meta: { maxWidth: '120px' },
        cell: ({ row }) =>
          row.original.labor_minutes_total != null ? (
            <span className="tabular-nums">{formatHours(row.original.labor_minutes_total)}</span>
          ) : (
            '—'
          ),
      },
      {
        accessorKey: 'reference',
        header: t('production_planning.orders.fields.reference', 'Reference'),
        meta: { maxWidth: '280px' },
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.reference ?? '—'}</span>,
      },
    ],
    [locale, t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable<OrderRow>
          stickyFirstColumn
          stickyActionsColumn
          title={t('production_planning.orders.list.title', 'Production orders')}
          columns={columns}
          data={list.rows}
          isLoading={list.isLoading}
          error={list.error}
          entityId={ENTITY_ID}
          perspective={{ tableId: TABLE_ID }}
          columnChooser={{ auto: true }}
          sortable
          sorting={list.sorting}
          onSortingChange={list.setSorting}
          searchValue={list.search}
          onSearchChange={list.setSearch}
          searchPlaceholder={t('production_planning.orders.list.search', 'Search by number or reference')}
          filters={filters}
          filterValues={list.filterValues}
          onFiltersApply={(values: FilterValues) => list.setFilterValues(values)}
          onFiltersClear={() => list.setFilterValues({})}
          exporter={exporter}
          refreshButton={{ label: t('production_planning.common.refresh', 'Refresh'), onRefresh: list.reload }}
          actions={
            <>
              <Button asChild variant="outline">
                <Link href="/backend/production-planning/plan">{t('production_planning.orders.list.openPlan', 'Open the plan')}</Link>
              </Button>
              <Button asChild>
                <Link href="/backend/production-planning/orders/create">{t('production_planning.orders.list.new', 'New order')}</Link>
              </Button>
            </>
          }
          onRowClick={(row) => openOrder(row.id)}
          rowActions={(row) => (
            <RowActions
              items={[
                { id: 'open', label: t('production_planning.common.open', 'Open'), onSelect: () => openOrder(row.id) },
                {
                  id: 'start',
                  label: t('production_planning.orders.actions.start', 'Mark in progress'),
                  onSelect: () => void setStatus([row], 'in_progress'),
                },
                { id: 'done', label: t('production_planning.orders.actions.done', 'Mark done'), onSelect: () => void setStatus([row], 'done') },
                {
                  id: 'delete',
                  label: t('production_planning.common.delete', 'Delete'),
                  destructive: true,
                  onSelect: () => void deleteOrders([row]),
                },
              ]}
            />
          )}
          bulkActions={[
            { id: 'start', label: t('production_planning.orders.actions.start', 'Mark in progress'), onExecute: (rows: OrderRow[]) => setStatus(rows, 'in_progress') },
            { id: 'done', label: t('production_planning.orders.actions.done', 'Mark done'), onExecute: (rows: OrderRow[]) => setStatus(rows, 'done') },
            { id: 'cancel', label: t('production_planning.orders.actions.cancel', 'Cancel orders'), onExecute: (rows: OrderRow[]) => setStatus(rows, 'cancelled') },
            {
              id: 'delete',
              label: t('production_planning.common.deleteSelected', 'Delete selected'),
              destructive: true,
              onExecute: (rows: OrderRow[]) => deleteOrders(rows),
            },
          ]}
          emptyState={
            <EmptyState
              title={t('production_planning.orders.list.empty.title', 'No production orders yet')}
              description={t(
                'production_planning.orders.list.empty.description',
                'An order says what to make, how many and by when. The plan places it on the work centres from the product routing.',
              )}
            />
          }
          pagination={{
            page: list.page,
            pageSize: list.pageSize,
            total: list.total,
            totalPages: list.totalPages,
            onPageChange: list.setPage,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            onPageSizeChange: list.setPageSize,
          }}
        />
      </PageBody>
      {ConfirmDialogElement}
    </Page>
  )
}
