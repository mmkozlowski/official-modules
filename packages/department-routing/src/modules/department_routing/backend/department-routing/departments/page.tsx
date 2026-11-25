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
import { PAGE_SIZE_OPTIONS, useListQuery } from '../../../components/useListQuery'
import type { DepartmentRow } from '../../../components/types'

const API_PATH = 'department_routing/departments'
const TABLE_ID = 'department_routing.departments'
const ENTITY_ID = 'department_routing:department'

export default function DepartmentsListPage() {
  const t = useT()
  const router = useRouter()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const list = useListQuery<DepartmentRow>({
    apiPath: API_PATH,
    initialSort: [{ id: 'position', desc: false }],
    loadErrorMessage: t('department_routing.departments.list.loadFailed', 'Could not load the list.'),
  })

  const openRow = React.useCallback((id: string) => router.push(`/backend/department-routing/departments/${id}`), [router])

  const deleteRows = React.useCallback(
    async (rows: DepartmentRow[]) => {
      const confirmed = await confirm({
        title: t('department_routing.common.deleteConfirm', 'Delete {count} item(s)?', { count: rows.length }),
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
      if (failed) flash(t('department_routing.common.deleteFailed', 'Some items could not be deleted.'), 'error')
      else flash(t('department_routing.common.deleted', 'Deleted.'), 'success')
      list.reload()
      return failed === 0
    },
    [confirm, list, t],
  )

  const setActive = React.useCallback(
    async (rows: DepartmentRow[], isActive: boolean) => {
      for (const row of rows) {
        await apiCallOrThrow(`/api/${API_PATH}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: row.id, isActive }),
        })
      }
      flash(t('department_routing.common.saved', 'Saved.'), 'success')
      list.reload()
      return true
    },
    [list, t],
  )

  const filters = React.useMemo<FilterDef[]>(
    () => [
      {
        id: 'isActive',
        label: t('department_routing.common.status', 'Status'),
        type: 'select',
        options: [
          { value: 'true', label: t('department_routing.common.active', 'Active') },
          { value: 'false', label: t('department_routing.common.inactive', 'Inactive') },
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

  const columns = React.useMemo<ColumnDef<DepartmentRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('department_routing.departments.fields.name', 'Department'),
        meta: { alwaysVisible: true, maxWidth: '260px' },
        cell: ({ row }) => (
          <Link href={`/backend/department-routing/departments/${row.original.id}`} className="font-medium hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: 'code',
        header: t('department_routing.departments.fields.code', 'Code'),
        meta: { maxWidth: '100px' },
        cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.code ?? '—'}</span>,
      },
      {
        accessorKey: 'position',
        header: t('department_routing.departments.fields.position', 'Order of work'),
        meta: { maxWidth: '130px' },
        cell: ({ row }) => <span className="tabular-nums">{row.original.position}</span>,
      },
      {
        accessorKey: 'open_task_count',
        header: t('department_routing.departments.columns.openTasks', 'Open tasks'),
        enableSorting: false,
        meta: { maxWidth: '130px' },
        cell: ({ row }) => <span className="tabular-nums">{row.original.open_task_count}</span>,
      },
      {
        accessorKey: 'open_units',
        header: t('department_routing.departments.columns.openUnits', 'Pcs to make'),
        enableSorting: false,
        meta: { maxWidth: '130px' },
        cell: ({ row }) => <span className="tabular-nums">{row.original.open_units}</span>,
      },
      {
        accessorKey: 'is_active',
        header: t('department_routing.common.status', 'Status'),
        meta: { maxWidth: '120px' },
        cell: ({ row }) =>
          row.original.is_active ? (
            <StatusBadge variant="success">{t('department_routing.common.active', 'Active')}</StatusBadge>
          ) : (
            <StatusBadge variant="neutral">{t('department_routing.common.inactive', 'Inactive')}</StatusBadge>
          ),
      },
    ],
    [t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable<DepartmentRow>
          stickyFirstColumn
          stickyActionsColumn
          title={t('department_routing.departments.list.title', 'departments')}
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
          searchPlaceholder={t('department_routing.common.searchByName', 'Search by name or code')}
          filters={filters}
          filterValues={list.filterValues}
          onFiltersApply={(values: FilterValues) => list.setFilterValues(values)}
          onFiltersClear={() => list.setFilterValues({})}
          exporter={exporter}
          refreshButton={{ label: t('department_routing.common.refresh', 'Refresh'), onRefresh: list.reload }}
          actions={
            <Button asChild>
              <Link href="/backend/department-routing/departments/create">{t('department_routing.departments.list.new', 'New')}</Link>
            </Button>
          }
          onRowClick={(row) => openRow(row.id)}
          rowActions={(row) => (
            <RowActions
              items={[
                { id: 'open', label: t('department_routing.common.open', 'Open'), onSelect: () => openRow(row.id) },
                {
                  id: 'board',
                  label: t('department_routing.departments.list.openBoard', 'Open board'),
                  onSelect: () => router.push(`/backend/department-routing/board?department=${encodeURIComponent(row.id)}`),
                },
                {
                  id: 'delete',
                  label: t('department_routing.common.delete', 'Delete'),
                  destructive: true,
                  onSelect: () => void deleteRows([row]),
                },
              ]}
            />
          )}
          bulkActions={[
            { id: 'deactivate', label: t('department_routing.common.deactivate', 'Deactivate'), onExecute: (rows: DepartmentRow[]) => setActive(rows, false) },
            { id: 'activate', label: t('department_routing.common.activate', 'Activate'), onExecute: (rows: DepartmentRow[]) => setActive(rows, true) },
            {
              id: 'delete',
              label: t('department_routing.common.deleteSelected', 'Delete selected'),
              destructive: true,
              onExecute: (rows: DepartmentRow[]) => deleteRows(rows),
            },
          ]}
          emptyState={
            <EmptyState
              title={t('department_routing.departments.list.empty.title', 'Nothing here yet')}
              description={t('department_routing.departments.list.empty.description', '')}
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
