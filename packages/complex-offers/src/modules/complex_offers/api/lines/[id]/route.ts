/**
 * `PUT /api/complex_offers/lines/{id}` — changes a line's parameters or
 * quantity and re-prices it with the model's CURRENT rules; the version total
 * follows. This is the "change the fabric, the whole offer recalculates" call.
 *
 * `DELETE /api/complex_offers/lines/{id}` — removes a line from a draft.
 *
 * Both refuse with 409 `version_locked` on a version that is not a draft.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { OpenApiMethodDoc, OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { OfferLine } from '../../../data/entities'
import { updateLineSchema } from '../../../data/validators'
import {
  applyPricing,
  buildOfferView,
  findOfferInScope,
  findVersionInScope,
  loadPricingModel,
  priceForModel,
  refreshTotals,
  type Scope,
} from '../../../lib/offer-repository'
import { lockedResponse, notFound, parseJsonBody } from '../../../lib/http'
import { requireUuidParam, resolveRequestScope } from '../../../lib/request-scope'
import { emitComplexOffersEvent } from '../../../events'
import type { EntityManager } from '@mikro-orm/postgresql'

export const metadata = {
  PUT: { requireAuth: true, requireFeatures: ['complex_offers.edit'] },
  DELETE: { requireAuth: true, requireFeatures: ['complex_offers.edit'] },
}

type RouteContext = { params: { id: string } | Promise<{ id: string }> }

async function loadEditableLine(em: EntityManager, scope: Scope, id: string) {
  const line = await em.findOne(OfferLine, { id, tenantId: scope.tenantId, organizationId: scope.organizationId })
  if (!line) return { ok: false as const, response: notFound() }
  const version = await findVersionInScope(em, scope, line.versionId)
  if (!version) return { ok: false as const, response: notFound() }
  const locked = lockedResponse(version)
  if (locked) return { ok: false as const, response: locked }
  return { ok: true as const, line, version }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const guard = await resolveRequestScope(req)
  if (!guard.ok) return guard.response
  const { em, tenantId, organizationId } = guard.scope
  const scope = { tenantId, organizationId }
  const idCheck = requireUuidParam((await Promise.resolve(context.params)).id)
  if (!idCheck.ok) return idCheck.response
  const body = await parseJsonBody(req, updateLineSchema)
  if (!body.ok) return body.response

  const loadedLine = await loadEditableLine(em, scope, idCheck.id)
  if (!loadedLine.ok) return loadedLine.response
  const { line, version } = loadedLine
  const loaded = await loadPricingModel(em, scope, line.modelId)
  if (!loaded) return NextResponse.json({ error: 'model_not_found' }, { status: 422 })

  const previousTotal = String(line.lineTotal)
  const quantity = body.data.quantity ?? line.quantity
  const selection = { ...(line.selection ?? {}), ...(body.data.selection ?? {}) }
  const priced = priceForModel(loaded.pricing, selection, quantity)
  line.quantity = quantity
  line.modelName = loaded.model.name
  applyPricing(line, priced.pricing, priced.selection)
  await em.flush()
  await refreshTotals(em, scope, version)
  await em.flush()

  try {
    await emitComplexOffersEvent('complex_offers.line.repriced', {
      lineId: line.id,
      offerId: line.offerId,
      versionNumber: version.versionNumber,
      previousTotal,
      lineTotal: priced.pricing.lineTotal,
      changed: Object.keys(body.data),
      organizationId,
      tenantId,
    })
  } catch {
    // Events never fail a committed write.
  }

  const offer = await findOfferInScope(em, scope, version.offerId)
  if (!offer) return notFound()
  return NextResponse.json({ lineId: line.id, previousTotal, offer: await buildOfferView(em, scope, offer) })
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const guard = await resolveRequestScope(req)
  if (!guard.ok) return guard.response
  const { em, tenantId, organizationId } = guard.scope
  const scope = { tenantId, organizationId }
  const idCheck = requireUuidParam((await Promise.resolve(context.params)).id)
  if (!idCheck.ok) return idCheck.response
  const loadedLine = await loadEditableLine(em, scope, idCheck.id)
  if (!loadedLine.ok) return loadedLine.response
  const { line, version } = loadedLine
  em.remove(line)
  await em.flush()
  await refreshTotals(em, scope, version)
  await em.flush()
  const offer = await findOfferInScope(em, scope, version.offerId)
  if (!offer) return notFound()
  return NextResponse.json({ offer: await buildOfferView(em, scope, offer) })
}

const errors = [
  { status: 404, description: 'No such line in this scope', schema: z.object({ error: z.string() }) },
  { status: 409, description: 'Version is not a draft', schema: z.object({ error: z.string(), status: z.string() }) },
]

const putDoc: OpenApiMethodDoc = {
  summary: 'Change a line and re-price it',
  description: 'Merges the selection, re-prices with the current rules and returns the whole offer with the previous line total.',
  tags: ['Complex Offers'],
  requestBody: { schema: updateLineSchema },
  responses: [{ status: 200, description: 'The offer after the change', schema: z.object({ previousTotal: z.string() }).passthrough() }],
  errors,
}

const deleteDoc: OpenApiMethodDoc = {
  summary: 'Remove a line from a draft version',
  tags: ['Complex Offers'],
  responses: [{ status: 200, description: 'The offer after the change', schema: z.object({}).passthrough() }],
  errors,
}

export const openApi: OpenApiRouteDoc = { summary: 'Offer line', methods: { PUT: putDoc, DELETE: deleteDoc } }
