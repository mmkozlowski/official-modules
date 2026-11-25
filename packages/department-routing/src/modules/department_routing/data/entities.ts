import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

/**
 * Order lifecycle. `new` — taken from the customer, lines still editable;
 * `in_progress` — accepted and split into department tasks; `ready_to_ship` —
 * every department finished every task. The two later states are never set by
 * hand: they are recomputed from the tasks on every progress report.
 */
export const ORDER_STATUSES = ['new', 'in_progress', 'ready_to_ship'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** A task is `pending` until the first unit is reported, `done` when the done quantity reaches the required one. */
export const TASK_STATUSES = ['pending', 'in_progress', 'done'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

/**
 * Department — a part of the workshop that does one kind of work: joinery,
 * paint shop, upholstery, packing. `position` is the usual order of work and is
 * what the order screen sorts departments by; it does not block anyone.
 */
@Entity({ tableName: 'department_routing_departments' })
@Index({ name: 'department_routing_departments_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
export class Department {
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

  @Property({ type: 'smallint', default: 0 })
  position: number = 0

  @Property({ type: 'text', nullable: true })
  description?: string | null

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
 * Product as production sees it: what is made and WHICH DEPARTMENTS make it.
 * `departmentIds` is the routing — the ordered list of departments one unit
 * passes through. Accepting an order turns every line into one task per
 * department on this list, so changing the routing changes future orders only.
 */
@Entity({ tableName: 'department_routing_products' })
@Index({ name: 'department_routing_products_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
export class RoutedProduct {
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

  @Property({ name: 'department_ids', type: 'json', default: '[]' })
  departmentIds: string[] = []

  @Property({ type: 'text', nullable: true })
  description?: string | null

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
 * ProductionOrder — a customer order made to order. Holds the denormalised
 * progress (`departmentsDone` / `departmentsTotal`) so the list can filter and
 * sort by it without reading every task; both are rewritten in the same
 * transaction as the task they derive from.
 */
@Entity({ tableName: 'department_routing_orders' })
@Index({ name: 'department_routing_orders_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
export class ProductionOrder {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ type: 'text' })
  number!: string

  @Property({ name: 'customer_name', type: 'text' })
  customerName!: string

  @Property({ name: 'due_date', type: 'date', nullable: true })
  dueDate?: string | null

  @Property({ type: 'text', default: 'new' })
  status: OrderStatus = 'new'

  @Property({ name: 'departments_done', type: 'smallint', default: 0 })
  departmentsDone: number = 0

  @Property({ name: 'departments_total', type: 'smallint', default: 0 })
  departmentsTotal: number = 0

  @Property({ name: 'accepted_at', type: Date, nullable: true })
  acceptedAt?: Date | null

  @Property({ name: 'ready_at', type: Date, nullable: true })
  readyAt?: Date | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

/** OrderLine — a product and how many units of it the customer ordered. Written as a whole list, like a BOM. */
@Entity({ tableName: 'department_routing_order_lines' })
@Index({ name: 'department_routing_order_lines_order_idx', properties: ['orderId'] })
export class OrderLine {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'order_id', type: 'uuid' })
  orderId!: string

  @Property({ name: 'product_id', type: 'uuid' })
  productId!: string

  /** Product name at the time of ordering — the order keeps reading right after a rename. */
  @Property({ name: 'product_name', type: 'text' })
  productName!: string

  @Property({ type: 'integer' })
  quantity!: number

  @Property({ type: 'smallint', default: 0 })
  position: number = 0

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

/**
 * DepartmentTask — one order line in one department: "joinery, garden bench,
 * 4 pcs". Created when the order is accepted. `quantityDone` grows with every
 * report and may stop anywhere between 0 and `quantityRequired` — partial work
 * is the normal state of a task, not an exception.
 *
 * Order and product data are copied in so a department board reads one table.
 */
@Entity({ tableName: 'department_routing_tasks' })
@Index({ name: 'department_routing_tasks_order_idx', properties: ['orderId'] })
@Index({ name: 'department_routing_tasks_department_idx', properties: ['departmentId', 'status'] })
export class DepartmentTask {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'order_id', type: 'uuid' })
  orderId!: string

  @Property({ name: 'order_line_id', type: 'uuid' })
  orderLineId!: string

  @Property({ name: 'department_id', type: 'uuid' })
  departmentId!: string

  @Property({ name: 'order_number', type: 'text' })
  orderNumber!: string

  @Property({ name: 'customer_name', type: 'text' })
  customerName!: string

  @Property({ name: 'product_name', type: 'text' })
  productName!: string

  @Property({ name: 'due_date', type: 'date', nullable: true })
  dueDate?: string | null

  @Property({ name: 'quantity_required', type: 'integer' })
  quantityRequired!: number

  @Property({ name: 'quantity_done', type: 'integer', default: 0 })
  quantityDone: number = 0

  @Property({ type: 'text', default: 'pending' })
  status: TaskStatus = 'pending'

  /** Position of the department on the product's routing — 0 is the first step. */
  @Property({ name: 'route_step', type: 'smallint', default: 0 })
  routeStep: number = 0

  @Property({ name: 'started_at', type: Date, nullable: true })
  startedAt?: Date | null

  @Property({ name: 'completed_at', type: Date, nullable: true })
  completedAt?: Date | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

/**
 * TaskReport — one report from a department: "+3 pcs" (or a correction, which
 * is negative). The task stores the running total; this is the history behind
 * it — who reported how much and when.
 */
@Entity({ tableName: 'department_routing_task_reports' })
@Index({ name: 'department_routing_task_reports_task_idx', properties: ['taskId'] })
export class TaskReport {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'task_id', type: 'uuid' })
  taskId!: string

  @Property({ name: 'order_id', type: 'uuid' })
  orderId!: string

  @Property({ name: 'department_id', type: 'uuid' })
  departmentId!: string

  @Property({ name: 'quantity_delta', type: 'integer' })
  quantityDelta!: number

  @Property({ name: 'reported_by', type: 'uuid', nullable: true })
  reportedBy?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()
}
