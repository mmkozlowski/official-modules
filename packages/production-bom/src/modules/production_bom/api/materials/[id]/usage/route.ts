/**
 * `GET /api/production_bom/materials/{id}/usage` — where a material is used:
 * every live product whose BOM contains it, with the quantity per unit.
 *
 * The question asked before changing a price or dropping a supplier: "which
 * products does this touch?"
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { OpenApiMethodDoc, OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { BomLine, Material, Product } from '../../../../data/entities'
import { computeLineCost } from '../../../../lib/bom-calculations'
import { requireUuidParam, resolveRequestScope } from '../../../../lib/request-scope'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['production_bom.view'] },
}

type RouteContext = { params: { id: string } | Promise<{ id: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  const guard = await resolveRequestScope(req)
  if (!guard.ok) return guard.response
  const { em, tenantId, organizationId } = guard.scope
  const idCheck = requireUuidParam((await Promise.resolve(context.params)).id)
  if (!idCheck.ok) return idCheck.response

  const material = await em.findOne(Material, { id: idCheck.id, tenantId, organizationId })
  if (!material) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const lines = await em.find(BomLine, { materialId: material.id, tenantId, organizationId })
  const products = lines.length
    ? await em.find(
        Product,
        { id: { $in: Array.from(new Set(lines.map((line) => line.productId))) }, tenantId, organizationId, deletedAt: null },
        { orderBy: { name: 'asc' } },
      )
    : []

  const quantityByProduct = new Map<string, { quantity: number; pieces: number | null }>()
  for (const line of lines) {
    const entry = quantityByProduct.get(line.productId) ?? { quantity: 0, pieces: null }
    entry.quantity += Number(line.quantity)
    if (line.segmentCount != null) entry.pieces = (entry.pieces ?? 0) + line.segmentCount
    quantityByProduct.set(line.productId, entry)
  }

  const items = products.map((product) => {
    const usage = quantityByProduct.get(product.id) ?? { quantity: 0, pieces: null }
    const quantity = usage.quantity.toFixed(6).replace(/\.?0+$/, '')
    return {
      productId: product.id,
      productName: product.name,
      productCode: product.code ?? null,
      productType: product.productType,
      quantityPerUnit: quantity,
      piecesPerUnit: usage.pieces,
      costPerUnit: computeLineCost({ quantity, unitPrice: String(material.unitPrice) }),
    }
  })

  return NextResponse.json({
    materialId: material.id,
    unit: material.unit,
    currencyCode: material.currencyCode,
    items,
  })
}

const responseSchema = z.object({
  materialId: z.string().uuid(),
  unit: z.string(),
  currencyCode: z.string(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      productName: z.string(),
      productCode: z.string().nullable(),
      productType: z.string(),
      quantityPerUnit: z.string(),
      piecesPerUnit: z.number().nullable(),
      costPerUnit: z.string(),
    }),
  ),
})

const getDoc: OpenApiMethodDoc = {
  summary: 'Where a material is used',
  description: 'Live products whose BOM contains the material, with the quantity and cost per unit.',
  tags: ['Production BOM'],
  responses: [{ status: 200, description: 'Products using the material', schema: responseSchema }],
  errors: [{ status: 404, description: 'No such material in this scope', schema: z.object({ error: z.string() }) }],
}

export const openApi: OpenApiRouteDoc = {
  summary: 'Material usage',
  methods: { GET: getDoc },
}
