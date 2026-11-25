/**
 * `GET /api/department_routing/orders/{id}/progress` — the order screen in one
 * read: header with status and "2/4 departments", lines with the departments
 * each product goes through, and per-department progress with its tasks.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { buildOrderView } from '../../../../lib/order-service'
import { requireUuidParam, resolveRequestScope } from '../../../../lib/request-scope'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['department_routing.view'] },
}

type RouteContext = { params: { id: string } | Promise<{ id: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  const guard = await resolveRequestScope(req)
  if (!guard.ok) return guard.response
  const { em, tenantId, organizationId } = guard.scope
  const idCheck = requireUuidParam((await Promise.resolve(context.params)).id)
  if (!idCheck.ok) return idCheck.response
  const view = await buildOrderView(em, { tenantId, organizationId }, idCheck.id)
  if (!view) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json(view)
}

const orderViewSchema = z.object({
  order: z.object({
    id: z.string().uuid(),
    number: z.string(),
    customerName: z.string(),
    dueDate: z.string().nullable(),
    status: z.string(),
    departmentsDone: z.number(),
    departmentsTotal: z.number(),
  }).passthrough(),
  lines: z.array(z.object({ id: z.string().uuid(), productName: z.string(), quantity: z.number(), departmentNames: z.array(z.string()) }).passthrough()),
  departments: z.array(z.object({ id: z.string().uuid(), name: z.string(), quantityDone: z.number(), quantityRequired: z.number(), status: z.string() }).passthrough()),
})

export const openApi: OpenApiRouteDoc = {
  summary: 'Order progress by department',
  methods: {
    GET: {
      summary: 'Read an order with its department progress',
      tags: ['Department Routing'],
      responses: [{ status: 200, description: 'Order, lines and departments', schema: orderViewSchema }],
      errors: [{ status: 404, description: 'No such order in this scope', schema: z.object({ error: z.string() }) }],
    },
  },
}
