/**
 * `POST /api/production_bom/products/{id}/duplicate`
 *
 * Deep copy: a new product plus a fresh copy of every BOM line, with quantities
 * AND the split into pieces, in one transaction. Either both exist afterwards or
 * neither does — a copy without its BOM is the failure this endpoint prevents.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { OpenApiMethodDoc, OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { emitCrudSideEffects } from '@open-mercato/shared/lib/commands/helpers'
import { BomLine, Product } from '../../../../data/entities'
import { duplicateProductSchema } from '../../../../data/validators'
import { planProductDuplicate } from '../../../../lib/bom-calculations'
import { findProductInScope, loadBomLines } from '../../../../lib/bom-repository'
import { requireUuidParam, resolveRequestScope } from '../../../../lib/request-scope'
import { emitProductionBomEvent } from '../../../../events'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['production_bom.create'] },
}

type RouteContext = { params: { id: string } | Promise<{ id: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const guard = await resolveRequestScope(req)
  if (!guard.ok) return guard.response
  const { em, tenantId, organizationId, container } = guard.scope
  const scope = { tenantId, organizationId }
  const idCheck = requireUuidParam((await Promise.resolve(context.params)).id)
  if (!idCheck.ok) return idCheck.response

  let body: unknown = {}
  try {
    body = await req.json()
  } catch {
    // Rejected by safeParse below.
  }
  const parsed = duplicateProductSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_FAILED', message: parsed.error.issues[0]?.message },
      { status: 422 },
    )
  }

  const source = await findProductInScope(em, scope, idCheck.id)
  if (!source) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const sourceLines = await loadBomLines(em, scope, [source.id])

  const plan = planProductDuplicate(
    source.id,
    {
      productType: source.productType,
      laborMinutes: source.laborMinutes,
      fabricConsumption: String(source.fabricConsumption),
      description: source.description ?? null,
      catalogProductId: source.catalogProductId ?? null,
    },
    sourceLines.map((line) => ({
      materialId: line.materialId,
      quantity: String(line.quantity),
      segmentCount: line.segmentCount ?? null,
      segmentLength: line.segmentLength != null ? String(line.segmentLength) : null,
      position: line.position,
      notes: line.notes ?? null,
    })),
    { name: parsed.data.name, code: parsed.data.code ?? null },
  )

  const copy = await em.transactional(async (tem) => {
    const product = tem.create(Product, { ...plan.product, organizationId, tenantId } as never)
    tem.persist(product)
    await tem.flush()
    for (const line of plan.lines) {
      tem.persist(
        tem.create(BomLine, { ...line, productId: product.id, organizationId, tenantId } as never),
      )
    }
    await tem.flush()
    return product
  })

  // The copy is written outside the CRUD factory, so it registers itself with the
  // query index and emits `product.created` the same way a factory create would —
  // otherwise it would exist in the table but be missing from the list.
  try {
    const dataEngine = container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'created',
      entity: copy,
      identifiers: { id: copy.id, organizationId, tenantId },
      events: { module: 'production_bom', entity: 'product' },
      indexer: { entityType: 'production_bom:product' },
    })
    await dataEngine.flushOrmEntityChanges()
  } catch {
    // Indexing is repaired by `query_index` reindex; it must not fail a committed copy.
  }

  try {
    await emitProductionBomEvent('production_bom.product.duplicated', {
      sourceProductId: source.id,
      productId: copy.id,
      lineCount: plan.lines.length,
      organizationId,
      tenantId,
    })
  } catch {
    // Events never fail a committed write.
  }

  return NextResponse.json({ id: copy.id, name: copy.name, lineCount: plan.lines.length }, { status: 201 })
}

const responseSchema = z.object({ id: z.string().uuid(), name: z.string(), lineCount: z.number() })
const errorSchema = z.object({ error: z.string(), message: z.string().optional() })

const postDoc: OpenApiMethodDoc = {
  summary: 'Duplicate a product with its BOM',
  description:
    'Creates an independent copy: product fields, labour time, fabric consumption and every BOM line ' +
    'with its quantity and split into pieces. The code and the catalog link are not copied.',
  tags: ['Production BOM'],
  requestBody: { schema: duplicateProductSchema },
  responses: [{ status: 201, description: 'The new product', schema: responseSchema }],
  errors: [
    { status: 404, description: 'No such product in this scope', schema: errorSchema },
    { status: 422, description: 'Malformed payload', schema: errorSchema },
  ],
}

export const openApi: OpenApiRouteDoc = {
  summary: 'Duplicate product',
  methods: { POST: postDoc },
}
