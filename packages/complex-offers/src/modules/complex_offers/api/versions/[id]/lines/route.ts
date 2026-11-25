/**
 * `POST /api/complex_offers/versions/{id}/lines` — adds a model to a DRAFT
 * version. Parameters not picked yet fall back to the model's defaults, so a
 * new line is priced the moment it exists.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { OpenApiMethodDoc, OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { OfferLine } from '../../../../data/entities'
import { createLineSchema } from '../../../../data/validators'
import {
  applyPricing,
  buildOfferView,
  findOfferInScope,
  findVersionInScope,
  loadPricingModel,
  priceForModel,
  refreshTotals,
} from '../../../../lib/offer-repository'
import { lockedResponse, notFound, parseJsonBody } from '../../../../lib/http'
import { requireUuidParam, resolveRequestScope } from '../../../../lib/request-scope'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['complex_offers.edit'] },
}

type RouteContext = { params: { id: string } | Promise<{ id: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const guard = await resolveRequestScope(req)
  if (!guard.ok) return guard.response
  const { em, tenantId, organizationId } = guard.scope
  const scope = { tenantId, organizationId }
  const idCheck = requireUuidParam((await Promise.resolve(context.params)).id)
  if (!idCheck.ok) return idCheck.response
  const body = await parseJsonBody(req, createLineSchema)
  if (!body.ok) return body.response

  const version = await findVersionInScope(em, scope, idCheck.id)
  if (!version) return notFound()
  const locked = lockedResponse(version)
  if (locked) return locked
  const loaded = await loadPricingModel(em, scope, body.data.modelId)
  if (!loaded) return NextResponse.json({ error: 'model_not_found' }, { status: 422 })

  const position = await em.count(OfferLine, { versionId: version.id, tenantId, organizationId })
  const line = em.create(OfferLine, {
    tenantId,
    organizationId,
    offerId: version.offerId,
    versionId: version.id,
    modelId: loaded.model.id,
    modelName: loaded.model.name,
    quantity: body.data.quantity,
    position,
  } as never) as OfferLine
  const priced = priceForModel(loaded.pricing, body.data.selection, body.data.quantity)
  applyPricing(line, priced.pricing, priced.selection)
  em.persist(line)
  await em.flush()
  await refreshTotals(em, scope, version)
  await em.flush()

  const offer = await findOfferInScope(em, scope, version.offerId)
  if (!offer) return notFound()
  return NextResponse.json({ lineId: line.id, offer: await buildOfferView(em, scope, offer) }, { status: 201 })
}

const postDoc: OpenApiMethodDoc = {
  summary: 'Add a line to a draft version',
  description: 'Prices the model with the given (or default) parameters. 409 `version_locked` when the version is not a draft.',
  tags: ['Complex Offers'],
  requestBody: { schema: createLineSchema },
  responses: [{ status: 201, description: 'The offer after the change', schema: z.object({ lineId: z.string().uuid() }).passthrough() }],
  errors: [
    { status: 404, description: 'No such version in this scope', schema: z.object({ error: z.string() }) },
    { status: 409, description: 'Version is not a draft', schema: z.object({ error: z.string(), status: z.string() }) },
    { status: 422, description: 'Invalid input or unknown model', schema: z.object({ error: z.string() }) },
  ],
}

export const openApi: OpenApiRouteDoc = { summary: 'Offer lines', methods: { POST: postDoc } }
