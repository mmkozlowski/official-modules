import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { makeCrudRoute, type CrudCtx } from '@open-mercato/shared/lib/crud/factory'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import {
  createCrudOpenApiFactory,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from '@open-mercato/shared/lib/openapi/crud'
import { Product } from '@open-mercato/production-bom/modules/production_bom/data/entities'
import { ProductionOrder } from '../../data/entities'
import {
  ORDER_PRIORITIES,
  ORDER_STATUSES,
  createOrderSchema,
  updateOrderSchema,
  type CreateOrderInput,
  type UpdateOrderInput,
} from '../../data/validators'
import { buildPlanView, localIsoDate } from '../../lib/plan-model'
import { loadPlanInput } from '../../lib/plan-repository'
import { nextOrderNumber } from '../../lib/order-number'

const ENTITY_ID = 'production_planning:production_order'

const listSchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().default('due_date'),
    sortDir: z.enum(['asc', 'desc']).default('asc'),
    search: z.string().optional(),
    status: z.enum(ORDER_STATUSES).optional(),
    priority: z.enum(ORDER_PRIORITIES).optional(),
    productId: z.string().uuid().optional(),
  })
  .passthrough()

type ListQuery = z.infer<typeof listSchema>

const listFields = [
  'id',
  'number',
  'product_id',
  'quantity',
  'due_date',
  'priority',
  'status',
  'fabric_material_id',
  'reference',
  'notes',
  'organization_id',
  'tenant_id',
  'created_at',
  'updated_at',
] as const

function mapInput(input: Partial<CreateOrderInput>): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  const assign = (key: string, value: unknown) => {
    if (value !== undefined) data[key] = value
  }
  assign('number', input.number ?? undefined)
  assign('productId', input.productId)
  assign('quantity', input.quantity)
  assign('dueDate', input.dueDate)
  assign('priority', input.priority)
  assign('status', input.status)
  assign('fabricMaterialId', input.fabricMaterialId)
  assign('reference', input.reference)
  assign('notes', input.notes)
  return data
}

function scopeOf(ctx: CrudCtx): { tenantId: string; organizationId: string } | null {
  const tenantId = ctx.auth?.tenantId ?? null
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  return tenantId && organizationId ? { tenantId, organizationId } : null
}

/** An order may only point at a live product of the same organisation. */
async function assertProductInScope(ctx: CrudCtx, productId: string | undefined): Promise<void> {
  if (!productId) return
  const scope = scopeOf(ctx)
  if (!scope) throw new CrudHttpError(403, { error: 'Organization scope required' })
  const em = ctx.container.resolve('em') as EntityManager
  const product = await em.findOne(Product, { id: productId, ...scope, deletedAt: null })
  if (!product) throw new CrudHttpError(422, { error: 'product_not_found' })
}

