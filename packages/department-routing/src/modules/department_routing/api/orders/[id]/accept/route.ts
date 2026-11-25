/**
 * `POST /api/department_routing/orders/{id}/accept` — accepts the order for
 * production and splits it into department tasks by each product's routing.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { acceptOrder, buildOrderView } from '../../../../lib/order-service'
import { requireUuidParam, resolveRequestScope } from '../../../../lib/request-scope'
import { emitDepartmentRoutingEvent } from '../../../../events'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['department_routing.edit'] },
}

type RouteContext = { params: { id: string } | Promise<{ id: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const guard = await resolveRequestScope(req)
  if (!guard.ok) return guard.response
  const { em, tenantId, organizationId } = guard.scope
  const idCheck = requireUuidParam((await Promise.resolve(context.params)).id)
  if (!idCheck.ok) return idCheck.response
  const scope = { tenantId, organizationId }
  const result = await acceptOrder(em, scope, idCheck.id)
  if (!result.ok) {
    if (result.error === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 })
    if (result.error === 'already_accepted') return NextResponse.json({ error: 'already_accepted' }, { status: 409 })
    return NextResponse.json(
      {
        error: result.problem.kind,
        productName: result.problem.kind === 'no_routing' ? result.problem.productName : undefined,
      },
      { status: 422 },
    )
  }
  try {
    // ROI: every task here was created by the system, not typed in by hand.
    await emitDepartmentRoutingEvent('department_routing.order.accepted', {
      id: result.order.id,
      orderNumber: result.order.number,
      taskCount: result.taskCount,
      departmentCount: result.departmentCount,
      organizationId,
      tenantId,
    })
  } catch {
    // Events never fail a committed write.
  }
  em.clear()
  return NextResponse.json(await buildOrderView(em, scope, idCheck.id))
}

const errorSchema = z.object({ error: z.string(), productName: z.string().optional() })

export const openApi: OpenApiRouteDoc = {
  summary: 'Accept an order',
  methods: {
    POST: {
      summary: 'Accept an order and split it into department tasks',
      description:
        'Creates one task per order line per department on the product routing, in one transaction, and moves the order to `in_progress`.',
      tags: ['Department Routing'],
      responses: [{ status: 200, description: 'The order view after the split', schema: z.object({}).passthrough() }],
      errors: [
        { status: 404, description: 'No such order in this scope', schema: errorSchema },
        { status: 409, description: 'Order already accepted', schema: errorSchema },
        { status: 422, description: '`no_lines` or `no_routing` (with the product name)', schema: errorSchema },
      ],
    },
  },
}
