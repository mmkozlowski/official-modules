/**
 * `POST /api/department_routing/tasks/{id}/report` — a department reports done
 * units on a task: `{ add: 3 }` (also partial) or a correction `{ set: 0 }`.
 * The order's status and "N/M departments" are recomputed in the same
 * transaction, and the change is broadcast so open order screens refresh.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { reportTaskSchema } from '../../../../data/validators'
import { reportTask, toTaskView } from '../../../../lib/order-service'
import { requireUuidParam, resolveRequestScope } from '../../../../lib/request-scope'
import { emitDepartmentRoutingEvent } from '../../../../events'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['department_routing.report'] },
}

type RouteContext = { params: { id: string } | Promise<{ id: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const guard = await resolveRequestScope(req)
  if (!guard.ok) return guard.response
  const { em, tenantId, organizationId, actorUserId } = guard.scope
  const idCheck = requireUuidParam((await Promise.resolve(context.params)).id)
  if (!idCheck.ok) return idCheck.response
  const body: unknown = await req.json().catch(() => ({}))
  const parsed = reportTaskSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_FAILED', message: parsed.error.issues[0]?.message }, { status: 422 })
  }
  const result = await reportTask(em, { tenantId, organizationId }, idCheck.id, parsed.data, actorUserId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === 'not_found' ? 404 : 422 })
  }
  const { task, order } = result
  try {
    await emitDepartmentRoutingEvent('department_routing.task.reported', {
      id: task.id,
      orderId: order.id,
      departmentId: task.departmentId,
      quantityDelta: result.delta,
      quantityDone: task.quantityDone,
      quantityRequired: task.quantityRequired,
      orderStatus: order.status,
      departmentsDone: order.departmentsDone,
      departmentsTotal: order.departmentsTotal,
      organizationId,
      tenantId,
    })
    if (order.status === 'ready_to_ship' && result.previousOrderStatus !== 'ready_to_ship') {
      await emitDepartmentRoutingEvent('department_routing.order.ready_to_ship', {
        id: order.id,
        orderNumber: order.number,
        organizationId,
        tenantId,
      })
    }
  } catch {
    // Events never fail a committed write.
  }
  return NextResponse.json({
    task: toTaskView(task),
    order: {
      id: order.id,
      number: order.number,
      status: order.status,
      departmentsDone: order.departmentsDone,
      departmentsTotal: order.departmentsTotal,
    },
  })
}

const errorSchema = z.object({ error: z.string() })

export const openApi: OpenApiRouteDoc = {
  summary: 'Report done quantity',
  methods: {
    POST: {
      summary: 'Report done units on a department task',
      tags: ['Department Routing'],
      requestBody: { schema: reportTaskSchema },
      responses: [{ status: 200, description: 'The task and the recomputed order status', schema: z.object({}).passthrough() }],
      errors: [
        { status: 404, description: 'No such task in this scope', schema: errorSchema },
        { status: 422, description: '`over_required`, `below_zero` or `no_change`', schema: errorSchema },
      ],
    },
  },
}
