import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { parseBooleanToken } from '@open-mercato/shared/lib/boolean'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import {
  createCrudOpenApiFactory,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from '@open-mercato/shared/lib/openapi/crud'
import { Department, DepartmentTask } from '../../data/entities'
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  type CreateDepartmentInput,
  type UpdateDepartmentInput,
} from '../../data/validators'
import { scopeOfCrudCtx } from '../../lib/crud-scope'

const ENTITY_ID = 'department_routing:department'

const listSchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().default('position'),
    sortDir: z.enum(['asc', 'desc']).default('asc'),
    search: z.string().optional(),
    isActive: z.string().optional(),
  })
  .passthrough()

type ListQuery = z.infer<typeof listSchema>

function mapDepartmentInput(input: Partial<CreateDepartmentInput>): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  const assign = (key: string, value: unknown) => {
    if (value !== undefined) data[key] = value
  }
  assign('name', input.name)
  assign('code', input.code)
  assign('position', input.position)
  assign('description', input.description)
  assign('isActive', input.isActive)
  return data
}

const crud = makeCrudRoute<CreateDepartmentInput, UpdateDepartmentInput, ListQuery>({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['department_routing.view'] },
    POST: { requireAuth: true, requireFeatures: ['department_routing.create'] },
    PUT: { requireAuth: true, requireFeatures: ['department_routing.edit'] },
    DELETE: { requireAuth: true, requireFeatures: ['department_routing.delete'] },
  },
  orm: {
    entity: Department,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: ENTITY_ID },
  events: { module: 'department_routing', entity: 'department' },
  list: {
    schema: listSchema,
    entityId: ENTITY_ID,
    fields: ['id', 'name', 'code', 'position', 'description', 'is_active', 'organization_id', 'tenant_id', 'created_at', 'updated_at'],
    sortFieldMap: {
      name: 'name',
      code: 'code',
      position: 'position',
      createdAt: 'created_at',
      updated_at: 'updated_at',
    },
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
    schema: createDepartmentSchema,
    mapToEntity: (input) => mapDepartmentInput(input),
    response: (entity: Department) => ({ id: entity.id }),
  },
  update: {
    schema: updateDepartmentSchema,
    applyToEntity: (entity: Department, input) => {
      const { id: _id, ...rest } = input
      Object.assign(entity, mapDepartmentInput(rest))
    },
    response: () => ({ ok: true as const }),
  },
  del: {
    idFrom: 'query',
    softDelete: true,
    response: () => ({ ok: true as const }),
  },
  hooks: {
    /** Open work per department — how many tasks wait or are under way right now. */
    afterList: async (payload, ctx) => {
      const items: Array<Record<string, unknown>> = Array.isArray(payload?.items) ? payload.items : []
      if (!items.length) return
      const scope = scopeOfCrudCtx(ctx)
      if (!scope) return
      const em = ctx.container.resolve('em') as EntityManager
      const open = await em.find(
        DepartmentTask,
        { ...scope, departmentId: { $in: items.map((item) => String(item.id)) }, status: { $ne: 'done' } },
        { fields: ['departmentId', 'quantityRequired', 'quantityDone'] },
      )
      for (const item of items) {
        const mine = open.filter((task) => task.departmentId === String(item.id))
        item.open_task_count = mine.length
        item.open_units = mine.reduce((sum, task) => sum + (task.quantityRequired - task.quantityDone), 0)
      }
    },
  },
})

export const metadata = crud.metadata

export const GET = crud.GET
export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const departmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string().nullable(),
  position: z.number(),
  description: z.string().nullable(),
  is_active: z.boolean(),
  open_task_count: z.number(),
  open_units: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
})

const buildOpenApi = createCrudOpenApiFactory({ defaultTag: 'Department Routing' })

export const openApi = buildOpenApi({
  resourceName: 'Department',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(departmentSchema),
  create: {
    schema: createDepartmentSchema,
    description: 'Creates a production department (joinery, paint shop, upholstery, packing…).',
  },
  update: {
    schema: updateDepartmentSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a department by id.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a department by id (query parameter `id`). Its existing tasks stay on their orders.',
  },
})
