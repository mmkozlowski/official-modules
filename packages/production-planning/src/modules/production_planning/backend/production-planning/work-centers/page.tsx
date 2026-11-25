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
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { PAGE_SIZE_OPTIONS, useListQuery } from '@open-mercato/production-bom/modules/production_bom/components/useListQuery'
import { WORK_CENTER_STAGES } from '../../../data/validators'
import type { WorkCenterRow } from '../../../components/types'
import { STAGE_CLASSES, formatHours } from '../../../components/planFormat'

const API_PATH = 'production_planning/work-centers'
const TABLE_ID = 'production_planning.work_centers'
const ENTITY_ID = 'production_planning:work_center'

export default function WorkCentersListPage() {
  const t = useT()
  const router = useRouter()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const list = useListQuery<WorkCenterRow>({
    apiPath: API_PATH,
    initialSort: [{ id: 'position', desc: false }],
    loadErrorMessage: t('production_planning.workCenters.list.loadFailed', 'Could not load work centres.'),
  })

  const openCentre = React.useCallback((id: string) => router.push(`/backend/production-planning/work-centers/${id}`), [router])

  const deleteCentres = React.useCallback(
    async (rows: WorkCenterRow[]) => {
      const confirmed = await confirm({
        title: t('production_planning.workCenters.list.deleteConfirm', 'Delete {count} work centre(s)?', { count: rows.length }),
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
      if (failed) flash(t('production_planning.workCenters.list.deleteFailed', 'Some work centres could not be deleted.'), 'error')
      else flash(t('production_planning.common.deleted', 'Deleted.'), 'success')
      list.reload()
      return failed === 0
    },
    [confirm, list, t],
  )

  const setActive = React.useCallback(
    async (rows: WorkCenterRow[], isActive: boolean) => {
      for (const row of rows) {
        await apiCallOrThrow(`/api/${API_PATH}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: row.id, isActive }),
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
        id: 'stage',
        label: t('production_planning.workCenters.fields.stage', 'Stage'),
        type: 'select',
        options: WORK_CENTER_STAGES.map((value) => ({ value, label: t(`production_planning.stage.${value}`, value) })),
      },
      {
        id: 'isActive',
        label: t('production_planning.common.status', 'Status'),
        type: 'select',
        options: [
          { value: 'true', label: t('production_planning.common.active', 'Active') },
          { value: 'false', label: t('production_planning.common.inactive', 'Inactive') },
        ],
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

  const columns = React.useMemo<ColumnDef<WorkCenterRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('production_planning.workCenters.fields.name', 'Work centre'),
        meta: { alwaysVisible: true, maxWidth: '300px' },
        cell: ({ row }) => (
          <Link href={`/backend/production-planning/work-centers/${row.original.id}`} className="flex items-center gap-2 font-medium hover:underline">
            <span className={`inline-block size-2.5 rounded-sm ${STAGE_CLASSES[row.original.stage] ?? STAGE_CLASSES.other}`} />
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: 'code',
        header: t('production_planning.workCenters.fields.code', 'Code'),
        meta: { maxWidth: '110px' },
        cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.code ?? '—'}</span>,
      },
      {
        accessorKey: 'stage',
        header: t('production_planning.workCenters.fields.stage', 'Stage'),
        meta: { maxWidth: '160px' },
        cell: ({ row }) => t(`production_planning.stage.${row.original.stage}`, row.original.stage),
      },
      {
        accessorKey: 'daily_capacity_minutes',
        header: t('production_planning.workCenters.columns.capacity', 'Capacity / day'),
        meta: { maxWidth: '160px' },
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatHours(row.original.daily_capacity_minutes)}{' '}
            <span className="text-muted-foreground">({row.original.daily_capacity_minutes} min)</span>
          </span>
        ),
      },
      {
        accessorKey: 'position',
        header: t('production_planning.workCenters.fields.position', 'Order on the plan'),
        meta: { maxWidth: '130px', hidden: true },
        cell: ({ row }) => <span className="tabular-nums">{row.original.position}</span>,
      },
      {
        accessorKey: 'notes',
        header: t('production_planning.workCenters.fields.notes', 'Notes'),
        enableSorting: false,
        meta: { maxWidth: '360px' },
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.notes ?? '—'}</span>,
      },
      {
        accessorKey: 'is_active',
        header: t('production_planning.common.status', 'Status'),
        meta: { maxWidth: '120px' },
        cell: ({ row }) =>
          row.original.is_active ? (
            <StatusBadge variant="success">{t('production_planning.common.active', 'Active')}</StatusBadge>
          ) : (
            <StatusBadge variant="neutral">{t('production_planning.common.inactive', 'Inactive')}</StatusBadge>
          ),
      },
    ],
    [t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable<WorkCenterRow>
          stickyFirstColumn
          stickyActionsColumn
          title={t('production_planning.workCenters.list.title', 'Work centres')}
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
          searchPlaceholder={t('production_planning.workCenters.list.search', 'Search by name or code')}
          filters={filters}
          filterValues={list.filterValues}
          onFiltersApply={(values: FilterValues) => list.setFilterValues(values)}
          onFiltersClear={() => list.setFilterValues({})}
          exporter={exporter}
          refreshButton={{ label: t('production_planning.common.refresh', 'Refresh'), onRefresh: list.reload }}
          actions={
            <Button asChild>
              <Link href="/backend/production-planning/work-centers/create">
                {t('production_planning.workCenters.list.new', 'New work centre')}
              </Link>
            </Button>
          }
          onRowClick={(row) => openCentre(row.id)}
          rowActions={(row) => (
            <RowActions
              items={[
                { id: 'open', label: t('production_planning.common.open', 'Open'), onSelect: () => openCentre(row.id) },
                { id: 'delete', label: t('production_planning.common.delete', 'Delete'), destructive: true, onSelect: () => void deleteCentres([row]) },
              ]}
            />
          )}
          bulkActions={[
            { id: 'deactivate', label: t('production_planning.common.deactivate', 'Deactivate'), onExecute: (rows: WorkCenterRow[]) => setActive(rows, false) },
            { id: 'activate', label: t('production_planning.common.activate', 'Activate'), onExecute: (rows: WorkCenterRow[]) => setActive(rows, true) },
            {
              id: 'delete',
              label: t('production_planning.common.deleteSelected', 'Delete selected'),
              destructive: true,
              onExecute: (rows: WorkCenterRow[]) => deleteCentres(rows),
            },
          ]}
          emptyState={
            <EmptyState
              title={t('production_planning.workCenters.list.empty.title', 'No work centres yet')}
              description={t(
                'production_planning.workCenters.list.empty.description',
                'A work centre is a place with a daily capacity: the cutting room, the sewing room, packing. Routings send work through them.',
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
