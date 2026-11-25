import type { VersionStatus } from '../data/entities'
import type { PricingModel, QuantityDiscount } from '../lib/pricing'
import type { OfferView, VersionView, LineView } from '../lib/offer-repository'

export type ListResponse<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/** A row of `GET /api/complex_offers/offers` — snake_case, as the query engine returns it. */
export type OfferRow = {
  id: string
  number: string
  title: string
  customer_name: string
  contact_person: string | null
  valid_until: string | null
  current_version_number: number
  status: VersionStatus
  total_net: string
  currency_code: string
  created_at?: string
  updated_at?: string
}

/** A row of `GET /api/complex_offers/models`, including the counts added by `afterList`. */
export type ModelRow = {
  id: string
  name: string
  code: string | null
  description: string | null
  base_price: string
  margin_percent: string
  bom_product_code: string | null
  bom_material_cost: string
  bom_cost_refreshed_at: string | null
  fabric_consumption: string
  quantity_discounts: QuantityDiscount[] | null
  currency_code: string
  is_active: boolean
  option_count: number
  option_counts: { size: number; fabric: number; color: number; addon: number }
  updated_at?: string
}

export type RulesResponse = { modelId: string; modelName: string; pricing: PricingModel }

export type { OfferView, VersionView, LineView }
