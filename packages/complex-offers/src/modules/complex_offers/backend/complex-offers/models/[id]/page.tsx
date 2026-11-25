'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall, apiCallOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import type { PricingModel } from '../../../../lib/pricing'
import { formatMoney } from '../../../../lib/format'
import { buildModelFields, toModelPayload, type ModelFormValues } from '../../../../components/modelFormFields'
import { PricingRulesEditor } from '../../../../components/PricingRulesEditor'
import type { ListResponse, ModelRow, RulesResponse } from '../../../../components/types'

type BomProductRow = { id: string; code: string | null; name: string; material_cost: string; currency_code: string }

/**
 * A model's screen: its fields, the material cost copied from the production
 * BOM (refreshed on demand through the BOM module's public API — no shared
 * tables), and the price list editor.
 */
export default function ModelDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const modelId = String(params?.id ?? '')
  const [model, setModel] = React.useState<ModelRow | null>(null)
  const [pricing, setPricing] = React.useState<PricingModel | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadToken, setReloadToken] = React.useState(0)
  const [isRefreshing, setIsRefreshing] = React.useState(false)

  React.useEffect(() => {
    if (!modelId) {
      setIsLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      setError(null)
      const [modelCall, rulesCall] = await Promise.all([
        apiCall<ListResponse<ModelRow>>(`/api/complex_offers/models?id=${encodeURIComponent(modelId)}`).catch(() => null),
        apiCall<RulesResponse>(`/api/complex_offers/models/${encodeURIComponent(modelId)}/rules`).catch(() => null),
      ])
      if (cancelled) return
      const found = modelCall?.ok ? modelCall.result?.items?.[0] : undefined
      if (!found || !rulesCall?.ok || !rulesCall.result) {
        setError(t('complex_offers.models.detail.notFound', 'Model not found.'))
        setIsLoading(false)
        return
      }
      setModel(found)
      setPricing(rulesCall.result.pricing)
      setIsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [modelId, reloadToken, t])

  const fields = React.useMemo(() => buildModelFields(t, { includeActive: true }), [t])

  const handleSubmit = React.useCallback(
    async (values: ModelFormValues) => {
      await updateCrud('complex_offers/models', { id: modelId, ...toModelPayload(values) }, {
        errorMessage: t('complex_offers.models.create.failed', 'Could not save the model.'),
      })
      flash(t('complex_offers.common.saved', 'Saved.'), 'success')
      setReloadToken((token) => token + 1)
    },
    [modelId, t],
  )

  const handleDelete = React.useCallback(async () => {
    await apiCallOrThrow(`/api/complex_offers/models?id=${encodeURIComponent(modelId)}`, { method: 'DELETE' })
    flash(t('complex_offers.common.deleted', 'Deleted.'), 'success')
    router.push('/backend/complex-offers/models')
  }, [modelId, router, t])

  const refreshFromBom = React.useCallback(async () => {
    if (!model?.bom_product_code) return
    setIsRefreshing(true)
    const call = await apiCall<ListResponse<BomProductRow>>(
      `/api/production_bom/products?search=${encodeURIComponent(model.bom_product_code)}&pageSize=20`,
    ).catch(() => null)
    const product = call?.ok ? call.result?.items?.find((item) => item.code === model.bom_product_code) : undefined
    if (!product) {
      setIsRefreshing(false)
      flash(
        t('complex_offers.models.bom.notFound', 'No BOM product with code {code} (or the BOM module is not available).', {
          code: model.bom_product_code,
        }),
        'error',
      )
      return
    }
    const saved = await apiCall(`/api/complex_offers/models`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: model.id, bomMaterialCost: Number(product.material_cost), bomCostRefreshed: true }),
    })
    setIsRefreshing(false)
    if (!saved.ok) {
      flash(t('complex_offers.models.bom.failed', 'The material cost was not updated.'), 'error')
      return
    }
    flash(
      t('complex_offers.models.bom.refreshed', 'Material cost from BOM {code} ({name}): {cost}.', {
        code: model.bom_product_code,
        name: product.name,
        cost: formatMoney(product.material_cost, product.currency_code, locale),
      }),
      'success',
    )
    setReloadToken((token) => token + 1)
  }, [locale, model, t])

  if (isLoading && !model) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('complex_offers.common.loading', 'Loading…')} />
        </PageBody>
      </Page>
    )
  }
  if (error || !model || !pricing) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={error ?? t('complex_offers.models.detail.notFound', 'Model not found.')} />
        </PageBody>
      </Page>
    )
  }

  const refreshedAt = model.bom_cost_refreshed_at
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(model.bom_cost_refreshed_at))
    : null

  return (
    <Page>
      <PageBody>
        <div className="space-y-8">
          <CrudForm<ModelFormValues>
            key={`${model.id}:${model.updated_at ?? ''}`}
            fields={fields}
            initialValues={{
              name: model.name,
              code: model.code ?? '',
              description: model.description ?? '',
              basePrice: Number(model.base_price),
              marginPercent: Number(model.margin_percent),
              bomProductCode: model.bom_product_code ?? '',
              bomMaterialCost: Number(model.bom_material_cost),
              fabricConsumption: Number(model.fabric_consumption),
              isActive: model.is_active,
            }}
            title={model.name}
            backHref="/backend/complex-offers/models"
            cancelHref="/backend/complex-offers/models"
            submitLabel={t('complex_offers.common.save', 'Save')}
            onSubmit={handleSubmit}
            onDelete={handleDelete}
            twoColumn
            contentHeader={
              model.bom_product_code ? (
                <p className="text-sm text-muted-foreground" data-testid="bom-cost-info">
                  {t('complex_offers.models.bom.info', 'Material cost {cost} copied from BOM product {code}', {
                    cost: formatMoney(model.bom_material_cost, model.currency_code, locale),
                    code: model.bom_product_code,
                  })}
                  {refreshedAt ? ` · ${t('complex_offers.models.bom.refreshedAt', 'refreshed {date}', { date: refreshedAt })}` : ''}
                </p>
              ) : undefined
            }
            extraActions={
              model.bom_product_code ? (
                <Button type="button" variant="outline" onClick={() => void refreshFromBom()} disabled={isRefreshing}>
                  <RefreshCw className="size-4" />
                  {t('complex_offers.models.bom.refresh', 'Take current cost from BOM')}
                </Button>
              ) : undefined
            }
          />
          <PricingRulesEditor modelId={model.id} pricing={pricing} onSaved={setPricing} />
        </div>
      </PageBody>
    </Page>
  )
}
