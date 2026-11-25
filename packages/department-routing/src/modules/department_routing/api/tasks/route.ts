/**
 * `GET /api/department_routing/tasks?departmentId=…` — a department's board:
 * every open task of accepted orders, plus what the department finished in the
 * last 7 days (the "done" column). Order and product data are copied on the
 * task, so this is one indexed read.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { DepartmentTask, ProductionOrder } from '../../data/entities'
import { toTaskView } from '../../lib/order-service'
import { resolveRequestScope } from '../../lib/request-scope'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['department_routing.view'] },
}

const querySchema = z.object({ departmentId: z.string().uuid() })
const DONE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  const guard = await resolveRequestScope(req)
  if (!guard.ok) return guard.response
  const { em, tenantId, organizationId } = guard.scope
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams.entries()))
  if (!parsed.success) return NextResponse.json({ error: 'departmentId_required' }, { status: 422 })
  const scope = { tenantId, organizationId }
  const since = new Date(Date.now() - DONE_WINDOW_MS)
  const tasks = await em.find(
    DepartmentTask,
    {
      ...scope,
      departmentId: parsed.data.departmentId,
      $or: [{ status: { $ne: 'done' } }, { completedAt: { $gte: since } }],
    },
    { orderBy: { dueDate: 'asc', orderNumber: 'asc', routeStep: 'asc' }, limit: 300 },
  )
  // Tasks of a deleted order never show up on a board.
  const liveOrders = tasks.length
    ? await em.find(
        ProductionOrder,
        { id: { $in: Array.from(new Set(tasks.map((task) => task.orderId))) }, ...scope, deletedAt: null },
        { fields: ['id', 'status', 'departmentsDone', 'departmentsTotal'] },
      )
    : []
  const orderById = new Map(liveOrders.map((order) => [order.id, order]))
  const items = tasks
    .filter((task) => orderById.has(task.orderId))
    .map((task) => {
      const order = orderById.get(task.orderId) as ProductionOrder
      return {
        ...toTaskView(task),
        orderStatus: order.status,
        orderDepartmentsDone: order.departmentsDone,
        orderDepartmentsTotal: order.departmentsTotal,
      }
    })
  return NextResponse.json({ items })
}

export const openApi: OpenApiRouteDoc = {
  summary: 'Department board',
  methods: {
    GET: {
      summary: 'List the tasks of one department',
      tags: ['Department Routing'],
      query: querySchema,
      responses: [{ status: 200, description: 'Open tasks and tasks done in the last 7 days', schema: z.object({ items: z.array(z.object({}).passthrough()) }) }],
    },
  },
}
