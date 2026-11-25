/**
 * `PUT /api/department_routing/orders/{id}/lines` — replaces the order's lines
 * in one transaction. Only while the order is `new`: once it is split, the
 * quantities live on the department tasks.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { replaceOrderLinesSchema } from '../../../../data/validators'
import { buildOrderView, replaceOrderLines } from '../../../../lib/order-service'
import { requireUuidParam, resolveRequestScope } from '../../../../lib/request-scope'

export const metadata = {
  PUT: { requireAuth: true, requireFeatures: ['department_routing.edit'] },
}

type RouteContext = { params: { id: string } | Promise<{ id: string }> }

export async function PUT(req: NextRequest, context: RouteContext) {
  const guard = await resolveRequestScope(req)
  if (!guard.ok) return guard.response
  const { em, tenantId, organizationId } = guard.scope
  const idCheck = requireUuidParam((await Promise.resolve(context.params)).id)
  if (!idCheck.ok) return idCheck.response
  const body: unknown = await req.json().catch(() => ({}))
  const parsed = replaceOrderLinesSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json({ error: 'VALIDATION_FAILED', message: issue?.message, path: issue?.path }, { status: 422 })
  }
  const scope = { tenantId, organizationId }
  const result = await replaceOrderLines(em, scope, idCheck.id, parsed.data.lines)
  if (!result.ok) {
    const status = result.error === 'not_found' ? 404 : result.error === 'order_not_editable' ? 409 : 422
    return NextResponse.json({ error: result.error, index: result.index }, { status })
  }
  em.clear()
  return NextResponse.json(await buildOrderView(em, scope, idCheck.id))
}

const errorSchema = z.object({ error: z.string(), index: z.number().optional() })

export const openApi: OpenApiRouteDoc = {
  summary: 'Order lines',
  methods: {
    PUT: {
      summary: 'Replace the lines of a new order',
      tags: ['Department Routing'],
      requestBody: { schema: replaceOrderLinesSchema },
      responses: [{ status: 200, description: 'The order view after saving', schema: z.object({}).passthrough() }],
      errors: [
        { status: 404, description: 'No such order in this scope', schema: errorSchema },
        { status: 409, description: 'Order already accepted — lines are locked', schema: errorSchema },
        { status: 422, description: 'Invalid line or unknown product', schema: errorSchema },
      ],
    },
  },
}
