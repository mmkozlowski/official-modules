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
import { PRODUCT_TYPES } from '../../../data/validators'
import type { ProductRow } from '../../../components/types'
import { PAGE_SIZE_OPTIONS, useListQuery } from '../../../components/useListQuery'
import { DuplicateProductDialog, type DuplicateSource } from '../../../components/DuplicateProductDialog'
import { formatDecimal, formatMoney } from '../../../lib/format'

const API_PATH = 'production_bom/products'
const TABLE_ID = 'production_bom.products'
const ENTITY_ID = 'production_bom:product'

export default function ProductsListPage() {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [duplicateSource, setDuplicateSource] = React.useState<DuplicateSource | null>(null)
  const list = useListQuery<ProductRow>({
    apiPath: API_PATH,
    initialSort: [{ id: 'name', desc: false }],
    loadErrorMessage: t('production_bom.products.list.loadFailed', 'Could not load products.'),
  })

  const openProduct = React.useCallback(
    (id: string) => router.push(`/backend/production-bom/products/${id}`),
    [router],
  )

  const deleteProducts = React.useCallback(
    async (rows: ProductRow[]) => {
      const confirmed = await confirm({
        title: t('production_bom.products.list.deleteConfirm', 'Delete {count} product(s)?', { count: rows.length }),
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
      if (failed) flash(t('production_bom.products.list.deleteFailed', 'Some products could not be deleted.'), 'error')
      else flash(t('production_bom.products.list.deleted', 'Deleted.'), 'success')
      list.reload()
      return failed === 0
    },
    [confirm, list, t],
  )

  const setActive = React.useCallback(
    async (rows: ProductRow[], isActive: boolean) => {
      for (const row of rows) {
        await apiCallOrThrow(`/api/${API_PATH}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: row.id, isActive }),
        })
      }
      flash(t('production_bom.common.saved', 'Saved.'), 'success')
      list.reload()
      return true
    },
    [list, t],
  )

  const filters = React.useMemo<FilterDef[]>(
    () => [
      {
        id: 'productType',
        label: t('production_bom.products.fields.productType', 'Type'),
        type: 'select',
        options: PRODUCT_TYPES.map((value) => ({ value, label: t(`production_bom.productType.${value}`, value) })),
      },
      {
        id: 'isActive',
        label: t('production_bom.common.status', 'Status'),
        type: 'select',
        options: [
          { value: 'true', label: t('production_bom.common.active', 'Active') },
          { value: 'false', label: t('production_bom.common.inactive', 'Inactive') },
        ],
      },
    ],
    [t],
  )

  const exporter = React.useMemo(() => {
    const params = Object.fromEntries(list.params.entries())
    return {
      view: {
        getUrl: (format: DataTableExportFormat) =>
          buildCrudExportUrl(API_PATH, { ...params, exportScope: 'view' }, format),
      },
      full: {
        getUrl: (format: DataTableExportFormat) =>
          buildCrudExportUrl(API_PATH, { ...params, exportScope: 'full', all: 'true' }, format),
      },
    }
  }, [list.params])

  const columns = React.useMemo<ColumnDef<ProductRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('production_bom.products.fields.name', 'Product'),
        meta: { alwaysVisible: true, maxWidth: '340px' },
        cell: ({ row }) => (
          <Link href={`/backend/production-bom/products/${row.original.id}`} className="font-medium hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: 'code',
        header: t('production_bom.products.fields.code', 'Code'),
        meta: { maxWidth: '140px' },
        cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.code ?? '—'}</span>,
      },
      {
        accessorKey: 'product_type',
        header: t('production_bom.products.fields.productType', 'Type'),
        meta: { maxWidth: '150px' },
        cell: ({ row }) => t(`production_bom.productType.${row.original.product_type}`, row.original.product_type),
      },
      {
        accessorKey: 'bom_line_count',
        header: t('production_bom.products.columns.bomLines', 'BOM lines'),
        enableSorting: false,
        meta: { maxWidth: '110px' },
        cell: ({ row }) => <span className="tabular-nums">{row.original.bom_line_count}</span>,
      },
      {
        accessorKey: 'material_cost',
        header: t('production_bom.products.columns.materialCost', 'Material cost / unit'),
        enableSorting: false,
        meta: { maxWidth: '180px' },
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {formatMoney(row.original.material_cost, row.original.currency_code, locale)}
          </span>
        ),
      },
      {
        accessorKey: 'labor_minutes',
        header: t('production_bom.products.fields.laborMinutes', 'Labour time'),
        meta: { maxWidth: '130px' },
        cell: ({ row }) => (
          <span className="tabular-nums">
            {t('production_bom.common.minutes', '{count} min', { count: row.original.labor_minutes })}
          </span>
        ),
      },
      {
        accessorKey: 'fabric_consumption',
        header: t('production_bom.products.fields.fabricConsumption', 'Fabric per unit'),
        enableSorting: false,
        meta: { maxWidth: '140px' },
        cell: ({ row }) =>
          Number(row.original.fabric_consumption) > 0 ? (
            <span className="tabular-nums">{formatDecimal(row.original.fabric_consumption, locale, 3)} m</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: 'is_active',
        header: t('production_bom.common.status', 'Status'),
        meta: { maxWidth: '120px' },
        cell: ({ row }) =>
          row.original.is_active ? (
            <StatusBadge variant="success">{t('production_bom.common.active', 'Active')}</StatusBadge>
          ) : (
            <StatusBadge variant="neutral">{t('production_bom.common.inactive', 'Inactive')}</StatusBadge>
          ),
      },
      {
        accessorKey: 'source_product_id',
        header: t('production_bom.products.columns.origin', 'Origin'),
        enableSorting: false,
        meta: { hidden: true, maxWidth: '120px' },
        cell: ({ row }) =>
          row.original.source_product_id ? (
            <StatusBadge variant="info">{t('production_bom.products.columns.copy', 'Copy')}</StatusBadge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    ],
    [locale, t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable<ProductRow>
          stickyFirstColumn
          stickyActionsColumn
          title={t('production_bom.products.list.title', 'Products (BOM)')}
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
          searchPlaceholder={t('production_bom.products.list.search', 'Search by name or code')}
          filters={filters}
          filterValues={list.filterValues}
          onFiltersApply={(values: FilterValues) => list.setFilterValues(values)}
          onFiltersClear={() => list.setFilterValues({})}
          exporter={exporter}
          refreshButton={{
            label: t('production_bom.common.refresh', 'Refresh'),
            onRefresh: list.reload,
          }}
          actions={
            <Button asChild>
              <Link href="/backend/production-bom/products/create">
                {t('production_bom.products.list.new', 'New product')}
              </Link>
            </Button>
          }
          onRowClick={(row) => openProduct(row.id)}
          rowActions={(row) => (
            <RowActions
              items={[
                { id: 'open', label: t('production_bom.products.list.openBom', 'Open BOM'), onSelect: () => openProduct(row.id) },
                {
                  id: 'duplicate',
                  label: t('production_bom.duplicate.title', 'Duplicate product'),
                  onSelect: () => setDuplicateSource({ id: row.id, name: row.name }),
                },
                {
                  id: 'delete',
                  label: t('production_bom.common.delete', 'Delete'),
                  destructive: true,
                  onSelect: () => void deleteProducts([row]),
                },
              ]}
            />
          )}
          bulkActions={[
            {
              id: 'deactivate',
              label: t('production_bom.common.deactivate', 'Deactivate'),
              onExecute: (rows: ProductRow[]) => setActive(rows, false),
            },
            {
              id: 'activate',
              label: t('production_bom.common.activate', 'Activate'),
              onExecute: (rows: ProductRow[]) => setActive(rows, true),
            },
            {
              id: 'delete',
              label: t('production_bom.common.deleteSelected', 'Delete selected'),
              destructive: true,
              onExecute: (rows: ProductRow[]) => deleteProducts(rows),
            },
          ]}
          emptyState={
            <EmptyState
              title={t('production_bom.products.list.empty.title', 'No products yet')}
              description={t(
                'production_bom.products.list.empty.description',
                'A product is what the workshop makes: a cushion, a cover, a table. Give it a BOM and its cost appears here.',
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
      <DuplicateProductDialog
        source={duplicateSource}
        onClose={() => setDuplicateSource(null)}
        onDuplicated={(id) => {
          setDuplicateSource(null)
          openProduct(id)
        }}
      />
      {ConfirmDialogElement}
    </Page>
  )
}
