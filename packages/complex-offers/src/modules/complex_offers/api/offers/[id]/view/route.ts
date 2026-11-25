/**
 * `GET /api/complex_offers/offers/{id}/view` — the offer with every version and
 * every line, each line carrying its priced breakdown. One request renders the
 * whole offer screen, including the read-only view of a sent version.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { OpenApiMethodDoc, OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { buildOfferView, findOfferInScope } from '../../../../lib/offer-repository'
import { notFound } from '../../../../lib/http'
import { requireUuidParam, resolveRequestScope } from '../../../../lib/request-scope'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['complex_offers.view'] },
}

type RouteContext = { params: { id: string } | Promise<{ id: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  const guard = await resolveRequestScope(req)
  if (!guard.ok) return guard.response
  const { em, tenantId, organizationId } = guard.scope
  const idCheck = requireUuidParam((await Promise.resolve(context.params)).id)
  if (!idCheck.ok) return idCheck.response
  const offer = await findOfferInScope(em, { tenantId, organizationId }, idCheck.id)
  if (!offer) return notFound()
  return NextResponse.json(await buildOfferView(em, { tenantId, organizationId }, offer))
}

const getDoc: OpenApiMethodDoc = {
  summary: 'Read an offer with its versions and lines',
  description: 'Every version (v1, v2, …) with its status, totals and lines; each line has its price breakdown.',
  tags: ['Complex Offers'],
  responses: [{ status: 200, description: 'The offer', schema: z.object({ id: z.string().uuid(), versions: z.array(z.unknown()) }).passthrough() }],
  errors: [{ status: 404, description: 'No such offer in this scope', schema: z.object({ error: z.string() }) }],
}

export const openApi: OpenApiRouteDoc = { summary: 'Offer view', methods: { GET: getDoc } }
