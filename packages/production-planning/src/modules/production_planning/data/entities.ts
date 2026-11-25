import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

/** Kinds of work a work centre does. Drives the colour of its row on the plan, nothing else. */
export const WORK_CENTER_STAGES = ['cutting', 'sewing', 'upholstery', 'assembly', 'finishing', 'packing', 'other'] as const
export type WorkCenterStage = (typeof WORK_CENTER_STAGES)[number]

export const ORDER_STATUSES = ['planned', 'in_progress', 'done', 'cancelled'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** Statuses that occupy work centres. Done and cancelled orders leave the plan. */
export const SCHEDULED_ORDER_STATUSES: ReadonlyArray<OrderStatus> = ['planned', 'in_progress']

export const ORDER_PRIORITIES = ['normal', 'urgent'] as const
export type OrderPriority = (typeof ORDER_PRIORITIES)[number]

/**
 * WorkCenter — a place in the workshop that does one kind of work with a fixed
 * amount of minutes per working day: the cutting room, the sewing room, the
 * packing table. Capacity is minutes, not people, because the plan adds up
 * minutes from routings and people would have to be converted anyway.
 */
@Entity({ tableName: 'production_planning_work_centers' })
@Index({ name: 'production_planning_work_centers_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
export class WorkCenter {
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

  @Property({ type: 'text', default: 'other' })
  stage: WorkCenterStage = 'other'

  /** Minutes of work available per working day (people × shift length). */
  @Property({ name: 'daily_capacity_minutes', type: 'integer', default: 480 })
  dailyCapacityMinutes: number = 480

  /** Order on the plan, top to bottom — the order work flows through the workshop. */
  @Property({ type: 'smallint', default: 0 })
  position: number = 0

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
 * RoutingStep — one step of how a product is made: which work centre, in which
 * order, how many minutes per unit. The routing of a product is the ordered list
 * of its steps; it is written as a whole through the routing endpoint.
 *
 * `product_id` points at a `production_bom` product — a plain uuid, no ORM
 * relation across the module boundary.
 */
@Entity({ tableName: 'production_planning_routing_steps' })
@Index({ name: 'production_planning_routing_steps_product_idx', properties: ['productId'] })
@Index({ name: 'production_planning_routing_steps_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
export class RoutingStep {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'product_id', type: 'uuid' })
  productId!: string

  @Property({ name: 'work_center_id', type: 'uuid' })
  workCenterId!: string

  @Property({ type: 'smallint', default: 0 })
  sequence: number = 0

  /** Minutes for ONE unit. Two decimals: 4.5 minutes to cut one cover is a real number. */
  @Property({ name: 'minutes_per_unit', type: 'numeric', precision: 10, scale: 2 })
  minutesPerUnit!: string

  /** Fixed minutes per order on this step (setting up the cutting table), independent of quantity. */
  @Property({ name: 'setup_minutes', type: 'integer', default: 0 })
  setupMinutes: number = 0

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

/**
 * ProductionOrder — make `quantity` of a product by `due_date`. Its operations
 * are NOT stored: they are derived from the product's routing every time the
 * plan is read, so a moved due date or a changed routing is reflected at once
 * and there is no second copy of the schedule to drift.
 */
@Entity({ tableName: 'production_planning_orders' })
@Index({ name: 'production_planning_orders_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'production_planning_orders_due_idx', properties: ['dueDate'] })
export class ProductionOrder {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  /** Human number, e.g. `ZP/2026/014`. Assigned on create when not given. */
  @Property({ type: 'text' })
  number!: string

  /** A `production_bom` product — plain uuid across the module boundary. */
  @Property({ name: 'product_id', type: 'uuid' })
  productId!: string

  @Property({ type: 'integer' })
  quantity!: number

  /** Day the goods must be ready to ship. The last routing step ends on this day. */
  @Property({ name: 'due_date', type: 'date' })
  dueDate!: string

  @Property({ type: 'text', default: 'normal' })
  priority: OrderPriority = 'normal'

  @Property({ type: 'text', default: 'planned' })
  status: OrderStatus = 'planned'

  /**
   * Fabric chosen for this order (a `production_bom` material of type fabric).
   * Fabric is never in the BOM — it is picked per order, so it lives here.
   */
  @Property({ name: 'fabric_material_id', type: 'uuid', nullable: true })
  fabricMaterialId?: string | null

  /** Free-text reference: the sales order or channel this batch is for. */
  @Property({ type: 'text', nullable: true })
  reference?: string | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
