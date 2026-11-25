/**
 * `POST /api/complex_offers/versions/{id}/copy` — a new draft version (v2, v3…)
 * from the CURRENT version once it has left draft. The source is not modified;
 * the copy is re-priced with the current pricing rules.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { OpenApiMethodDoc, OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { OfferVersion } from '../../../../data/entities'
import { buildOfferView, copyVersion, findOfferInScope, findVersionInScope } from '../../../../lib/offer-repository'
import { notFound } from '../../../../lib/http'
import { requireUuidParam, resolveRequestScope } from '../../../../lib/request-scope'
import { emitComplexOffersEvent } from '../../../../events'

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

  const source = await findVersionInScope(em, scope, idCheck.id)
  if (!source) return notFound()
  const latest = await em.findOne(OfferVersion, { offerId: source.offerId, tenantId, organizationId }, { orderBy: { versionNumber: 'desc' } })
  // One draft at a time: while the current version is still a draft, edit it.
  if (latest && latest.status === 'draft') {
    return NextResponse.json({ error: 'draft_exists', versionNumber: latest.versionNumber }, { status: 409 })
  }
  if (latest && latest.id !== source.id) {
    return NextResponse.json({ error: 'not_current_version', currentVersionNumber: latest.versionNumber }, { status: 409 })
  }

  const version = await copyVersion(em, scope, source)

  try {
    await emitComplexOffersEvent('complex_offers.version.created', {
      offerId: source.offerId,
      versionNumber: version.versionNumber,
      copiedFromVersion: source.versionNumber,
      organizationId,
      tenantId,
    })
  } catch {
    // Events never fail a committed write.
  }

  const offer = await findOfferInScope(em, scope, source.offerId)
  if (!offer) return notFound()
  return NextResponse.json({ versionId: version.id, offer: await buildOfferView(em, scope, offer) }, { status: 201 })
}

const errorSchema = z.object({ error: z.string() }).passthrough()

const postDoc: OpenApiMethodDoc = {
  summary: 'Create the next version from the current one',
  description: 'Copies lines and parameters, re-prices with current rules. 409 `draft_exists` while the current version is a draft.',
  tags: ['Complex Offers'],
  responses: [{ status: 201, description: 'The offer with the new version', schema: z.object({ versionId: z.string().uuid() }).passthrough() }],
  errors: [
    { status: 404, description: 'No such version in this scope', schema: errorSchema },
    { status: 409, description: 'A draft already exists or this is not the current version', schema: errorSchema },
  ],
}

export const openApi: OpenApiRouteDoc = { summary: 'Copy version', methods: { POST: postDoc } }
