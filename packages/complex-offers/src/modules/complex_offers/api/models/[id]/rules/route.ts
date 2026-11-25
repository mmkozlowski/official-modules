/**
 * `GET /api/complex_offers/models/{id}/rules` — the model's pricing rules in
 * the shape the pricing engine takes (base price, BOM cost, margin, options,
 * quantity discounts). The offer screen prices with exactly this object.
 *
 * `PUT /api/complex_offers/models/{id}/rules` — replaces every option and
 * discount tier in one transaction. Options sent with their `id` keep it, so
 * existing offer lines that picked them still resolve.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { OpenApiMethodDoc, OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { PricedModelOption } from '../../../../data/entities'
import { replaceRulesSchema } from '../../../../data/validators'
import { loadPricingModel, findModelInScope } from '../../../../lib/offer-repository'
import { notFound, parseJsonBody } from '../../../../lib/http'
import { requireUuidParam, resolveRequestScope } from '../../../../lib/request-scope'
import { emitComplexOffersEvent } from '../../../../events'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['complex_offers.view'] },
  PUT: { requireAuth: true, requireFeatures: ['complex_offers.manage_pricing'] },
}

type RouteContext = { params: { id: string } | Promise<{ id: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  const guard = await resolveRequestScope(req)
  if (!guard.ok) return guard.response
  const { em, tenantId, organizationId } = guard.scope
  const idCheck = requireUuidParam((await Promise.resolve(context.params)).id)
  if (!idCheck.ok) return idCheck.response
  const loaded = await loadPricingModel(em, { tenantId, organizationId }, idCheck.id)
  if (!loaded) return notFound()
  return NextResponse.json({ modelId: loaded.model.id, modelName: loaded.model.name, pricing: loaded.pricing })
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const guard = await resolveRequestScope(req)
  if (!guard.ok) return guard.response
  const { em, tenantId, organizationId } = guard.scope
  const scope = { tenantId, organizationId }
  const idCheck = requireUuidParam((await Promise.resolve(context.params)).id)
  if (!idCheck.ok) return idCheck.response
  const body = await parseJsonBody(req, replaceRulesSchema)
  if (!body.ok) return body.response

  const model = await findModelInScope(em, scope, idCheck.id)
  if (!model) return notFound()

  const existing = await em.find(PricedModelOption, { modelId: model.id, tenantId, organizationId })
  const existingIds = new Set(existing.map((option) => option.id))
  // One default per single-choice kind: the first flagged one wins.
  const defaultTaken = new Set<string>()

  await em.transactional(async (tem) => {
    const keptIds = new Set<string>()
    body.data.options.forEach((input, position) => {
      const isDefault = input.isDefault && input.kind !== 'addon' && !defaultTaken.has(input.kind)
      if (isDefault) defaultTaken.add(input.kind)
      const values = {
        kind: input.kind,
        label: input.label,
        surcharge: String(input.surcharge),
        sizeFactor: String(input.sizeFactor),
        fabricPricePerMeter: String(input.fabricPricePerMeter),
        isDefault,
        position,
      }
      if (input.id && existingIds.has(input.id)) {
        keptIds.add(input.id)
        const option = existing.find((candidate) => candidate.id === input.id)!
        Object.assign(tem.merge(option), values)
      } else {
        tem.persist(tem.create(PricedModelOption, { tenantId, organizationId, modelId: model.id, ...values } as never))
      }
    })
    const removed = existing.filter((option) => !keptIds.has(option.id)).map((option) => option.id)
    if (removed.length) await tem.nativeDelete(PricedModelOption, { id: { $in: removed }, tenantId, organizationId })
    const merged = tem.merge(model)
    merged.quantityDiscounts = [...body.data.quantityDiscounts].sort((a, b) => a.minQuantity - b.minQuantity)
    await tem.flush()
  })

  try {
    await emitComplexOffersEvent('complex_offers.model.rules_updated', {
      modelId: model.id,
      optionCount: body.data.options.length,
      discountTierCount: body.data.quantityDiscounts.length,
      organizationId,
      tenantId,
    })
  } catch {
    // Events never fail a committed write.
  }

  em.clear()
  const loaded = await loadPricingModel(em, scope, model.id)
  return NextResponse.json({ modelId: model.id, modelName: model.name, pricing: loaded?.pricing })
}

const errorSchema = z.object({ error: z.string(), message: z.string().optional() })
const optionSchema = z.object({
  id: z.string().uuid(),
  kind: z.string(),
  label: z.string(),
  surcharge: z.string(),
  sizeFactor: z.string(),
  fabricPricePerMeter: z.string(),
  isDefault: z.boolean().optional(),
})
const rulesSchema = z.object({
  modelId: z.string().uuid(),
  modelName: z.string(),
  pricing: z.object({
    basePrice: z.string(),
    bomMaterialCost: z.string(),
    fabricConsumption: z.string(),
    marginPercent: z.string(),
    quantityDiscounts: z.array(z.object({ minQuantity: z.number(), percent: z.number() })),
    currencyCode: z.string(),
    options: z.array(optionSchema),
  }),
})

const getDoc: OpenApiMethodDoc = {
  summary: 'Read pricing rules of a model',
  description: 'Base price, BOM material cost, fabric consumption, margin, options with surcharges and discount tiers.',
  tags: ['Complex Offers'],
  responses: [{ status: 200, description: 'Pricing rules', schema: rulesSchema }],
  errors: [{ status: 404, description: 'No such model in this scope', schema: errorSchema }],
}

const putDoc: OpenApiMethodDoc = {
  summary: 'Replace pricing rules of a model',
  description: 'Replaces every option and discount tier in one transaction; options sent with an id keep it.',
  tags: ['Complex Offers'],
  requestBody: { schema: replaceRulesSchema },
  responses: [{ status: 200, description: 'The saved rules', schema: rulesSchema }],
  errors: [
    { status: 404, description: 'No such model in this scope', schema: errorSchema },
    { status: 422, description: 'Invalid option or tier', schema: errorSchema },
  ],
}

export const openApi: OpenApiRouteDoc = {
  summary: 'Pricing rules',
  methods: { GET: getDoc, PUT: putDoc },
}
