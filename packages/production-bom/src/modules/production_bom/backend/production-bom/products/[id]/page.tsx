'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Copy } from 'lucide-react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall, apiCallOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { BomEditor } from '../../../../components/BomEditor'
import { RequirementsCalculator } from '../../../../components/RequirementsCalculator'
import { DuplicateProductDialog, type DuplicateSource } from '../../../../components/DuplicateProductDialog'
import {
  buildProductFields,
  toProductPayload,
  type ProductFormValues,
} from '../../../../components/productFormFields'
import type { BomView, ListResponse, MaterialRow, ProductRow } from '../../../../components/types'

/**
 * The product screen: fields (with labour time and fabric consumption kept off
 * the BOM), the BOM editor with a live material cost, and the requirement
 * calculator for N units. One screen, because those three answer one question
 * in sequence: what is it, what is it made of, what does an order of it take.
 */
export default function ProductDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const productId = String(params?.id ?? '')

  const [product, setProduct] = React.useState<ProductRow | null>(null)
  const [source, setSource] = React.useState<ProductRow | null>(null)
  const [bom, setBom] = React.useState<BomView | null>(null)
  const [materials, setMaterials] = React.useState<MaterialRow[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadToken, setReloadToken] = React.useState(0)
  const [duplicateSource, setDuplicateSource] = React.useState<DuplicateSource | null>(null)

  React.useEffect(() => {
    if (!productId) {
      setIsLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [productCall, bomCall, materialsCall] = await Promise.all([
          apiCall<ListResponse<ProductRow>>(`/api/production_bom/products?id=${encodeURIComponent(productId)}`),
          apiCall<BomView>(`/api/production_bom/products/${encodeURIComponent(productId)}/bom`),
          apiCall<ListResponse<MaterialRow>>('/api/production_bom/materials?pageSize=100&isActive=true&sortField=name&sortDir=asc'),
        ])
        if (cancelled) return
        const found = productCall.ok ? productCall.result?.items?.[0] : undefined
        if (!found || !bomCall.ok || !bomCall.result) {
          setError(t('production_bom.products.detail.notFound', 'Product not found.'))
          return
        }
        setProduct(found)
        setBom(bomCall.result)
        setMaterials(materialsCall.ok ? materialsCall.result?.items ?? [] : [])
        if (found.source_product_id) {
          const sourceCall = await apiCall<ListResponse<ProductRow>>(
            `/api/production_bom/products?id=${encodeURIComponent(found.source_product_id)}`,
          ).catch(() => null)
          if (!cancelled) setSource(sourceCall?.ok ? sourceCall.result?.items?.[0] ?? null : null)
        } else {
          setSource(null)
        }
      } catch {
        if (!cancelled) setError(t('production_bom.products.detail.notFound', 'Product not found.'))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [productId, reloadToken, t])

  const fields = React.useMemo(() => buildProductFields(t, { includeActive: true }), [t])
  const fabrics = React.useMemo(() => materials.filter((material) => material.material_type === 'fabric'), [materials])

  const handleSubmit = React.useCallback(
    async (values: ProductFormValues) => {
      await updateCrud('production_bom/products', { id: productId, ...toProductPayload(values) }, {
        errorMessage: t('production_bom.products.create.failed', 'Could not save the product.'),
      })
      flash(t('production_bom.common.saved', 'Saved.'), 'success')
      setReloadToken((token) => token + 1)
    },
    [productId, t],
  )

  const handleDelete = React.useCallback(async () => {
    await apiCallOrThrow(`/api/production_bom/products?id=${encodeURIComponent(productId)}`, { method: 'DELETE' })
    flash(t('production_bom.products.list.deleted', 'Deleted.'), 'success')
    router.push('/backend/production-bom/products')
  }, [productId, router, t])

  if (isLoading && !product) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('production_bom.common.loading', 'Loading…')} />
        </PageBody>
      </Page>
    )
  }
  if (error || !product || !bom) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={error ?? t('production_bom.products.detail.notFound', 'Product not found.')} />
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
              productType: product.product_type,
              laborMinutes: product.labor_minutes,
              fabricConsumption: Number(product.fabric_consumption),
              description: product.description ?? '',
              isActive: product.is_active,
            }}
            title={product.name}
            backHref="/backend/production-bom/products"
            cancelHref="/backend/production-bom/products"
            submitLabel={t('production_bom.common.save', 'Save')}
            onSubmit={handleSubmit}
            onDelete={handleDelete}
            twoColumn
            contentHeader={
              source ? (
                <p className="text-sm text-muted-foreground">
                  {t('production_bom.products.detail.copiedFrom', 'Copied from')}{' '}
                  <Link href={`/backend/production-bom/products/${source.id}`} className="font-medium hover:underline">
                    {source.name}
                  </Link>
                </p>
              ) : undefined
            }
            extraActions={
              <Button
                type="button"
                variant="outline"
                onClick={() => setDuplicateSource({ id: product.id, name: product.name })}
              >
                <Copy className="size-4" />
                {t('production_bom.duplicate.title', 'Duplicate product')}
              </Button>
            }
          />

          <BomEditor
            productId={product.id}
            bom={bom}
            materials={materials}
            onSaved={(view) => {
              setBom(view)
            }}
          />

          <RequirementsCalculator
            bom={bom}
            fabrics={fabrics}
            laborMinutes={product.labor_minutes}
            fabricConsumption={product.fabric_consumption}
          />
        </div>
      </PageBody>
      <DuplicateProductDialog
        source={duplicateSource}
        onClose={() => setDuplicateSource(null)}
        onDuplicated={(id) => {
          setDuplicateSource(null)
          router.push(`/backend/production-bom/products/${id}`)
        }}
      />
    </Page>
  )
}
