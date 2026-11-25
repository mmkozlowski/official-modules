/**
 * `POST /api/complex_offers/versions/{id}/status` — moves the CURRENT version
 * along draft → sent → accepted | rejected. Sending freezes the version: from
 * then on its lines answer 409 and a change means a new version.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { OpenApiMethodDoc, OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { OfferLine, OfferVersion, type VersionStatus } from '../../../../data/entities'
import { STATUS_TRANSITIONS, changeStatusSchema } from '../../../../data/validators'
import {
  buildOfferView,
  findOfferInScope,
  findVersionInScope,
  syncOfferWithCurrentVersion,
} from '../../../../lib/offer-repository'
import { notFound, parseJsonBody } from '../../../../lib/http'
import { requireUuidParam, resolveRequestScope } from '../../../../lib/request-scope'
import { emitComplexOffersEvent, type ComplexOffersEventId } from '../../../../events'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['complex_offers.edit'] },
}

type RouteContext = { params: { id: string } | Promise<{ id: string }> }

const EVENT_BY_STATUS: Partial<Record<VersionStatus, ComplexOffersEventId>> = {
  sent: 'complex_offers.version.sent',
  accepted: 'complex_offers.version.accepted',
  rejected: 'complex_offers.version.rejected',
}

export async function POST(req: NextRequest, context: RouteContext) {
  const guard = await resolveRequestScope(req)
  if (!guard.ok) return guard.response
  const { em, tenantId, organizationId } = guard.scope
  const scope = { tenantId, organizationId }
  const idCheck = requireUuidParam((await Promise.resolve(context.params)).id)
  if (!idCheck.ok) return idCheck.response
  const body = await parseJsonBody(req, changeStatusSchema)
  if (!body.ok) return body.response

  const version = await findVersionInScope(em, scope, idCheck.id)
  if (!version) return notFound()
  const latest = await em.findOne(OfferVersion, { offerId: version.offerId, tenantId, organizationId }, { orderBy: { versionNumber: 'desc' } })
  if (latest && latest.id !== version.id) {
    return NextResponse.json({ error: 'not_current_version', currentVersionNumber: latest.versionNumber }, { status: 409 })
  }
  const target = body.data.status
  if (!(STATUS_TRANSITIONS[version.status] ?? []).includes(target)) {
    return NextResponse.json({ error: 'invalid_transition', from: version.status, to: target }, { status: 409 })
  }
  if (target === 'sent') {
    const lineCount = await em.count(OfferLine, { versionId: version.id, tenantId, organizationId })
    if (lineCount === 0) return NextResponse.json({ error: 'empty_version' }, { status: 422 })
  }

  const now = new Date()
  version.status = target
  if (target === 'sent') version.sentAt = now
  if (target === 'accepted' || target === 'rejected') version.decidedAt = now
  await em.flush()
  await syncOfferWithCurrentVersion(em, scope, version.offerId)
  await em.flush()

  const eventId = EVENT_BY_STATUS[target]
  if (eventId) {
    try {
      await emitComplexOffersEvent(eventId, {
        offerId: version.offerId,
        versionId: version.id,
        versionNumber: version.versionNumber,
        totalNet: String(version.totalNet),
        organizationId,
        tenantId,
      })
    } catch {
      // Events never fail a committed write.
    }
  }

  const offer = await findOfferInScope(em, scope, version.offerId)
  if (!offer) return notFound()
  return NextResponse.json({ offer: await buildOfferView(em, scope, offer) })
}

const errorSchema = z.object({ error: z.string() }).passthrough()

const postDoc: OpenApiMethodDoc = {
  summary: 'Change the status of the current version',
  description: 'draft → sent (needs at least one line) → accepted | rejected. Any other move is 409 `invalid_transition`.',
  tags: ['Complex Offers'],
  requestBody: { schema: changeStatusSchema },
  responses: [{ status: 200, description: 'The offer after the change', schema: z.object({}).passthrough() }],
  errors: [
    { status: 404, description: 'No such version in this scope', schema: errorSchema },
    { status: 409, description: 'Not the current version, or a move the flow does not allow', schema: errorSchema },
    { status: 422, description: 'A version without lines cannot be sent', schema: errorSchema },
  ],
}

export const openApi: OpenApiRouteDoc = { summary: 'Version status', methods: { POST: postDoc } }
