/**
 * `GET /api/production_planning/routings/{productId}` — the product's routing.
 * `PUT` — replaces the whole routing in one transaction; array order is the
 * step order. Same contract as the BOM endpoint: the editor always sends the
 * full list, so a half-saved routing cannot exist.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiMethodDoc, OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { Product } from '@open-mercato/production-bom/modules/production_bom/data/entities'
import { RoutingStep, WorkCenter } from '../../../data/entities'
import { replaceRoutingSchema } from '../../../data/validators'
import { requireUuidParam, resolveRequestScope } from '../../../lib/request-scope'
import { emitProductionPlanningEvent } from '../../../events'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['production_planning.view'] },
  PUT: { requireAuth: true, requireFeatures: ['production_planning.edit'] },
}

type RouteContext = { params: { productId: string } | Promise<{ productId: string }> }
type Scope = { tenantId: string; organizationId: string }

async function buildRoutingView(em: EntityManager, scope: Scope, product: Product) {
  const steps = await em.find(RoutingStep, { ...scope, productId: product.id }, { orderBy: { sequence: 'asc' } })
  const centres = await em.find(WorkCenter, { ...scope, id: { $in: steps.map((step) => step.workCenterId) } })
  const centreById = new Map(centres.map((centre) => [centre.id, centre]))
  return {
    product: {
      id: product.id,
      name: product.name,
      code: product.code ?? null,
      laborMinutes: product.laborMinutes,
    },
    steps: steps.map((step) => ({
      id: step.id,
      workCenterId: step.workCenterId,
      workCenterName: centreById.get(step.workCenterId)?.name ?? '—',
      workCenterMissing: !centreById.get(step.workCenterId) || centreById.get(step.workCenterId)?.deletedAt != null,
      sequence: step.sequence,
      minutesPerUnit: String(step.minutesPerUnit),
      setupMinutes: step.setupMinutes,
      notes: step.notes ?? null,
    })),
  }
}

async function findProduct(em: EntityManager, scope: Scope, id: string) {
  return em.findOne(Product, { id, ...scope, deletedAt: null })
}

export async function GET(req: NextRequest, context: RouteContext) {
  const guard = await resolveRequestScope(req)
  if (!guard.ok) return guard.response
  const { em, tenantId, organizationId } = guard.scope
  const idCheck = requireUuidParam((await Promise.resolve(context.params)).productId)
  if (!idCheck.ok) return idCheck.response
  const product = await findProduct(em, { tenantId, organizationId }, idCheck.id)
  if (!product) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json(await buildRoutingView(em, { tenantId, organizationId }, product))
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const guard = await resolveRequestScope(req)
  if (!guard.ok) return guard.response
  const { em, tenantId, organizationId } = guard.scope
  const scope = { tenantId, organizationId }
  const idCheck = requireUuidParam((await Promise.resolve(context.params)).productId)
  if (!idCheck.ok) return idCheck.response

  let body: unknown = {}
  try {
    body = await req.json()
  } catch {
    // Malformed JSON — rejected below.
  }
  const parsed = replaceRoutingSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json({ error: 'VALIDATION_FAILED', message: issue?.message, path: issue?.path }, { status: 422 })
  }
  const product = await findProduct(em, scope, idCheck.id)
  if (!product) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const centreIds = Array.from(new Set(parsed.data.steps.map((step) => step.workCenterId)))
  const centres = centreIds.length
    ? await em.find(WorkCenter, { ...scope, id: { $in: centreIds }, deletedAt: null })
    : []
  const known = new Set(centres.map((centre) => centre.id))
  const unknownIndex = parsed.data.steps.findIndex((step) => !known.has(step.workCenterId))
  if (unknownIndex >= 0) {
    return NextResponse.json({ error: 'work_center_not_found', index: unknownIndex }, { status: 422 })
  }

  await em.transactional(async (tem) => {
    await tem.nativeDelete(RoutingStep, { ...scope, productId: product.id })
    parsed.data.steps.forEach((step, index) => {
      tem.persist(
        tem.create(RoutingStep, {
          ...scope,
          productId: product.id,
          workCenterId: step.workCenterId,
          sequence: index + 1,
          minutesPerUnit: String(step.minutesPerUnit),
          setupMinutes: step.setupMinutes ?? 0,
          notes: step.notes ?? null,
        } as never),
      )
    })
    await tem.flush()
  })

  try {
    await emitProductionPlanningEvent('production_planning.routing.updated', {
      id: product.id,
      productId: product.id,
      stepCount: parsed.data.steps.length,
      organizationId,
      tenantId,
    })
  } catch {
    // Events never fail a committed write.
  }

  em.clear()
  return NextResponse.json(await buildRoutingView(em, scope, product))
}

const errorSchema = z.object({ error: z.string(), index: z.number().optional(), message: z.string().optional() })
const routingViewSchema = z.object({
  product: z.object({ id: z.string().uuid(), name: z.string(), code: z.string().nullable(), laborMinutes: z.number() }),
  steps: z.array(
    z.object({
      id: z.string().uuid(),
      workCenterId: z.string().uuid(),
      workCenterName: z.string(),
      workCenterMissing: z.boolean(),
      sequence: z.number(),
      minutesPerUnit: z.string(),
      setupMinutes: z.number(),
      notes: z.string().nullable(),
    }),
  ),
})

const getDoc: OpenApiMethodDoc = {
  summary: 'Read a product routing',
  description: 'Steps in order with their work centre, minutes per unit and setup minutes.',
  tags: ['Production planning'],
  responses: [{ status: 200, description: 'The routing', schema: routingViewSchema }],
  errors: [{ status: 404, description: 'No such product in this scope', schema: errorSchema }],
}

const putDoc: OpenApiMethodDoc = {
  summary: 'Replace a product routing',
  description: 'Replaces every step in one transaction. Unknown work centres are refused with 422 `work_center_not_found`.',
  tags: ['Production planning'],
  requestBody: { schema: replaceRoutingSchema },
  responses: [{ status: 200, description: 'The saved routing', schema: routingViewSchema }],
  errors: [
    { status: 404, description: 'No such product in this scope', schema: errorSchema },
    { status: 422, description: 'Invalid step or unknown work centre', schema: errorSchema },
  ],
}

export const openApi: OpenApiRouteDoc = {
  summary: 'Product routing',
  methods: { GET: getDoc, PUT: putDoc },
}
