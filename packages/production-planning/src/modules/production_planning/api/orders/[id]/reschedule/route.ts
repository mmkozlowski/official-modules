/**
 * `POST /api/production_planning/orders/{id}/reschedule` — moves an order's due
 * date and answers with what the move did to the plan: how many work-centre
 * days were overloaded before and after, over the same window.
 *
 * A separate route rather than a plain PUT, because "move this order" is the
 * planner's core action and its effect on the plan is the answer they need.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { OpenApiMethodDoc, OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { ProductionOrder } from '../../../../data/entities'
import { rescheduleOrderSchema } from '../../../../data/validators'
import { countOverloads, localIsoDate } from '../../../../lib/plan-model'
import { loadPlanInput } from '../../../../lib/plan-repository'
import { requireUuidParam, resolveRequestScope } from '../../../../lib/request-scope'
import { emitProductionPlanningEvent } from '../../../../events'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['production_planning.edit'] },
}

/** Window the overload delta is measured over, in working days from today. */
const DELTA_WINDOW_DAYS = 30

type RouteContext = { params: { id: string } | Promise<{ id: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const guard = await resolveRequestScope(req)
  if (!guard.ok) return guard.response
  const { em, tenantId, organizationId } = guard.scope
  const scope = { tenantId, organizationId }
  const idCheck = requireUuidParam((await Promise.resolve(context.params)).id)
  if (!idCheck.ok) return idCheck.response

  let body: unknown = {}
  try {
    body = await req.json()
  } catch {
    // Malformed JSON — rejected by safeParse below.
  }
  const parsed = rescheduleOrderSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json({ error: 'VALIDATION_FAILED', message: issue?.message, path: issue?.path }, { status: 422 })
  }

  const order = await em.findOne(ProductionOrder, { id: idCheck.id, tenantId, organizationId, deletedAt: null })
  if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const window = { today: localIsoDate(), days: DELTA_WINDOW_DAYS }
  const before = await loadPlanInput(em, scope, window)
  const previousDueDate = before.orders.find((entry) => entry.id === order.id)?.dueDate ?? String(order.dueDate).slice(0, 10)
  const after = {
    ...before,
    orders: before.orders.map((entry) => (entry.id === order.id ? { ...entry, dueDate: parsed.data.dueDate } : entry)),
  }
  const overloadedBefore = countOverloads(before)
  const overloadedAfter = countOverloads(after)

  order.dueDate = parsed.data.dueDate
  await em.flush()

  try {
    await emitProductionPlanningEvent('production_planning.order.rescheduled', {
      id: order.id,
      orderId: order.id,
      fromDate: previousDueDate,
      toDate: parsed.data.dueDate,
      overloadedBefore,
      overloadedAfter,
      organizationId,
      tenantId,
    })
  } catch {
    // Events never fail a committed write.
  }

  return NextResponse.json({
    ok: true,
    id: order.id,
    dueDate: parsed.data.dueDate,
    previousDueDate,
    overloadedBefore,
    overloadedAfter,
  })
}

const responseSchema = z.object({
  ok: z.literal(true),
  id: z.string().uuid(),
  dueDate: z.string(),
  previousDueDate: z.string(),
  overloadedBefore: z.number(),
  overloadedAfter: z.number(),
})

const postDoc: OpenApiMethodDoc = {
  summary: 'Reschedule a production order',
  description:
    'Moves the due date and returns the number of overloaded work-centre days before and after the move, ' +
    `over ${DELTA_WINDOW_DAYS} working days from today.`,
  tags: ['Production planning'],
  requestBody: { schema: rescheduleOrderSchema },
  responses: [{ status: 200, description: 'Moved', schema: responseSchema }],
  errors: [
    { status: 404, description: 'No such order in this scope', schema: z.object({ error: z.string() }) },
    { status: 422, description: 'Invalid date', schema: z.object({ error: z.string() }) },
  ],
}

export const openApi: OpenApiRouteDoc = {
  summary: 'Reschedule order',
  methods: { POST: postDoc },
}
