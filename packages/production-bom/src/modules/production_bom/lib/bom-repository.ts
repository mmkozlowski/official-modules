import type { EntityManager } from '@mikro-orm/postgresql'
import { BomLine, Material, Product } from '../data/entities'
import { computeLineCost, computeMaterialCost } from './bom-calculations'

export type Scope = { tenantId: string; organizationId: string }

/** One BOM line joined with its material — what the BOM editor and the calculator render. */
export type BomLineView = {
  id: string
  materialId: string
  materialName: string
  materialCode: string | null
  materialType: string
  unit: string
  unitPrice: string
  wastePercent: string
  currencyCode: string
  materialMissing: boolean
  quantity: string
  segmentCount: number | null
  segmentLength: string | null
  position: number
  notes: string | null
  lineCost: string
}

export type BomView = {
  productId: string
  lines: BomLineView[]
  materialCost: string
  currencyCode: string
}

export async function findProductInScope(em: EntityManager, scope: Scope, productId: string): Promise<Product | null> {
  return em.findOne(Product, {
    id: productId,
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    deletedAt: null,
  })
}

export async function loadBomLines(em: EntityManager, scope: Scope, productIds: string[]): Promise<BomLine[]> {
  if (!productIds.length) return []
  return em.find(
    BomLine,
    { productId: { $in: productIds }, tenantId: scope.tenantId, organizationId: scope.organizationId },
    { orderBy: { productId: 'asc', position: 'asc' } },
  )
}

/**
 * Materials referenced by lines, INCLUDING soft-deleted ones: a BOM that points
 * at a deleted material must still render the line (flagged), not drop it and
 * quietly understate the product's cost.
 */
export async function loadMaterialsById(em: EntityManager, scope: Scope, ids: string[]): Promise<Map<string, Material>> {
  const unique = Array.from(new Set(ids))
  if (!unique.length) return new Map()
  const materials = await em.find(Material, {
    id: { $in: unique },
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
  })
  return new Map(materials.map((material) => [material.id, material]))
}

function toView(line: BomLine, material: Material | undefined): BomLineView {
  const unitPrice = material ? String(material.unitPrice) : '0'
  return {
    id: line.id,
    materialId: line.materialId,
    materialName: material?.name ?? '—',
    materialCode: material?.code ?? null,
    materialType: material?.materialType ?? 'other',
    unit: material?.unit ?? 'pcs',
    unitPrice,
    wastePercent: material ? String(material.wastePercent) : '0',
    currencyCode: material?.currencyCode ?? 'PLN',
    materialMissing: !material || material.deletedAt != null,
    quantity: String(line.quantity),
    segmentCount: line.segmentCount ?? null,
    segmentLength: line.segmentLength != null ? String(line.segmentLength) : null,
    position: line.position,
    notes: line.notes ?? null,
    lineCost: computeLineCost({ quantity: String(line.quantity), unitPrice }),
  }
}

export async function buildBomViews(em: EntityManager, scope: Scope, productIds: string[]): Promise<Map<string, BomView>> {
  const lines = await loadBomLines(em, scope, productIds)
  const materials = await loadMaterialsById(em, scope, lines.map((line) => line.materialId))
  const views = new Map<string, BomView>()
  for (const productId of productIds) {
    views.set(productId, { productId, lines: [], materialCost: '0.00', currencyCode: 'PLN' })
  }
  for (const line of lines) {
    views.get(line.productId)?.lines.push(toView(line, materials.get(line.materialId)))
  }
  for (const view of views.values()) {
    view.materialCost = computeMaterialCost(view.lines)
    view.currencyCode = view.lines[0]?.currencyCode ?? 'PLN'
  }
  return views
}
