import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'
import type { BreakdownStep, LineSelection, ParameterKind, QuantityDiscount, SelectedParameter } from '../lib/pricing'

/**
 * Version status. Only `draft` is editable. `sent` is frozen on purpose: what
 * the customer received must stay exactly what it was, so a change after
 * sending is a NEW version, never an edit of the old one.
 */
export const VERSION_STATUSES = ['draft', 'sent', 'accepted', 'rejected'] as const
export type VersionStatus = (typeof VERSION_STATUSES)[number]

/**
 * PricedModel — a configurable product the company quotes: a cushion made to
 * size, a table in a chosen size and colour. Holds the pricing rules: a base
 * price, the margin, quantity discount tiers, and (in `PricedModelOption`) the
 * parameters with their surcharges.
 *
 * The material cost is a SNAPSHOT copied from the production BOM (by product
 * code), not a live join: modules never share tables, and a quote must not
 * change because someone edited a BOM in another screen. Refreshing it is an
 * explicit action on the model screen.
 */
@Entity({ tableName: 'complex_offers_models' })
@Index({ name: 'complex_offers_models_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
export class PricedModel {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ type: 'text' })
  name!: string

  @Property({ type: 'text', nullable: true })
  code?: string | null

  @Property({ type: 'text', nullable: true })
  description?: string | null

  /** Labour and overhead for one unit of the base size, before margin. */
  @Property({ name: 'base_price', type: 'numeric', precision: 14, scale: 2, default: '0' })
  basePrice: string = '0'

  @Property({ name: 'margin_percent', type: 'numeric', precision: 5, scale: 2, default: '0' })
  marginPercent: string = '0'

  /** Code of the production BOM product the material cost is copied from. */
  @Property({ name: 'bom_product_code', type: 'text', nullable: true })
  bomProductCode?: string | null

  /** Material cost of one unit of the base size, copied from the BOM. */
  @Property({ name: 'bom_material_cost', type: 'numeric', precision: 14, scale: 2, default: '0' })
  bomMaterialCost: string = '0'

  @Property({ name: 'bom_cost_refreshed_at', type: Date, nullable: true })
  bomCostRefreshedAt?: Date | null

  /** Metres of fabric one unit of the base size uses. 0 for a model without fabric. */
  @Property({ name: 'fabric_consumption', type: 'numeric', precision: 10, scale: 3, default: '0' })
  fabricConsumption: string = '0'

  @Property({ name: 'quantity_discounts', type: 'json', nullable: true })
  quantityDiscounts?: QuantityDiscount[] | null

  @Property({ name: 'currency_code', type: 'text', default: 'PLN' })
  currencyCode: string = 'PLN'

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

/**
 * One value of one parameter of a model: "size 150×60", "fabric: grey outdoor",
 * "add-on: ties". Written as a whole list through the model's rules endpoint.
 */
@Entity({ tableName: 'complex_offers_model_options' })
@Index({ name: 'complex_offers_model_options_model_idx', properties: ['modelId'] })
export class PricedModelOption {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'model_id', type: 'uuid' })
  modelId!: string

  @Property({ type: 'text' })
  kind!: ParameterKind

  @Property({ type: 'text' })
  label!: string

  @Property({ type: 'numeric', precision: 14, scale: 2, default: '0' })
  surcharge: string = '0'

  @Property({ name: 'size_factor', type: 'numeric', precision: 6, scale: 3, default: '1' })
  sizeFactor: string = '1'

  @Property({ name: 'fabric_price_per_meter', type: 'numeric', precision: 14, scale: 2, default: '0' })
  fabricPricePerMeter: string = '0'

  @Property({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean = false

  @Property({ type: 'smallint', default: 0 })
  position: number = 0

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

/**
 * Offer — one deal with one customer. Its content lives in versions; the
 * offer row carries the CURRENT (highest) version's number, status and value,
 * so the list can filter and sort on them without a join.
 */
@Entity({ tableName: 'complex_offers_offers' })
@Index({ name: 'complex_offers_offers_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
export class Offer {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  /** Human number, e.g. `OF/2026/0007`. Assigned on create, never reused. */
  @Property({ type: 'text' })
  number!: string

  @Property({ type: 'text' })
  title!: string

  @Property({ name: 'customer_name', type: 'text' })
  customerName!: string

  @Property({ name: 'contact_person', type: 'text', nullable: true })
  contactPerson?: string | null

  /** Optional link to a `customers` company — a plain id, no ORM relation across modules. */
  @Property({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId?: string | null

  @Property({ name: 'valid_until', type: Date, nullable: true })
  validUntil?: Date | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @Property({ name: 'current_version_number', type: 'integer', default: 1 })
  currentVersionNumber: number = 1

  @Property({ type: 'text', default: 'draft' })
  status: VersionStatus = 'draft'

  @Property({ name: 'total_net', type: 'numeric', precision: 14, scale: 2, default: '0' })
  totalNet: string = '0'

  @Property({ name: 'currency_code', type: 'text', default: 'PLN' })
  currencyCode: string = 'PLN'

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'complex_offers_versions' })
@Index({ name: 'complex_offers_versions_offer_idx', properties: ['offerId'] })
export class OfferVersion {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'offer_id', type: 'uuid' })
  offerId!: string

  @Property({ name: 'version_number', type: 'integer' })
  versionNumber!: number

  @Property({ type: 'text', default: 'draft' })
  status: VersionStatus = 'draft'

  /** The version this one was copied from (`v1` for `v2`), when it started as a copy. */
  @Property({ name: 'source_version_id', type: 'uuid', nullable: true })
  sourceVersionId?: string | null

  @Property({ name: 'total_net', type: 'numeric', precision: 14, scale: 2, default: '0' })
  totalNet: string = '0'

  @Property({ name: 'vat_amount', type: 'numeric', precision: 14, scale: 2, default: '0' })
  vatAmount: string = '0'

  @Property({ name: 'total_gross', type: 'numeric', precision: 14, scale: 2, default: '0' })
  totalGross: string = '0'

  @Property({ name: 'sent_at', type: Date, nullable: true })
  sentAt?: Date | null

  @Property({ name: 'decided_at', type: Date, nullable: true })
  decidedAt?: Date | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

/**
 * OfferLine — a model, its picked parameters and a quantity, with the priced
 * result. `breakdown`, `selected` and the prices are a SNAPSHOT taken when the
 * line was last priced: a sent version keeps showing (and printing) exactly
 * what the customer got, even after the model's price list changes.
 */
@Entity({ tableName: 'complex_offers_lines' })
@Index({ name: 'complex_offers_lines_version_idx', properties: ['versionId'] })
export class OfferLine {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'offer_id', type: 'uuid' })
  offerId!: string

  @Property({ name: 'version_id', type: 'uuid' })
  versionId!: string

  @Property({ name: 'model_id', type: 'uuid' })
  modelId!: string

  @Property({ name: 'model_name', type: 'text' })
  modelName!: string

  @Property({ type: 'integer', default: 1 })
  quantity: number = 1

  @Property({ type: 'json' })
  selection!: LineSelection

  @Property({ type: 'json' })
  selected!: SelectedParameter[]

  @Property({ type: 'json' })
  breakdown!: BreakdownStep[]

  @Property({ name: 'list_unit_price', type: 'numeric', precision: 14, scale: 2, default: '0' })
  listUnitPrice: string = '0'

  @Property({ name: 'discount_percent', type: 'numeric', precision: 5, scale: 2, default: '0' })
  discountPercent: string = '0'

  @Property({ name: 'unit_price', type: 'numeric', precision: 14, scale: 2, default: '0' })
  unitPrice: string = '0'

  @Property({ name: 'line_total', type: 'numeric', precision: 14, scale: 2, default: '0' })
  lineTotal: string = '0'

  @Property({ type: 'smallint', default: 0 })
  position: number = 0

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
