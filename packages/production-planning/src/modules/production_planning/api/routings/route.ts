/**
 * `GET /api/production_planning/routings` — every live `production_bom` product
 * with a summary of its routing: steps, minutes per unit along the routing and
 * the labour time the BOM declares, so a routing that does not add up is visible.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { OpenApiMethodDoc, OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { Product } from '@open-mercato/production-bom/modules/production_bom/data/entities'
import { RoutingStep, WorkCenter } from '../../data/entities'
import { resolveRequestScope } from '../../lib/request-scope'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['production_planning.view'] },
}

export async function GET(req: NextRequest) {
  const guard = await resolveRequestScope(req)
  if (!guard.ok) return guard.response
  const { em, tenantId, organizationId } = guard.scope
  const base = { tenantId, organizationId }
  const [products, steps, centres] = await Promise.all([
    em.find(Product, { ...base, deletedAt: null }, { orderBy: { name: 'asc' } }),
    em.find(RoutingStep, base, { orderBy: { productId: 'asc', sequence: 'asc' } }),
    em.find(WorkCenter, base),
  ])
  const centreNames = new Map(centres.map((centre) => [centre.id, centre.name]))
  const stepsByProduct = new Map<string, RoutingStep[]>()
  for (const step of steps) {
    const list = stepsByProduct.get(step.productId) ?? []
    list.push(step)
    stepsByProduct.set(step.productId, list)
  }
  const items = products.map((product) => {
    const productSteps = stepsByProduct.get(product.id) ?? []
    const routingMinutes = productSteps.reduce((sum, step) => sum + Number(step.minutesPerUnit), 0)
    return {
      id: product.id,
      name: product.name,
      code: product.code ?? null,
      is_active: product.isActive,
      labor_minutes: product.laborMinutes,
      step_count: productSteps.length,
      routing_minutes: Math.round(routingMinutes * 100) / 100,
      route: productSteps.map((step) => centreNames.get(step.workCenterId) ?? '—').join(' → '),
    }
  })
  return NextResponse.json({ items, total: items.length })
}

const itemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string().nullable(),
  is_active: z.boolean(),
  labor_minutes: z.number(),
  step_count: z.number(),
  routing_minutes: z.number(),
  route: z.string(),
})

const getDoc: OpenApiMethodDoc = {
  summary: 'Product routings',
  description: 'Products with their routing summary: step count, minutes per unit along the routing, and the route itself.',
  tags: ['Production planning'],
  responses: [{ status: 200, description: 'Routing summaries', schema: z.object({ items: z.array(itemSchema), total: z.number() }) }],
}

export const openApi: OpenApiRouteDoc = {
  summary: 'Product routings',
  methods: { GET: getDoc },
}
