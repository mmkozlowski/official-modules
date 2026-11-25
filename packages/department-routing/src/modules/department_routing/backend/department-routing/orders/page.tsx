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
import { Progress } from '@open-mercato/ui/primitives/progress'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCallOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { buildCrudExportUrl } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import { ORDER_STATUSES } from '../../../data/validators'
import type { OrderRow } from '../../../components/types'
import { PAGE_SIZE_OPTIONS, useListQuery } from '../../../components/useListQuery'
import { useLiveRefresh } from '../../../components/useLiveRefresh'
import { ORDER_STATUS_VARIANT, daysUntil, formatDate } from '../../../components/presentation'
import { OrderStatusLabel } from '../../../components/OrderStatusLabel'

const API_PATH = 'department_routing/orders'
const TABLE_ID = 'department_routing.orders'
const ENTITY_ID = 'department_routing:production_order'

export default function OrdersListPage() {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const list = useListQuery<OrderRow>({
    apiPath: API_PATH,
    initialSort: [{ id: 'number', desc: true }],
    loadErrorMessage: t('department_routing.orders.list.loadFailed', 'Could not load orders.'),
  })
  // Departments report all day — the list follows without a manual refresh.
  useLiveRefresh(list.refreshSilently, 5000)

  const openOrder = React.useCallback(
    (id: string) => router.push(`/backend/department-routing/orders/${id}`),
    [router],
  )

  const deleteOrders = React.useCallback(
    async (rows: OrderRow[]) => {
      const confirmed = await confirm({
        title: t('department_routing.orders.list.deleteConfirm', 'Delete {count} order(s)?', { count: rows.length }),
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
      if (failed) flash(t('department_routing.orders.list.deleteFailed', 'Some orders could not be deleted.'), 'error')
      else flash(t('department_routing.common.deleted', 'Deleted.'), 'success')
      list.reload()
      return failed === 0
    },
    [confirm, list, t],
  )

  const acceptOrders = React.useCallback(
    async (rows: OrderRow[]) => {
      const waiting = rows.filter((row) => row.status === 'new')
      let failed = 0
      for (const row of waiting) {
        try {
          await apiCallOrThrow(`/api/department_routing/orders/${encodeURIComponent(row.id)}/accept`, { method: 'POST' })
        } catch {
          failed += 1
        }
      }
      if (failed) flash(t('department_routing.orders.accept.someFailed', 'Some orders could not be accepted — open them to see why.'), 'error')
      else flash(t('department_routing.orders.accept.bulkDone', 'Accepted {count} order(s).', { count: waiting.length }), 'success')
      list.reload()
      return failed === 0
    },
    [list, t],
  )

  const filters = React.useMemo<FilterDef[]>(
    () => [
      {
        id: 'status',
        label: t('department_routing.orders.fields.status', 'Status'),
        type: 'select',
        options: ORDER_STATUSES.map((value) => ({ value, label: t(`department_routing.orderStatus.${value}`, value) })),
      },
    ],
    [t],
  )

  const exporter = React.useMemo(() => {
    const params = Object.fromEntries(list.params.entries())
    return {
      view: {
        getUrl: (format: DataTableExportFormat) => buildCrudExportUrl(API_PATH, { ...params, exportScope: 'view' }, format),
      },
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
        header: t('department_routing.orders.fields.number', 'Order number'),
        meta: { alwaysVisible: true, maxWidth: '160px' },
        cell: ({ row }) => (
          <Link href={`/backend/department-routing/orders/${row.original.id}`} className="font-medium tabular-nums hover:underline">
            {row.original.number}
          </Link>
        ),
      },
      {
        accessorKey: 'customer_name',
        header: t('department_routing.orders.fields.customerName', 'Customer'),
        meta: { maxWidth: '240px' },
      },
      {
        accessorKey: 'status',
        header: t('department_routing.orders.fields.status', 'Status'),
        meta: { maxWidth: '170px' },
        cell: ({ row }) => (
          <StatusBadge variant={ORDER_STATUS_VARIANT[row.original.status]} dot>
            <OrderStatusLabel status={row.original.status} />
          </StatusBadge>
        ),
      },
      {
        accessorKey: 'departments_done',
        header: t('department_routing.orders.columns.progress', 'Departments'),
        meta: { maxWidth: '220px' },
        cell: ({ row }) =>
          row.original.departments_total > 0 ? (
            <div className="flex min-w-[150px] items-center gap-2">
              <Progress
                value={row.original.departments_done}
                max={row.original.departments_total}
                className="h-2 flex-1"
              />
              <span className="tabular-nums text-sm">
                {row.original.departments_done}/{row.original.departments_total}
              </span>
            </div>
          ) : (
            <span className="whitespace-nowrap text-muted-foreground">
              {t('department_routing.orders.columns.notSplit', 'not split yet')}
            </span>
          ),
      },
      {
        accessorKey: 'due_date',
        header: t('department_routing.orders.fields.dueDate', 'Due date'),
        meta: { maxWidth: '140px' },
        cell: ({ row }) => {
          const days = daysUntil(row.original.due_date)
          const late = days !== null && days < 0 && row.original.status !== 'ready_to_ship'
          return (
            <span className={late ? 'font-medium text-destructive tabular-nums' : 'tabular-nums'}>
              {formatDate(row.original.due_date, locale)}
            </span>
          )
        },
      },
      {
        accessorKey: 'lines_summary',
        header: t('department_routing.orders.columns.lines', 'Products'),
        enableSorting: false,
        meta: { hidden: true, maxWidth: '320px', truncate: true },
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.lines_summary || '—'}</span>,
      },
      {
        accessorKey: 'units_total',
        header: t('department_routing.orders.columns.units', 'Units'),
        enableSorting: false,
        meta: { hidden: true, maxWidth: '100px' },
        cell: ({ row }) => <span className="tabular-nums">{row.original.units_total}</span>,
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
          title={t('department_routing.orders.list.title', 'Production orders')}
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
          searchPlaceholder={t('department_routing.orders.list.search', 'Search by number or customer')}
          filters={filters}
          filterValues={list.filterValues}
          onFiltersApply={(values: FilterValues) => list.setFilterValues(values)}
          onFiltersClear={() => list.setFilterValues({})}
          exporter={exporter}
          refreshButton={{
            label: t('department_routing.common.refresh', 'Refresh'),
            onRefresh: list.reload,
          }}
          actions={
            <Button asChild>
              <Link href="/backend/department-routing/orders/create">
                {t('department_routing.orders.list.new', 'New order')}
              </Link>
            </Button>
          }
          onRowClick={(row) => openOrder(row.id)}
          rowActions={(row) => (
            <RowActions
              items={[
                { id: 'open', label: t('department_routing.orders.list.open', 'Open order'), onSelect: () => openOrder(row.id) },
                ...(row.status === 'new'
                  ? [
                      {
                        id: 'accept',
                        label: t('department_routing.orders.accept.button', 'Accept for production'),
                        onSelect: () => void acceptOrders([row]),
                      },
                    ]
                  : []),
                {
                  id: 'delete',
                  label: t('department_routing.common.delete', 'Delete'),
                  destructive: true,
                  onSelect: () => void deleteOrders([row]),
                },
              ]}
            />
          )}
          bulkActions={[
            {
              id: 'accept',
              label: t('department_routing.orders.accept.bulk', 'Accept for production'),
              onExecute: (rows: OrderRow[]) => acceptOrders(rows),
            },
            {
              id: 'delete',
              label: t('department_routing.common.deleteSelected', 'Delete selected'),
              destructive: true,
              onExecute: (rows: OrderRow[]) => deleteOrders(rows),
            },
          ]}
          emptyState={
            <EmptyState
              title={t('department_routing.orders.list.empty.title', 'No orders yet')}
              description={t(
                'department_routing.orders.list.empty.description',
                'An order is made to order: accept it and it splits into tasks for every department that makes its products.',
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
