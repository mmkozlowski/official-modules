import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { makeCrudRoute, type CrudCtx } from '@open-mercato/shared/lib/crud/factory'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { parseBooleanToken } from '@open-mercato/shared/lib/boolean'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import {
  createCrudOpenApiFactory,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from '@open-mercato/shared/lib/openapi/crud'
import { Department, RoutedProduct } from '../../data/entities'
import {
  createProductSchema,
  updateProductSchema,
  type CreateProductInput,
  type UpdateProductInput,
} from '../../data/validators'
import { scopeOfCrudCtx } from '../../lib/crud-scope'

const ENTITY_ID = 'department_routing:routed_product'

const listSchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().default('name'),
    sortDir: z.enum(['asc', 'desc']).default('asc'),
    search: z.string().optional(),
    isActive: z.string().optional(),
  })
  .passthrough()

type ListQuery = z.infer<typeof listSchema>

function mapProductInput(input: Partial<CreateProductInput>): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  const assign = (key: string, value: unknown) => {
    if (value !== undefined) data[key] = value
  }
  assign('name', input.name)
  assign('code', input.code)
  assign('departmentIds', input.departmentIds)
  assign('description', input.description)
  assign('isActive', input.isActive)
  return data
}

/** A routing may only point at live departments of the same organisation. */
async function assertDepartmentsInScope(ids: string[] | undefined, ctx: CrudCtx): Promise<void> {
  if (!ids || !ids.length) return
  const scope = scopeOfCrudCtx(ctx)
  if (!scope) throw new CrudHttpError(403, { error: 'Organization scope required' })
  const em = ctx.container.resolve('em') as EntityManager
  const found = await em.count(Department, { id: { $in: ids }, ...scope, deletedAt: null })
  if (found !== ids.length) throw new CrudHttpError(422, { error: 'department_not_found' })
}

const crud = makeCrudRoute<CreateProductInput, UpdateProductInput, ListQuery>({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['department_routing.view'] },
    POST: { requireAuth: true, requireFeatures: ['department_routing.create'] },
    PUT: { requireAuth: true, requireFeatures: ['department_routing.edit'] },
    DELETE: { requireAuth: true, requireFeatures: ['department_routing.delete'] },
  },
  orm: {
    entity: RoutedProduct,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: ENTITY_ID },
  events: { module: 'department_routing', entity: 'product' },
  list: {
    schema: listSchema,
    entityId: ENTITY_ID,
    fields: ['id', 'name', 'code', 'department_ids', 'description', 'is_active', 'organization_id', 'tenant_id', 'created_at', 'updated_at'],
    sortFieldMap: { name: 'name', code: 'code', createdAt: 'created_at', updated_at: 'updated_at' },
    buildFilters: (query) => {
      const filters: Record<string, unknown> = {}
      if (query.id) filters.id = { $eq: query.id }
      const isActive = parseBooleanToken(query.isActive)
      if (isActive !== null) filters.is_active = { $eq: isActive }
      if (query.search && query.search.trim()) {
        const pattern = `%${escapeLikePattern(query.search.trim())}%`
        filters.$or = [{ name: { $ilike: pattern } }, { code: { $ilike: pattern } }]
      }
      return filters
    },
    export: { enabled: true },
  },
  create: {
    schema: createProductSchema,
    mapToEntity: (input) => mapProductInput(input),
    response: (entity: RoutedProduct) => ({ id: entity.id }),
  },
  update: {
    schema: updateProductSchema,
    applyToEntity: (entity: RoutedProduct, input) => {
      const { id: _id, ...rest } = input
      Object.assign(entity, mapProductInput(rest))
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
      await assertDepartmentsInScope(input.departmentIds, ctx)
    },
    beforeUpdate: async (input, ctx) => {
      await assertDepartmentsInScope(input.departmentIds, ctx)
    },
    /** Routing as names, in routing order — the list shows "Stolarnia → Lakiernia → Pakowanie" without a lookup per row. */
    afterList: async (payload, ctx) => {
      const items: Array<Record<string, unknown>> = Array.isArray(payload?.items) ? payload.items : []
      if (!items.length) return
      const scope = scopeOfCrudCtx(ctx)
      if (!scope) return
      const em = ctx.container.resolve('em') as EntityManager
      const departments = await em.find(Department, { ...scope, deletedAt: null })
      const byId = new Map(departments.map((department) => [department.id, department]))
      for (const item of items) {
        const raw = item.department_ids
        const ids: string[] = Array.isArray(raw) ? raw.map(String) : typeof raw === 'string' ? safeParseIds(raw) : []
        item.department_ids = ids
        item.department_names = ids
          .map((id) => byId.get(id))
          .filter((department): department is Department => !!department)
          .map((department) => department.name)
      }
    },
  },
})

function safeParseIds(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

export const metadata = crud.metadata

export const GET = crud.GET
export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const productSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string().nullable(),
  department_ids: z.array(z.string().uuid()),
  department_names: z.array(z.string()),
  description: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})

const buildOpenApi = createCrudOpenApiFactory({ defaultTag: 'Department Routing' })

export const openApi = buildOpenApi({
  resourceName: 'Routed product',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(productSchema),
  create: {
    schema: createProductSchema,
    description:
      'Creates a product with its routing: `departmentIds` is the ordered list of departments one unit passes through. ' +
      'Accepting an order creates one task per line per department on this list.',
  },
  update: {
    schema: updateProductSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a product or its routing. Orders already accepted keep the tasks they were split into.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a product by id (query parameter `id`).',
  },
})
