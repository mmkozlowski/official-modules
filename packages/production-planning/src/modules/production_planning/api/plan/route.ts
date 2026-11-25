/**
 * `GET /api/production_planning/plan?from=YYYY-MM-DD&days=10` — the plan input
 * (work centres, routings, scheduled orders, products with their BOM lines,
 * materials) and the plan computed from it: schedule per order, load per work
 * centre per day, material requirements for the window.
 *
 * The plan page renders from `input` and recomputes locally on every change;
 * `plan` is the same result computed on the server, for API consumers.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { OpenApiMethodDoc, OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { planQuerySchema } from '../../data/validators'
import { buildPlanView, localIsoDate } from '../../lib/plan-model'
import { loadPlanInput } from '../../lib/plan-repository'
import { resolveRequestScope } from '../../lib/request-scope'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['production_planning.view'] },
}

export async function GET(req: NextRequest) {
  const guard = await resolveRequestScope(req)
  if (!guard.ok) return guard.response
  const { em, tenantId, organizationId } = guard.scope
  const url = new URL(req.url)
  const parsed = planQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json({ error: 'VALIDATION_FAILED', message: issue?.message, path: issue?.path }, { status: 422 })
  }
  const input = await loadPlanInput(em, { tenantId, organizationId }, {
    today: localIsoDate(),
    from: parsed.data.from,
    days: parsed.data.days,
  })
  const view = buildPlanView(input)
  return NextResponse.json({
    input,
    plan: { days: view.days, orders: view.orders, load: view.load, overloadedCells: view.overloadedCells, requirements: view.requirements },
  })
}

const getDoc: OpenApiMethodDoc = {
  summary: 'Production plan',
  description:
    'Backward-scheduled plan for a window of working days: each order ends its last routing step on its due date; ' +
    'work-centre load per day (minutes, percent of capacity, level free/ok/high/over); material requirements from the BOM.',
  tags: ['Production planning'],
  query: planQuerySchema,
  responses: [{ status: 200, description: 'Plan input and computed plan', schema: z.object({ input: z.any(), plan: z.any() }) }],
}

export const openApi: OpenApiRouteDoc = {
  summary: 'Production plan',
  methods: { GET: getDoc },
}
