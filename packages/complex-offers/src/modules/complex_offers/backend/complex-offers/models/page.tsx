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
import type { ModelRow } from '../../../components/types'
import { PAGE_SIZE_OPTIONS, useListQuery } from '../../../components/useListQuery'
import { formatDecimal, formatMoney } from '../../../lib/format'

const API_PATH = 'complex_offers/models'
const TABLE_ID = 'complex_offers.models'
const ENTITY_ID = 'complex_offers:priced_model'

export default function ModelsListPage() {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const list = useListQuery<ModelRow>({
    apiPath: API_PATH,
    initialSort: [{ id: 'name', desc: false }],
    loadErrorMessage: t('complex_offers.models.list.loadFailed', 'Could not load models.'),
  })

  const openModel = React.useCallback((id: string) => router.push(`/backend/complex-offers/models/${id}`), [router])

  const deleteModels = React.useCallback(
    async (rows: ModelRow[]) => {
      const confirmed = await confirm({
        title: t('complex_offers.models.list.deleteConfirm', 'Delete {count} model(s)? Offers already priced keep their prices.', {
          count: rows.length,
        }),
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
      if (failed) flash(t('complex_offers.models.list.deleteFailed', 'Some models could not be deleted.'), 'error')
      else flash(t('complex_offers.common.deleted', 'Deleted.'), 'success')
      list.reload()
      return failed === 0
    },
    [confirm, list, t],
  )

  const setActive = React.useCallback(
    async (rows: ModelRow[], isActive: boolean) => {
      for (const row of rows) {
        await apiCallOrThrow(`/api/${API_PATH}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: row.id, isActive }),
        })
      }
      flash(t('complex_offers.common.saved', 'Saved.'), 'success')
      list.reload()
      return true
    },
    [list, t],
  )

  const filters = React.useMemo<FilterDef[]>(
    () => [
      {
        id: 'isActive',
        label: t('complex_offers.fields.status', 'Status'),
        type: 'select',
        options: [
          { value: 'true', label: t('complex_offers.common.active', 'Active') },
          { value: 'false', label: t('complex_offers.common.inactive', 'Inactive') },
        ],
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

  const columns = React.useMemo<ColumnDef<ModelRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('complex_offers.models.fields.name', 'Model'),
        meta: { alwaysVisible: true, maxWidth: '320px' },
        cell: ({ row }) => (
          <Link href={`/backend/complex-offers/models/${row.original.id}`} className="font-medium hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: 'code',
        header: t('complex_offers.models.fields.code', 'Code'),
        meta: { maxWidth: '130px' },
        cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.code ?? '—'}</span>,
      },
      {
        accessorKey: 'base_price',
        header: t('complex_offers.models.columns.basePrice', 'Base price'),
        meta: { maxWidth: '140px' },
        cell: ({ row }) => <span className="tabular-nums">{formatMoney(row.original.base_price, row.original.currency_code, locale)}</span>,
      },
      {
        accessorKey: 'bom_material_cost',
        header: t('complex_offers.models.columns.bomCost', 'Materials (BOM)'),
        meta: { maxWidth: '160px' },
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatMoney(row.original.bom_material_cost, row.original.currency_code, locale)}
            {row.original.bom_product_code ? (
              <span className="ml-1 text-xs text-muted-foreground">({row.original.bom_product_code})</span>
            ) : null}
          </span>
        ),
      },
      {
        accessorKey: 'margin_percent',
        header: t('complex_offers.models.fields.marginPercent', 'Margin %'),
        meta: { maxWidth: '110px' },
        cell: ({ row }) => <span className="tabular-nums">{formatDecimal(row.original.margin_percent, locale, 2)}%</span>,
      },
      {
        accessorKey: 'option_count',
        header: t('complex_offers.models.columns.parameters', 'Parameters'),
        enableSorting: false,
        meta: { maxWidth: '260px' },
        cell: ({ row }) => {
          const counts = row.original.option_counts
          if (!counts) return '—'
          return (
            <span className="text-sm text-muted-foreground">
              {t('complex_offers.models.columns.parametersValue', '{size} sizes · {fabric} fabrics · {color} colours · {addon} add-ons', counts)}
            </span>
          )
        },
      },
      {
        accessorKey: 'is_active',
        header: t('complex_offers.fields.status', 'Status'),
        meta: { maxWidth: '110px' },
        cell: ({ row }) =>
          row.original.is_active ? (
            <StatusBadge variant="success">{t('complex_offers.common.active', 'Active')}</StatusBadge>
          ) : (
            <StatusBadge variant="neutral">{t('complex_offers.common.inactive', 'Inactive')}</StatusBadge>
          ),
      },
    ],
    [locale, t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable<ModelRow>
          stickyFirstColumn
          stickyActionsColumn
          title={t('complex_offers.models.list.title', 'Models and price lists')}
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
          searchPlaceholder={t('complex_offers.models.list.search', 'Search by name or code')}
          filters={filters}
          filterValues={list.filterValues}
          onFiltersApply={(values: FilterValues) => list.setFilterValues(values)}
          onFiltersClear={() => list.setFilterValues({})}
          exporter={exporter}
          refreshButton={{ label: t('complex_offers.common.refresh', 'Refresh'), onRefresh: list.reload }}
          actions={
            <Button asChild>
              <Link href="/backend/complex-offers/models/create">{t('complex_offers.models.list.new', 'New model')}</Link>
            </Button>
          }
          onRowClick={(row) => openModel(row.id)}
          rowActions={(row) => (
            <RowActions
              items={[
                { id: 'open', label: t('complex_offers.models.list.open', 'Open price list'), onSelect: () => openModel(row.id) },
                {
                  id: 'delete',
                  label: t('complex_offers.common.delete', 'Delete'),
                  destructive: true,
                  onSelect: () => void deleteModels([row]),
                },
              ]}
            />
          )}
          bulkActions={[
            { id: 'deactivate', label: t('complex_offers.common.deactivate', 'Deactivate'), onExecute: (rows: ModelRow[]) => setActive(rows, false) },
            { id: 'activate', label: t('complex_offers.common.activate', 'Activate'), onExecute: (rows: ModelRow[]) => setActive(rows, true) },
            {
              id: 'delete',
              label: t('complex_offers.common.deleteSelected', 'Delete selected'),
              destructive: true,
              onExecute: (rows: ModelRow[]) => deleteModels(rows),
            },
          ]}
          emptyState={
            <EmptyState
              title={t('complex_offers.models.list.empty.title', 'No models yet')}
              description={t(
                'complex_offers.models.list.empty.description',
                'A model is a product you quote to order: base price, margin, sizes, fabrics and add-ons with their surcharges.',
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
