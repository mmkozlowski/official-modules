'use client'

import * as React from 'react'
import type { SortingState } from '@tanstack/react-table'
import type { FilterValues } from '@open-mercato/ui/backend/FilterBar'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import type { ListResponse } from './types'

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

/**
 * State and loading for a server-paged list: page, page size, search, filters,
 * sorting and a reload token. Both lists of the module use it, so paging and
 * sorting behave identically on the two screens.
 *
 * Sorting is sent to the server as `sortField`/`sortDir` using the column's
 * accessor key — the route's `sortFieldMap` accepts those keys directly.
 */
export function useListQuery<TRow>(options: {
  apiPath: string
  initialSort: SortingState
  loadErrorMessage: string
}) {
  const scopeVersion = useOrganizationScopeVersion()
  const [rows, setRows] = React.useState<TRow[]>([])
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(25)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [filterValues, setFilterValues] = React.useState<FilterValues>({})
  const [sorting, setSorting] = React.useState<SortingState>(options.initialSort)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadToken, setReloadToken] = React.useState(0)

  const params = React.useMemo(() => {
    const query = new URLSearchParams()
    query.set('page', String(page))
    query.set('pageSize', String(pageSize))
    if (search.trim()) query.set('search', search.trim())
    for (const [key, value] of Object.entries(filterValues)) {
      if (typeof value === 'string' && value) query.set(key, value)
    }
    const sort = sorting[0]
    if (sort) {
      query.set('sortField', sort.id)
      query.set('sortDir', sort.desc ? 'desc' : 'asc')
    }
    return query
  }, [filterValues, page, pageSize, search, sorting])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      setError(null)
      const call = await apiCall<ListResponse<TRow>>(`/api/${options.apiPath}?${params.toString()}`)
      if (cancelled) return
      if (!call.ok || !call.result) {
        setRows([])
        setError(options.loadErrorMessage)
        setIsLoading(false)
        return
      }
      setRows(call.result.items ?? [])
      setTotal(call.result.total ?? 0)
      setTotalPages(call.result.totalPages ?? 1)
      setIsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [options.apiPath, options.loadErrorMessage, params, reloadToken, scopeVersion])

  const reload = React.useCallback(() => setReloadToken((token) => token + 1), [])

  return {
    rows,
    setRows,
    page,
    setPage,
    pageSize,
    setPageSize: (size: number) => {
      setPageSize(size)
      setPage(1)
    },
    total,
    totalPages,
    search,
    setSearch: (value: string) => {
      setSearch(value)
      setPage(1)
    },
    filterValues,
    setFilterValues: (values: FilterValues) => {
      setFilterValues(values)
      setPage(1)
    },
    sorting,
    setSorting: (value: SortingState) => {
      setSorting(value)
      setPage(1)
    },
    params,
    isLoading,
    error,
    reload,
  }
}
