import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import {
  createCrudOpenApiFactory,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from '@open-mercato/shared/lib/openapi/crud'
import { OrderLine, ProductionOrder } from '../../data/entities'
import {
  ORDER_STATUSES,
  createOrderSchema,
  updateOrderSchema,
  type CreateOrderInput,
  type UpdateOrderInput,
} from '../../data/validators'
import { scopeOfCrudCtx } from '../../lib/crud-scope'
import { nextOrderNumber } from '../../lib/order-service'

const ENTITY_ID = 'department_routing:production_order'

const listSchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().default('number'),
    sortDir: z.enum(['asc', 'desc']).default('desc'),
    search: z.string().optional(),
    status: z.enum(ORDER_STATUSES).optional(),
  })
  .passthrough()

type ListQuery = z.infer<typeof listSchema>

function mapOrderInput(input: Partial<CreateOrderInput>): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  const assign = (key: string, value: unknown) => {
    if (value !== undefined) data[key] = value
  }
  assign('number', input.number)
  assign('customerName', input.customerName)
  assign('dueDate', input.dueDate)
  assign('notes', input.notes)
  return data
}

const crud = makeCrudRoute<CreateOrderInput, UpdateOrderInput, ListQuery>({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['department_routing.view'] },
    POST: { requireAuth: true, requireFeatures: ['department_routing.create'] },
    PUT: { requireAuth: true, requireFeatures: ['department_routing.edit'] },
    DELETE: { requireAuth: true, requireFeatures: ['department_routing.delete'] },
  },
  orm: {
    entity: ProductionOrder,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: ENTITY_ID },
  events: { module: 'department_routing', entity: 'order' },
  list: {
    schema: listSchema,
    entityId: ENTITY_ID,
    fields: [
      'id',
      'number',
      'customer_name',
      'due_date',
      'status',
      'departments_done',
      'departments_total',
      'accepted_at',
      'ready_at',
      'notes',
      'organization_id',
      'tenant_id',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: {
      number: 'number',
      customer_name: 'customer_name',
      due_date: 'due_date',
      status: 'status',
      departments_done: 'departments_done',
      createdAt: 'created_at',
      updated_at: 'updated_at',
    },
    buildFilters: (query) => {
      const filters: Record<string, unknown> = {}
      if (query.id) filters.id = { $eq: query.id }
      if (query.status) filters.status = { $eq: query.status }
      if (query.search && query.search.trim()) {
        const pattern = `%${escapeLikePattern(query.search.trim())}%`
        filters.$or = [{ number: { $ilike: pattern } }, { customer_name: { $ilike: pattern } }]
      }
      return filters
    },
    export: { enabled: true },
  },
  create: {
    schema: createOrderSchema,
    mapToEntity: (input) => ({ ...mapOrderInput(input), status: 'new' }),
    response: (entity: ProductionOrder) => ({ id: entity.id, number: entity.number }),
  },
  update: {
    schema: updateOrderSchema,
    applyToEntity: (entity: ProductionOrder, input) => {
      const { id: _id, ...rest } = input
      Object.assign(entity, mapOrderInput(rest))
    },
    response: () => ({ ok: true as const }),
  },
  del: {
    idFrom: 'query',
    softDelete: true,
    response: () => ({ ok: true as const }),
  },
  hooks: {
    /** An order without a number gets the next `ZAM/<year>/<NNNN>`. */
    beforeCreate: async (input, ctx) => {
      if (input.number) return input
      const scope = scopeOfCrudCtx(ctx)
      if (!scope) throw new CrudHttpError(403, { error: 'Organization scope required' })
      const em = ctx.container.resolve('em') as EntityManager
      return { ...input, number: await nextOrderNumber(em, scope) }
    },
    /** What was ordered, in one line per row: "4× Ławka…, 2× Stół…" and the unit total. */
    afterList: async (payload, ctx) => {
      const items: Array<Record<string, unknown>> = Array.isArray(payload?.items) ? payload.items : []
      if (!items.length) return
      const scope = scopeOfCrudCtx(ctx)
      if (!scope) return
      const em = ctx.container.resolve('em') as EntityManager
      const lines = await em.find(
        OrderLine,
        { ...scope, orderId: { $in: items.map((item) => String(item.id)) } },
        { orderBy: { position: 'asc' } },
      )
      for (const item of items) {
        const mine = lines.filter((line) => line.orderId === String(item.id))
        item.lines_summary = mine.map((line) => `${line.quantity}× ${line.productName}`).join(', ')
        item.units_total = mine.reduce((sum, line) => sum + line.quantity, 0)
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
  customer_name: z.string(),
  due_date: z.string().nullable(),
  status: z.enum(ORDER_STATUSES),
  departments_done: z.number(),
  departments_total: z.number(),
  accepted_at: z.string().nullable(),
  ready_at: z.string().nullable(),
  notes: z.string().nullable(),
  lines_summary: z.string(),
  units_total: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
})

const buildOpenApi = createCrudOpenApiFactory({ defaultTag: 'Department Routing' })

export const openApi = buildOpenApi({
  resourceName: 'Production order',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(orderSchema),
  create: {
    schema: createOrderSchema,
    description:
      'Creates a make-to-order order in status `new`. Lines are written with PUT /orders/{id}/lines; ' +
      'POST /orders/{id}/accept splits the order into department tasks.',
  },
  update: {
    schema: updateOrderSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates the order header. Status and progress are recomputed from tasks and cannot be written.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes an order by id (query parameter `id`).',
  },
})