const crud = makeCrudRoute<CreateOrderInput, UpdateOrderInput, ListQuery>({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['production_planning.view'] },
    POST: { requireAuth: true, requireFeatures: ['production_planning.create'] },
    PUT: { requireAuth: true, requireFeatures: ['production_planning.edit'] },
    DELETE: { requireAuth: true, requireFeatures: ['production_planning.delete'] },
  },
  orm: {
    entity: ProductionOrder,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: ENTITY_ID },
  events: { module: 'production_planning', entity: 'order' },
  list: {
    schema: listSchema,
    entityId: ENTITY_ID,
    fields: [...listFields],
    sortFieldMap: {
      number: 'number',
      quantity: 'quantity',
      due_date: 'due_date',
      dueDate: 'due_date',
      priority: 'priority',
      status: 'status',
      updated_at: 'updated_at',
      updatedAt: 'updated_at',
    },
    buildFilters: (query) => {
      const filters: Record<string, unknown> = {}
      if (query.id) filters.id = { $eq: query.id }
      if (query.status) filters.status = { $eq: query.status }
      if (query.priority) filters.priority = { $eq: query.priority }
      if (query.productId) filters.product_id = { $eq: query.productId }
      if (query.search && query.search.trim()) {
        const pattern = `%${escapeLikePattern(query.search.trim())}%`
        filters.$or = [{ number: { $ilike: pattern } }, { reference: { $ilike: pattern } }]
      }
      return filters
    },
    export: { enabled: true },
  },
  create: {
    schema: createOrderSchema,
    mapToEntity: (input) => mapInput(input),
    response: (entity: ProductionOrder) => ({ id: entity.id, number: entity.number }),
  },
  update: {
    schema: updateOrderSchema,
    applyToEntity: (entity: ProductionOrder, input) => {
      const { id: _id, ...rest } = input
      Object.assign(entity, mapInput(rest))
    },
    response: () => ({ ok: true as const }),
  },
  del: {
    idFrom: 'query',
    softDelete: true,
    response: () => ({ ok: true as const }),
  },
  hooks: {
    beforeCreate: async (input, ctx) => {
      await assertProductInScope(ctx, input.productId)
      if (input.number) return input
      const scope = scopeOf(ctx)
      if (!scope) throw new CrudHttpError(403, { error: 'Organization scope required' })
      const em = ctx.container.resolve('em') as EntityManager
      return { ...input, number: await nextOrderNumber(em, scope, input.dueDate) }
    },
    beforeUpdate: async (input, ctx) => {
      await assertProductInScope(ctx, input.productId)
      return input
    },
    /**
     * Each row carries the product name, the computed start of production and
     * whether the order sits on an overloaded work-centre day — computed from
     * the same plan the plan screen draws, so the list and the plan never disagree.
     */
    afterList: async (payload, ctx) => {
      const items: Array<Record<string, unknown>> = Array.isArray(payload?.items) ? payload.items : []
      if (!items.length) return
      const scope = scopeOf(ctx)
      if (!scope) return
      const em = ctx.container.resolve('em') as EntityManager
      const today = localIsoDate()
      const input = await loadPlanInput(em, scope, { today, days: 40 })
      const view = buildPlanView(input)
      const overloadedOrders = new Set<string>()
      for (const centre of view.load) {
        for (const cell of centre.cells) if (cell.level === 'over') cell.orderIds.forEach((id) => overloadedOrders.add(id))
      }
      const products = new Map(input.products.map((product) => [product.id, product]))
      const missingProducts = items
        .map((item) => String(item.product_id))
        .filter((id) => !products.has(id))
      if (missingProducts.length) {
        const extra = await em.find(Product, { id: { $in: missingProducts }, ...scope })
        for (const product of extra) {
          products.set(product.id, {
            id: product.id,
            name: product.name,
            code: product.code ?? null,
            laborMinutes: product.laborMinutes,
            fabricConsumption: String(product.fabricConsumption),
          })
        }
      }
      for (const item of items) {
        const product = products.get(String(item.product_id))
        const schedule = view.scheduleByOrder[String(item.id)]
        item.due_date = typeof item.due_date === 'string' ? item.due_date.slice(0, 10) : item.due_date
        item.product_name = product?.name ?? null
        item.product_code = product?.code ?? null
        item.planned_start = schedule?.start ?? null
        item.starts_in_past = schedule?.startsInPast ?? false
        item.missing_routing = schedule?.missingRouting ?? false
        item.on_overloaded_day = overloadedOrders.has(String(item.id))
        item.labor_minutes_total = product ? product.laborMinutes * Number(item.quantity ?? 0) : null
      }
    },
  },
})

export const metadata = crud.metadata

export const GET = crud.GET
export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const orderSchema = z.object({
  id: z.string().uuid(),
  number: z.string(),
  product_id: z.string().uuid(),
  product_name: z.string().nullable(),
  product_code: z.string().nullable(),
  quantity: z.number(),
  due_date: z.string(),
  priority: z.enum(ORDER_PRIORITIES),
  status: z.enum(ORDER_STATUSES),
  fabric_material_id: z.string().uuid().nullable(),
  reference: z.string().nullable(),
  notes: z.string().nullable(),
  planned_start: z.string().nullable(),
  starts_in_past: z.boolean(),
  missing_routing: z.boolean(),
  on_overloaded_day: z.boolean(),
  labor_minutes_total: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

const buildOpenApi = createCrudOpenApiFactory({ defaultTag: 'Production planning' })

export const openApi = buildOpenApi({
  resourceName: 'Production order',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(orderSchema),
  create: {
    schema: createOrderSchema,
    description:
      'Creates a production order for a production_bom product. The number (ZP/<year>/<seq>) is assigned when omitted. ' +
      'Operations are not stored — they are derived from the product routing when the plan is read.',
  },
  update: {
    schema: updateOrderSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates an order by id. To move only the due date and get the overload delta back, use POST …/{id}/reschedule.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes an order by id (query parameter `id`).',
  },
})
