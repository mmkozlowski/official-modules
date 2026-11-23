/**
 * `GET /api/production_bom/products/{id}/bom` — the product's BOM joined with
 * material names, units and prices, plus the material cost of one unit.
 *
 * `PUT /api/production_bom/products/{id}/bom` — replaces the whole BOM in one
 * transaction. The editor always sends the full list, so there is no per-line
 * CRUD whose partial failures could leave a half-saved recipe.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { OpenApiMethodDoc, OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { BomLine, FABRIC_MATERIAL_TYPE } from '../../../../data/entities'
import { replaceBomSchema } from '../../../../data/validators'
import { quantityFromSegments } from '../../../../lib/bom-calculations'
import { buildBomViews, findProductInScope, loadMaterialsById } from '../../../../lib/bom-repository'
import { requireUuidParam, resolveRequestScope } from '../../../../lib/request-scope'
import { emitProductionBomEvent } from '../../../../events'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['production_bom.view'] },
  PUT: { requireAuth: true, requireFeatures: ['production_bom.edit'] },
}

type RouteContext = { params: { id: string } | Promise<{ id: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  const guard = await resolveRequestScope(req)
  if (!guard.ok) return guard.response
  const { em, tenantId, organizationId } = guard.scope
  const idCheck = requireUuidParam((await Promise.resolve(context.params)).id)
  if (!idCheck.ok) return idCheck.response

  const product = await findProductInScope(em, { tenantId, organizationId }, idCheck.id)
  if (!product) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const views = await buildBomViews(em, { tenantId, organizationId }, [product.id])
  return NextResponse.json(views.get(product.id))
}

export async function PUT(req: NextRequest, context: RouteContext) {
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
    // Malformed JSON — rejected by safeParse below with the usual shape.
  }
  const parsed = replaceBomSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json(
      { error: 'VALIDATION_FAILED', message: issue?.message, path: issue?.path },
      { status: 422 },
    )
  }

  const product = await findProductInScope(em, scope, idCheck.id)
  if (!product) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // A line may only reference a live material of THIS organisation. 404-style
  // wording rather than 403, because confirming an id exists elsewhere is
  // itself an answer the caller is not entitled to.
  const materials = await loadMaterialsById(em, scope, parsed.data.lines.map((line) => line.materialId))
  for (const [index, line] of parsed.data.lines.entries()) {
    const material = materials.get(line.materialId)
    if (!material || material.deletedAt) {
      return NextResponse.json({ error: 'material_not_found', index }, { status: 422 })
    }
    // Fabric is chosen per order and priced through, never part of the product's
    // recipe or cost — see `Product.fabricConsumption`.
    if (material.materialType === FABRIC_MATERIAL_TYPE) {
      return NextResponse.json({ error: 'fabric_not_in_bom', index }, { status: 422 })
    }
  }

  await em.transactional(async (tem) => {
    await tem.nativeDelete(BomLine, { productId: product.id, tenantId, organizationId })
    parsed.data.lines.forEach((line, position) => {
      const isSplit = line.segmentCount != null && line.segmentLength != null
      const quantity = isSplit
        ? quantityFromSegments(line.segmentCount as number, line.segmentLength as number)
        : String(line.quantity)
      tem.persist(
        tem.create(BomLine, {
          organizationId,
          tenantId,
          productId: product.id,
          materialId: line.materialId,
          quantity,
          segmentCount: isSplit ? line.segmentCount : null,
          segmentLength: isSplit ? String(line.segmentLength) : null,
          position,
          notes: line.notes ?? null,
        } as never),
      )
    })
    await tem.flush()
  })

  try {
    await emitProductionBomEvent('production_bom.product.bom_updated', {
      productId: product.id,
      lineCount: parsed.data.lines.length,
      organizationId,
      tenantId,
    })
  } catch {
    // Events never fail a committed write.
  }

  em.clear()
  const views = await buildBomViews(em, scope, [product.id])
  return NextResponse.json(views.get(product.id))
}

const errorSchema = z.object({ error: z.string(), index: z.number().optional(), message: z.string().optional() })

const bomLineViewSchema = z.object({
  id: z.string().uuid(),
  materialId: z.string().uuid(),
  materialName: z.string(),
  materialCode: z.string().nullable(),
  materialType: z.string(),
  unit: z.string(),
  unitPrice: z.string(),
  wastePercent: z.string(),
  currencyCode: z.string(),
  materialMissing: z.boolean(),
  quantity: z.string(),
  segmentCount: z.number().nullable(),
  segmentLength: z.string().nullable(),
  position: z.number(),
  notes: z.string().nullable(),
  lineCost: z.string(),
})

const bomViewSchema = z.object({
  productId: z.string().uuid(),
  lines: z.array(bomLineViewSchema),
  materialCost: z.string(),
  currencyCode: z.string(),
})

const getDoc: OpenApiMethodDoc = {
  summary: 'Read a product BOM',
  description: 'Lines with material, unit and price, each line costed, and the material cost of one unit.',
  tags: ['Production BOM'],
  responses: [{ status: 200, description: 'The BOM', schema: bomViewSchema }],
  errors: [{ status: 404, description: 'No such product in this scope', schema: errorSchema }],
}

const putDoc: OpenApiMethodDoc = {
  summary: 'Replace a product BOM',
  description:
    'Replaces every line in one transaction. A split line (segmentCount × segmentLength) has its quantity ' +
    'derived on the server. Fabric materials are refused with 422 `fabric_not_in_bom`.',
  tags: ['Production BOM'],
  requestBody: { schema: replaceBomSchema },
  responses: [{ status: 200, description: 'The saved BOM', schema: bomViewSchema }],
  errors: [
    { status: 404, description: 'No such product in this scope', schema: errorSchema },
    { status: 422, description: 'Invalid line, unknown material or fabric in the BOM', schema: errorSchema },
  ],
}

export const openApi: OpenApiRouteDoc = {
  summary: 'Product BOM',
  methods: { GET: getDoc, PUT: putDoc },
}
