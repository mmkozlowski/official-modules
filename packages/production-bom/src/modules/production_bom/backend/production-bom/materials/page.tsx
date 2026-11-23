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
import { MATERIAL_TYPES, MATERIAL_UNITS } from '../../../data/validators'
import type { MaterialRow } from '../../../components/types'
import { PAGE_SIZE_OPTIONS, useListQuery } from '../../../components/useListQuery'
import { formatDecimal, formatMoney } from '../../../lib/format'

const API_PATH = 'production_bom/materials'
const TABLE_ID = 'production_bom.materials'
const ENTITY_ID = 'production_bom:material'

export default function MaterialsListPage() {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const list = useListQuery<MaterialRow>({
    apiPath: API_PATH,
    initialSort: [{ id: 'name', desc: false }],
    loadErrorMessage: t('production_bom.materials.list.loadFailed', 'Could not load materials.'),
  })

  const openMaterial = React.useCallback(
    (id: string) => router.push(`/backend/production-bom/materials/${id}`),
    [router],
  )

  const deleteMaterials = React.useCallback(
    async (rows: MaterialRow[]) => {
      const confirmed = await confirm({
        title: t('production_bom.materials.list.deleteConfirm', 'Delete {count} material(s)?', { count: rows.length }),
        description: t(
          'production_bom.materials.list.deleteDescription',
          'Products that use them keep the lines, marked as a deleted material.',
        ),
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
      if (failed) flash(t('production_bom.materials.list.deleteFailed', 'Some materials could not be deleted.'), 'error')
      else flash(t('production_bom.materials.list.deleted', 'Deleted.'), 'success')
      list.reload()
      return failed === 0
    },
    [confirm, list, t],
  )

  const setActive = React.useCallback(
    async (rows: MaterialRow[], isActive: boolean) => {
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
        id: 'materialType',
        label: t('production_bom.materials.fields.materialType', 'Type'),
        type: 'select',
        options: MATERIAL_TYPES.map((value) => ({ value, label: t(`production_bom.materialType.${value}`, value) })),
      },
      {
        id: 'unit',
        label: t('production_bom.materials.fields.unit', 'Unit'),
        type: 'select',
        options: MATERIAL_UNITS.map((value) => ({ value, label: t(`production_bom.unit.${value}`, value) })),
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

  const columns = React.useMemo<ColumnDef<MaterialRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('production_bom.materials.fields.name', 'Material'),
        meta: { alwaysVisible: true, maxWidth: '320px' },
        cell: ({ row }) => (
          <Link href={`/backend/production-bom/materials/${row.original.id}`} className="font-medium hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: 'code',
        header: t('production_bom.materials.fields.code', 'Code'),
        meta: { maxWidth: '140px' },
        cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.code ?? '—'}</span>,
      },
      {
        accessorKey: 'material_type',
        header: t('production_bom.materials.fields.materialType', 'Type'),
        meta: { maxWidth: '220px' },
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-2">
            <span>{t(`production_bom.materialType.${row.original.material_type}`, row.original.material_type)}</span>
            {row.original.material_type === 'fabric' ? (
              <StatusBadge variant="info">{t('production_bom.materials.fabricOutsideCost', 'outside product cost')}</StatusBadge>
            ) : null}
          </span>
        ),
      },
      {
        accessorKey: 'unit',
        header: t('production_bom.materials.fields.unit', 'Unit'),
        meta: { maxWidth: '90px' },
        cell: ({ row }) => t(`production_bom.unit.${row.original.unit}`, row.original.unit),
      },
      {
        accessorKey: 'unit_price',
        header: t('production_bom.materials.fields.unitPrice', 'Unit price (net)'),
        meta: { maxWidth: '160px' },
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatMoney(row.original.unit_price, row.original.currency_code, locale)}
            <span className="text-muted-foreground"> / {t(`production_bom.unit.${row.original.unit}`, row.original.unit)}</span>
          </span>
        ),
      },
      {
        accessorKey: 'waste_percent',
        header: t('production_bom.materials.fields.wastePercent', 'Allowance'),
        meta: { maxWidth: '110px' },
        cell: ({ row }) =>
          Number(row.original.waste_percent) > 0 ? (
            <span className="tabular-nums">+{formatDecimal(row.original.waste_percent, locale, 2)}%</span>
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
        accessorKey: 'notes',
        header: t('production_bom.materials.fields.notes', 'Notes'),
        meta: { hidden: true, maxWidth: '260px' },
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.notes ?? '—'}</span>,
      },
    ],
    [locale, t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable<MaterialRow>
          stickyFirstColumn
          stickyActionsColumn
          title={t('production_bom.materials.list.title', 'Materials')}
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
          searchPlaceholder={t('production_bom.materials.list.search', 'Search by name or code')}
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
              <Link href="/backend/production-bom/materials/create">
                {t('production_bom.materials.list.new', 'New material')}
              </Link>
            </Button>
          }
          onRowClick={(row) => openMaterial(row.id)}
          rowActions={(row) => (
            <RowActions
              items={[
                { id: 'open', label: t('production_bom.common.edit', 'Edit'), onSelect: () => openMaterial(row.id) },
                {
                  id: 'usage',
                  label: t('production_bom.materials.list.whereUsed', 'Where used'),
                  onSelect: () => router.push(`/backend/production-bom/materials/${row.id}#usage`),
                },
                {
                  id: 'delete',
                  label: t('production_bom.common.delete', 'Delete'),
                  destructive: true,
                  onSelect: () => void deleteMaterials([row]),
                },
              ]}
            />
          )}
          bulkActions={[
            {
              id: 'deactivate',
              label: t('production_bom.common.deactivate', 'Deactivate'),
              onExecute: (rows: MaterialRow[]) => setActive(rows, false),
            },
            {
              id: 'activate',
              label: t('production_bom.common.activate', 'Activate'),
              onExecute: (rows: MaterialRow[]) => setActive(rows, true),
            },
            {
              id: 'delete',
              label: t('production_bom.common.deleteSelected', 'Delete selected'),
              destructive: true,
              onExecute: (rows: MaterialRow[]) => deleteMaterials(rows),
            },
          ]}
          emptyState={
            <EmptyState
              title={t('production_bom.materials.list.empty.title', 'No materials yet')}
              description={t(
                'production_bom.materials.list.empty.description',
                'Add foam, zippers, cord and fabrics with their unit and price — products are built from them.',
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
