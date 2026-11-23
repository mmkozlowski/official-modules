import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

export const MATERIAL_TYPES = ['fabric', 'foam', 'zipper', 'accessory', 'packaging', 'other'] as const
export type MaterialType = (typeof MATERIAL_TYPES)[number]

/**
 * Units a material is bought and consumed in. A BOM line carries no unit of its
 * own — it is always expressed in its material's unit — so "0.6 of a fabric
 * sold by the metre" can never be entered as 0.6 kilograms by mistake.
 */
export const MATERIAL_UNITS = ['m', 'm2', 'pcs', 'kg'] as const
export type MaterialUnit = (typeof MATERIAL_UNITS)[number]

export const PRODUCT_TYPES = ['cushion', 'cover', 'inlet', 'furniture', 'other'] as const
export type ProductType = (typeof PRODUCT_TYPES)[number]

/**
 * Fabric is a material type that never enters a product's BOM — see
 * `Product.fabricConsumption`. It is chosen per order instead.
 */
export const FABRIC_MATERIAL_TYPE: MaterialType = 'fabric'

/**
 * Material — a physical component with a unit and a unit price: fabric, foam,
 * a zipper, a fitting. What a BOM line points at.
 */
@Entity({ tableName: 'production_bom_materials' })
@Index({ name: 'production_bom_materials_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
export class Material {
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

  @Property({ name: 'material_type', type: 'text', default: 'other' })
  materialType: MaterialType = 'other'

  @Property({ type: 'text', default: 'pcs' })
  unit: MaterialUnit = 'pcs'

  /** Net price for one `unit`. Four decimals, because price per gram of thread is a real number. */
  @Property({ name: 'unit_price', type: 'numeric', precision: 14, scale: 4, default: '0' })
  unitPrice: string = '0'

  /**
   * Allowance on top of the norm, in percent (hand-cut fabric: ~10%). The
   * product's cost is calculated from the NORM; only the requirement for N
   * units — what the warehouse issues — adds the allowance. Kept on the
   * material because the waste comes from how the material is cut, not from
   * which product it goes into.
   */
  @Property({ name: 'waste_percent', type: 'numeric', precision: 5, scale: 2, default: '0' })
  wastePercent: string = '0'

  @Property({ name: 'currency_code', type: 'text', default: 'PLN' })
  currencyCode: string = 'PLN'

  @Property({ type: 'text', nullable: true })
  notes?: string | null

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
 * Product — a finished good made in the workshop: a seat cushion, a cover, a
 * garden table. It owns a BOM (see `BomLine`) and a labour time.
 *
 * Labour time is deliberately NOT a BOM line: minutes are not a material, they
 * are not bought, and summing them into the material cost would hide the one
 * number production planning needs separately.
 */
@Entity({ tableName: 'production_bom_products' })
@Index({ name: 'production_bom_products_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
export class Product {
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

  @Property({ name: 'product_type', type: 'text', default: 'other' })
  productType: ProductType = 'other'

  /**
   * Metres of fabric ONE unit consumes. Fabric is NOT a BOM line and NOT part of
   * the product's material cost: the product is defined before anyone knows what
   * it will be sewn from, and the fabric is chosen per order. So the product
   * stores only how much of it is needed; which fabric, and its price, come in
   * when the requirement for an order is calculated.
   */
  @Property({ name: 'fabric_consumption', type: 'numeric', precision: 13, scale: 6, default: '0' })
  fabricConsumption: string = '0'

  /** Minutes of work for ONE unit. Separate from the BOM on purpose — see the class comment. */
  @Property({ name: 'labor_minutes', type: 'integer', default: 0 })
  laborMinutes: number = 0

  @Property({ type: 'text', nullable: true })
  description?: string | null

  /** The product this one was duplicated from, when it started as a copy. */
  @Property({ name: 'source_product_id', type: 'uuid', nullable: true })
  sourceProductId?: string | null

  /**
   * Optional link to a `catalog` product — the sellable counterpart of this
   * manufactured good. A plain id: no ORM relation crosses a module boundary.
   */
  @Property({ name: 'catalog_product_id', type: 'uuid', nullable: true })
  catalogProductId?: string | null

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
 * BomLine — one material and the quantity of it that ONE unit of the product
 * consumes. Quantity has six decimals because thread and glue are entered per
 * unit in kilograms, and three decimals rounds them to zero.
 *
 * `product_id` / `material_id` are plain uuids within this module. Lines are
 * always written through the product's BOM endpoint, which replaces the whole
 * list in one transaction — there is no per-line CRUD to keep in sync.
 */
@Entity({ tableName: 'production_bom_bom_lines' })
@Index({ name: 'production_bom_bom_lines_product_idx', properties: ['productId'] })
@Index({ name: 'production_bom_bom_lines_material_idx', properties: ['materialId'] })
export class BomLine {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'product_id', type: 'uuid' })
  productId!: string

  @Property({ name: 'material_id', type: 'uuid' })
  materialId!: string

  @Property({ type: 'numeric', precision: 13, scale: 6 })
  quantity!: string

  /**
   * Optional split into pieces. The sewing room cuts pieces, not a sum of
   * metres: 4.20 m of zipper is 3 pieces of 1.40 m. When both are set,
   * `quantity` is always `segmentCount × segmentLength` (enforced on write).
   */
  @Property({ name: 'segment_count', type: 'integer', nullable: true })
  segmentCount?: number | null

  @Property({ name: 'segment_length', type: 'numeric', precision: 13, scale: 6, nullable: true })
  segmentLength?: string | null

  @Property({ type: 'smallint', default: 0 })
  position: number = 0

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
