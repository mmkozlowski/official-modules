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
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCallOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { buildCrudExportUrl } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import { VERSION_STATUSES } from '../../../data/validators'
import type { OfferRow } from '../../../components/types'
import { PAGE_SIZE_OPTIONS, useListQuery } from '../../../components/useListQuery'
import { VersionStatusBadge } from '../../../components/StatusBadgeForVersion'
import { formatMoney } from '../../../lib/format'

const API_PATH = 'complex_offers/offers'
const TABLE_ID = 'complex_offers.offers'
const ENTITY_ID = 'complex_offers:offer'

export default function OffersListPage() {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const list = useListQuery<OfferRow>({
    apiPath: API_PATH,
    initialSort: [{ id: 'number', desc: true }],
    loadErrorMessage: t('complex_offers.offers.list.loadFailed', 'Could not load offers.'),
  })

  const openOffer = React.useCallback((id: string) => router.push(`/backend/complex-offers/offers/${id}`), [router])
  const openPrint = React.useCallback(async (row: OfferRow) => {
    const view = await apiCallOrThrow<{ versions: Array<{ id: string; versionNumber: number }> }>(
      `/api/complex_offers/offers/${encodeURIComponent(row.id)}/view`,
    ).catch(() => null)
    const current = view?.result?.versions?.at(-1)
    if (current) window.open(`/api/complex_offers/versions/${current.id}/print`, '_blank', 'noopener')
  }, [])

  const deleteOffers = React.useCallback(
    async (rows: OfferRow[]) => {
      const confirmed = await confirm({
        title: t('complex_offers.offers.list.deleteConfirm', 'Delete {count} offer(s)?', { count: rows.length }),
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
      if (failed) flash(t('complex_offers.offers.list.deleteFailed', 'Some offers could not be deleted.'), 'error')
      else flash(t('complex_offers.common.deleted', 'Deleted.'), 'success')
      list.reload()
      return failed === 0
    },
    [confirm, list, t],
  )

  const filters = React.useMemo<FilterDef[]>(
    () => [
      {
        id: 'status',
        label: t('complex_offers.fields.status', 'Status'),
        type: 'select',
        options: VERSION_STATUSES.map((value) => ({ value, label: t(`complex_offers.status.${value}`, value) })),
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

  const formatDate = React.useCallback(
    (value: string | null) => (value ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value)) : '—'),
    [locale],
  )

  const columns = React.useMemo<ColumnDef<OfferRow>[]>(
    () => [
      {
        accessorKey: 'number',
        header: t('complex_offers.fields.number', 'Number'),
        meta: { alwaysVisible: true, maxWidth: '150px' },
        cell: ({ row }) => (
          <Link href={`/backend/complex-offers/offers/${row.original.id}`} className="font-medium tabular-nums hover:underline">
            {row.original.number}
          </Link>
        ),
      },
      {
        accessorKey: 'customer_name',
        header: t('complex_offers.fields.customerName', 'Customer'),
        meta: { maxWidth: '260px' },
      },
      {
        accessorKey: 'title',
        header: t('complex_offers.fields.title', 'Subject'),
        meta: { maxWidth: '280px' },
      },
      {
        accessorKey: 'current_version_number',
        header: t('complex_offers.offers.columns.version', 'Version'),
        meta: { maxWidth: '100px' },
        cell: ({ row }) => <span className="tabular-nums">v{row.original.current_version_number}</span>,
      },
      {
        accessorKey: 'status',
        header: t('complex_offers.fields.status', 'Status'),
        meta: { maxWidth: '140px' },
        cell: ({ row }) => <VersionStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'total_net',
        header: t('complex_offers.offers.columns.totalNet', 'Value net'),
        meta: { maxWidth: '160px' },
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">{formatMoney(row.original.total_net, row.original.currency_code, locale)}</span>
        ),
      },
      {
        accessorKey: 'valid_until',
        header: t('complex_offers.fields.validUntil', 'Valid until'),
        meta: { maxWidth: '140px' },
        cell: ({ row }) => <span className="tabular-nums">{formatDate(row.original.valid_until)}</span>,
      },
      {
        accessorKey: 'contact_person',
        header: t('complex_offers.fields.contactPerson', 'Contact'),
        enableSorting: false,
        meta: { hidden: true, maxWidth: '180px' },
        cell: ({ row }) => row.original.contact_person ?? <span className="text-muted-foreground">—</span>,
      },
      {
        accessorKey: 'updated_at',
        header: t('complex_offers.common.updatedAt', 'Updated'),
        meta: { hidden: true, maxWidth: '140px' },
        cell: ({ row }) => <span className="tabular-nums">{formatDate(row.original.updated_at ?? null)}</span>,
      },
    ],
    [formatDate, locale, t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable<OfferRow>
          stickyFirstColumn
          stickyActionsColumn
          title={t('complex_offers.offers.list.title', 'Offers')}
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
          searchPlaceholder={t('complex_offers.offers.list.search', 'Search by number, customer or subject')}
          filters={filters}
          filterValues={list.filterValues}
          onFiltersApply={(values: FilterValues) => list.setFilterValues(values)}
          onFiltersClear={() => list.setFilterValues({})}
          exporter={exporter}
          refreshButton={{ label: t('complex_offers.common.refresh', 'Refresh'), onRefresh: list.reload }}
          actions={
            <Button asChild>
              <Link href="/backend/complex-offers/offers/create">{t('complex_offers.offers.list.new', 'New offer')}</Link>
            </Button>
          }
          onRowClick={(row) => openOffer(row.id)}
          rowActions={(row) => (
            <RowActions
              items={[
                { id: 'open', label: t('complex_offers.offers.list.open', 'Open offer'), onSelect: () => openOffer(row.id) },
                { id: 'print', label: t('complex_offers.offers.print', 'Print / PDF'), onSelect: () => void openPrint(row) },
                {
                  id: 'delete',
                  label: t('complex_offers.common.delete', 'Delete'),
                  destructive: true,
                  onSelect: () => void deleteOffers([row]),
                },
              ]}
            />
          )}
          bulkActions={[
            {
              id: 'delete',
              label: t('complex_offers.common.deleteSelected', 'Delete selected'),
              destructive: true,
              onExecute: (rows: OfferRow[]) => deleteOffers(rows),
            },
          ]}
          emptyState={
            <EmptyState
              title={t('complex_offers.offers.list.empty.title', 'No offers yet')}
              description={t(
                'complex_offers.offers.list.empty.description',
                'An offer is a set of configured products for one customer. Create one and add products — each is priced from its parameters.',
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
