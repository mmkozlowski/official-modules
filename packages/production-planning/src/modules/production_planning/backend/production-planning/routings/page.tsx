'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import type { FilterDef, FilterValues } from '@open-mercato/ui/backend/FilterBar'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { EmptyState } from '@open-mercato/ui/primitives/empty-state'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { PAGE_SIZE_OPTIONS } from '@open-mercato/production-bom/modules/production_bom/components/useListQuery'
import type { RoutingSummaryRow } from '../../../components/types'

const TABLE_ID = 'production_planning.routings'

type RoutingFit = 'missing' | 'matches' | 'differs'

function fitOf(row: RoutingSummaryRow): RoutingFit {
  if (row.step_count === 0) return 'missing'
  return Math.abs(row.routing_minutes - row.labor_minutes) < 0.01 ? 'matches' : 'differs'
}

/**
 * Products and how they go through the workshop. The list is small (one row
 * per BOM product) and computed, so search, filters, sorting, paging and
 * export run in the browser over the full set.
 */
export default function RoutingsListPage() {
  const t = useT()
  const router = useRouter()
  const scopeVersion = useOrganizationScopeVersion()
  const [rows, setRows] = React.useState<RoutingSummaryRow[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadToken, setReloadToken] = React.useState(0)
  const [search, setSearch] = React.useState('')
  const [filterValues, setFilterValues] = React.useState<FilterValues>({})
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'name', desc: false }])
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(25)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      setError(null)
      const call = await apiCall<{ items: RoutingSummaryRow[] }>('/api/production_planning/routings').catch(() => null)
      if (cancelled) return
      if (!call?.ok) setError(t('production_planning.routings.list.loadFailed', 'Could not load routings.'))
      setRows(call?.ok ? call.result?.items ?? [] : [])
      setIsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [reloadToken, scopeVersion, t])

  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase()
    const fit = typeof filterValues.fit === 'string' ? filterValues.fit : ''
    const result = rows.filter(
      (row) =>
        (!needle || row.name.toLowerCase().includes(needle) || (row.code ?? '').toLowerCase().includes(needle)) &&
        (!fit || fitOf(row) === fit),
    )
    const sort = sorting[0]
    if (sort) {
      const key = sort.id as keyof RoutingSummaryRow
      result.sort((a, b) => {
        const left = a[key] ?? ''
        const right = b[key] ?? ''
        const order = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right))
        return sort.desc ? -order : order
      })
    }
    return result
  }, [filterValues.fit, rows, search, sorting])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize)

  const openRouting = React.useCallback((id: string) => router.push(`/backend/production-planning/routings/${id}`), [router])

  const filters = React.useMemo<FilterDef[]>(
    () => [
      {
        id: 'fit',
        label: t('production_planning.routings.columns.fit', 'Against labour time'),
        type: 'select',
        options: [
          { value: 'missing', label: t('production_planning.routings.fit.missing', 'No routing') },
          { value: 'matches', label: t('production_planning.routings.fit.matches', 'Matches') },
          { value: 'differs', label: t('production_planning.routings.fit.differs', 'Differs') },
        ],
      },
    ],
    [t],
  )

  const columns = React.useMemo<ColumnDef<RoutingSummaryRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('production_planning.orders.fields.product', 'Product'),
        meta: { alwaysVisible: true, maxWidth: '320px' },
        cell: ({ row }) => (
          <Link href={`/backend/production-planning/routings/${row.original.id}`} className="font-medium hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: 'code',
        header: t('production_planning.workCenters.fields.code', 'Code'),
        meta: { maxWidth: '110px' },
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.code ?? '—'}</span>,
      },
      {
        accessorKey: 'route',
        header: t('production_planning.routings.columns.route', 'Route'),
        enableSorting: false,
        meta: { maxWidth: '420px' },
        cell: ({ row }) => row.original.route || <span className="text-muted-foreground">—</span>,
      },
      {
        accessorKey: 'step_count',
        header: t('production_planning.routings.columns.steps', 'Steps'),
        meta: { maxWidth: '90px' },
        cell: ({ row }) => <span className="tabular-nums">{row.original.step_count}</span>,
      },
      {
        accessorKey: 'routing_minutes',
        header: t('production_planning.routings.columns.routingMinutes', 'Routing min / unit'),
        meta: { maxWidth: '150px' },
        cell: ({ row }) => <span className="tabular-nums">{row.original.routing_minutes}</span>,
      },
      {
        accessorKey: 'labor_minutes',
        header: t('production_planning.routings.columns.laborMinutes', 'BOM labour min / unit'),
        meta: { maxWidth: '170px' },
        cell: ({ row }) => <span className="tabular-nums">{row.original.labor_minutes}</span>,
      },
      {
        accessorKey: 'fit',
        header: t('production_planning.routings.columns.fit', 'Against labour time'),
        enableSorting: false,
        meta: { maxWidth: '150px' },
        cell: ({ row }) => {
          const fit = fitOf(row.original)
          return (
            <StatusBadge variant={fit === 'matches' ? 'success' : fit === 'missing' ? 'error' : 'warning'}>
              {t(`production_planning.routings.fit.${fit}`, fit)}
            </StatusBadge>
          )
        },
      },
    ],
    [t],
  )

  const exporter = React.useMemo(
    () => ({
      view: {
        prepare: () => ({
          prepared: {
            columns: [
              { field: 'name', header: t('production_planning.orders.fields.product', 'Product') },
              { field: 'code', header: t('production_planning.workCenters.fields.code', 'Code') },
              { field: 'route', header: t('production_planning.routings.columns.route', 'Route') },
              { field: 'step_count', header: t('production_planning.routings.columns.steps', 'Steps') },
              { field: 'routing_minutes', header: t('production_planning.routings.columns.routingMinutes', 'Routing min / unit') },
              { field: 'labor_minutes', header: t('production_planning.routings.columns.laborMinutes', 'BOM labour min / unit') },
            ],
            rows: filtered.map((row) => ({ ...row })),
          },
          filename: 'routings',
        }),
      },
    }),
    [filtered, t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable<RoutingSummaryRow>
          stickyFirstColumn
          stickyActionsColumn
          title={t('production_planning.routings.list.title', 'Routings')}
          columns={columns}
          data={pageRows}
          isLoading={isLoading}
          error={error}
          perspective={{ tableId: TABLE_ID }}
          columnChooser={{ auto: true }}
          sortable
          sorting={sorting}
          onSortingChange={(value: SortingState) => {
            setSorting(value)
            setPage(1)
          }}
          searchValue={search}
          onSearchChange={(value: string) => {
            setSearch(value)
            setPage(1)
          }}
          searchPlaceholder={t('production_planning.routings.list.search', 'Search by product or code')}
          filters={filters}
          filterValues={filterValues}
          onFiltersApply={(values: FilterValues) => {
            setFilterValues(values)
            setPage(1)
          }}
          onFiltersClear={() => setFilterValues({})}
          exporter={exporter}
          refreshButton={{ label: t('production_planning.common.refresh', 'Refresh'), onRefresh: () => setReloadToken((token) => token + 1) }}
          onRowClick={(row) => openRouting(row.id)}
          rowActions={(row) => (
            <RowActions
              items={[
                { id: 'edit', label: t('production_planning.routings.list.edit', 'Edit routing'), onSelect: () => openRouting(row.id) },
                { id: 'bom', label: t('production_planning.routings.list.openBom', 'Open BOM'), onSelect: () => router.push(`/backend/production-bom/products/${row.id}`) },
              ]}
            />
          )}
          emptyState={
            <EmptyState
              title={t('production_planning.routings.list.empty.title', 'No products yet')}
              description={t('production_planning.routings.list.empty.description', 'Routings are set per BOM product. Add products in Products (BOM) first.')}
            />
          }
          pagination={{
            page,
            pageSize,
            total: filtered.length,
            totalPages,
            onPageChange: setPage,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            onPageSizeChange: (size: number) => {
              setPageSize(size)
              setPage(1)
            },
          }}
        />
      </PageBody>
    </Page>
  )
}
