import type { MaterialType, MaterialUnit, ProductType } from '../data/entities'
import type { BomView } from '../lib/bom-repository'

/** A row of `GET /api/production_bom/materials` — snake_case, as the query engine returns it. */
export type MaterialRow = {
  id: string
  name: string
  code: string | null
  material_type: MaterialType
  unit: MaterialUnit
  unit_price: string
  waste_percent: string
  currency_code: string
  notes: string | null
  is_active: boolean
  updated_at?: string
}

/** A row of `GET /api/production_bom/products`, including the cost added by `afterList`. */
export type ProductRow = {
  id: string
  name: string
  code: string | null
  product_type: ProductType
  labor_minutes: number
  fabric_consumption: string
  description: string | null
  source_product_id: string | null
  is_active: boolean
  material_cost: string
  bom_line_count: number
  currency_code: string
  updated_at?: string
}

export type ListResponse<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type MaterialUsageItem = {
  productId: string
  productName: string
  productCode: string | null
  productType: ProductType
  quantityPerUnit: string
  piecesPerUnit: number | null
  costPerUnit: string
}

export type MaterialUsageResponse = {
  materialId: string
  unit: MaterialUnit
  currencyCode: string
  items: MaterialUsageItem[]
}

export type { BomView }
export type { BomLineView } from '../lib/bom-repository'
