'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { SectionHeader } from '@open-mercato/ui/backend/SectionHeader'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { EmptyState } from '@open-mercato/ui/primitives/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@open-mercato/ui/primitives/table'
import { apiCall, apiCallOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import {
  buildMaterialFields,
  toMaterialPayload,
  type MaterialFormValues,
} from '../../../../components/materialFormFields'
import type { ListResponse, MaterialRow, MaterialUsageResponse } from '../../../../components/types'
import { formatDecimal, formatMoney } from '../../../../lib/format'

export default function EditMaterialPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const materialId = String(params?.id ?? '')

  const [material, setMaterial] = React.useState<MaterialRow | null>(null)
  const [usage, setUsage] = React.useState<MaterialUsageResponse | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadToken, setReloadToken] = React.useState(0)

  React.useEffect(() => {
    if (!materialId) {
      setIsLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      try {
        const [materialCall, usageCall] = await Promise.all([
          apiCall<ListResponse<MaterialRow>>(`/api/production_bom/materials?id=${encodeURIComponent(materialId)}`),
          // "Where used" is secondary: if it fails, the form still opens with an empty section.
          apiCall<MaterialUsageResponse>(`/api/production_bom/materials/${encodeURIComponent(materialId)}/usage`).catch(
            () => null,
          ),
        ])
        if (cancelled) return
        const found = materialCall.ok ? materialCall.result?.items?.[0] : undefined
        if (!found) {
          setError(t('production_bom.materials.edit.notFound', 'Material not found.'))
        } else {
          setMaterial(found)
          setUsage(usageCall?.ok ? usageCall.result ?? null : null)
        }
      } catch {
        if (!cancelled) setError(t('production_bom.materials.edit.notFound', 'Material not found.'))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [materialId, reloadToken, t])

  const fields = React.useMemo(() => buildMaterialFields(t, { includeActive: true }), [t])

  const handleSubmit = React.useCallback(
    async (values: MaterialFormValues) => {
      await updateCrud('production_bom/materials', { id: materialId, ...toMaterialPayload(values) }, {
        errorMessage: t('production_bom.materials.create.failed', 'Could not save the material.'),
      })
      flash(t('production_bom.common.saved', 'Saved.'), 'success')
      setReloadToken((token) => token + 1)
    },
    [materialId, t],
  )

  const handleDelete = React.useCallback(async () => {
    await apiCallOrThrow(`/api/production_bom/materials?id=${encodeURIComponent(materialId)}`, { method: 'DELETE' })
    flash(t('production_bom.materials.list.deleted', 'Deleted.'), 'success')
    router.push('/backend/production-bom/materials')
  }, [materialId, router, t])

  if (isLoading && !material) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('production_bom.common.loading', 'Loading…')} />
        </PageBody>
      </Page>
    )
  }
  if (error || !material) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={error ?? t('production_bom.materials.edit.notFound', 'Material not found.')} />
        </PageBody>
      </Page>
    )
  }

  const unitLabel = t(`production_bom.unit.${material.unit}`, material.unit)

  return (
    <Page>
      <PageBody>
        <div className="space-y-8">
          <CrudForm<MaterialFormValues>
            key={`${material.id}:${material.updated_at ?? ''}`}
            fields={fields}
            initialValues={{
              name: material.name,
              code: material.code ?? '',
              materialType: material.material_type,
              unit: material.unit,
              unitPrice: Number(material.unit_price),
              wastePercent: Number(material.waste_percent),
              currencyCode: material.currency_code,
              notes: material.notes ?? '',
              isActive: material.is_active,
            }}
            title={material.name}
            backHref="/backend/production-bom/materials"
            cancelHref="/backend/production-bom/materials"
            submitLabel={t('production_bom.common.save', 'Save')}
            onSubmit={handleSubmit}
            onDelete={handleDelete}
          />

          <section id="usage" className="space-y-3">
            <SectionHeader
              title={t('production_bom.materials.usage.title', 'Where used')}
              count={usage?.items.length ?? 0}
            />
            {usage && usage.items.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('production_bom.products.fields.name', 'Product')}</TableHead>
                      <TableHead>{t('production_bom.products.fields.productType', 'Type')}</TableHead>
                      <TableHead className="text-right">
                        {t('production_bom.materials.usage.quantityPerUnit', 'Per unit')}
                      </TableHead>
                      <TableHead className="text-right">
                        {t('production_bom.materials.usage.costPerUnit', 'Cost per unit')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usage.items.map((item) => (
                      <TableRow key={item.productId}>
                        <TableCell>
                          <Link
                            href={`/backend/production-bom/products/${item.productId}`}
                            className="font-medium hover:underline"
                          >
                            {item.productName}
                          </Link>
                          {item.productCode ? (
                            <span className="ml-2 text-xs text-muted-foreground">{item.productCode}</span>
                          ) : null}
                        </TableCell>
                        <TableCell>{t(`production_bom.productType.${item.productType}`, item.productType)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatDecimal(item.quantityPerUnit, locale)} {unitLabel}
                          {item.piecesPerUnit ? (
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({t('production_bom.bom.piecesCount', '{count} pcs', { count: item.piecesPerUnit })})
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(item.costPerUnit, usage.currencyCode, locale)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState
                title={t('production_bom.materials.usage.empty.title', 'Not used in any product')}
                description={
                  material.material_type === 'fabric'
                    ? t(
                        'production_bom.materials.usage.empty.fabric',
                        'Fabric is chosen per order, so it never appears in a product BOM.',
                      )
                    : t(
                        'production_bom.materials.usage.empty.description',
                        'Add this material to a product BOM and it will show up here.',
                      )
                }
              />
            )}
          </section>
        </div>
      </PageBody>
    </Page>
  )
}
