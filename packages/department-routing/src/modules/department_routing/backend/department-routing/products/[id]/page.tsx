'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { apiCall, apiCallOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { DepartmentRow, ListResponse, ProductRow } from '../../../../components/types'
import { buildProductFields, toProductPayload, type ProductFormValues } from '../../../../components/formFields'
import { RoutingEditor } from '../../../../components/RoutingEditor'

export default function RoutedProductDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const productId = String(params?.id ?? '')
  const [product, setProduct] = React.useState<ProductRow | null>(null)
  const [departments, setDepartments] = React.useState<DepartmentRow[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)
  const fields = React.useMemo(() => buildProductFields(t, { includeActive: true }), [t])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      const [productCall, departmentsCall] = await Promise.all([
        apiCall<ListResponse<ProductRow>>(`/api/department_routing/products?id=${encodeURIComponent(productId)}`).catch(() => null),
        apiCall<ListResponse<DepartmentRow>>('/api/department_routing/departments?pageSize=100&isActive=true&sortField=position&sortDir=asc').catch(
          () => null,
        ),
      ])
      if (cancelled) return
      setProduct(productCall?.ok ? productCall.result?.items?.[0] ?? null : null)
      setDepartments(departmentsCall?.ok ? departmentsCall.result?.items ?? [] : [])
      setIsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [productId, reloadToken])

  const handleSubmit = React.useCallback(
    async (values: ProductFormValues) => {
      await updateCrud('department_routing/products', { id: productId, ...toProductPayload(values) }, {
        errorMessage: t('department_routing.products.create.failed', 'Could not save the product.'),
      })
      flash(t('department_routing.common.saved', 'Saved.'), 'success')
      setReloadToken((token) => token + 1)
    },
    [productId, t],
  )

  const handleDelete = React.useCallback(async () => {
    await apiCallOrThrow(`/api/department_routing/products?id=${encodeURIComponent(productId)}`, { method: 'DELETE' })
    flash(t('department_routing.common.deleted', 'Deleted.'), 'success')
    router.push('/backend/department-routing/products')
  }, [productId, router, t])

  if (isLoading && !product) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('department_routing.common.loading', 'Loading…')} />
        </PageBody>
      </Page>
    )
  }
  if (!product) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={t('department_routing.products.detail.notFound', 'Product not found.')} />
        </PageBody>
      </Page>
    )
  }

  return (
    <Page>
      <PageBody>
        <div className="space-y-8">
          <CrudForm<ProductFormValues>
            key={`${product.id}:${product.updated_at ?? ''}`}
            fields={fields}
            initialValues={{
              name: product.name,
              code: product.code ?? '',
              description: product.description ?? '',
              isActive: product.is_active,
            }}
            title={product.name}
            backHref="/backend/department-routing/products"
            cancelHref="/backend/department-routing/products"
            submitLabel={t('department_routing.common.save', 'Save')}
            onSubmit={handleSubmit}
            onDelete={handleDelete}
            twoColumn
          />
          <RoutingEditor
            key={`${product.id}:${product.department_ids.join(',')}`}
            productId={product.id}
            departmentIds={product.department_ids}
            departments={departments}
            onSaved={() => setReloadToken((token) => token + 1)}
          />
        </div>
      </PageBody>
    </Page>
  )
}
