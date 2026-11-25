import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { parseBooleanToken } from '@open-mercato/shared/lib/boolean'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import {
  createCrudOpenApiFactory,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from '@open-mercato/shared/lib/openapi/crud'
import { WorkCenter } from '../../data/entities'
import {
  WORK_CENTER_STAGES,
  createWorkCenterSchema,
  updateWorkCenterSchema,
  type CreateWorkCenterInput,
  type UpdateWorkCenterInput,
} from '../../data/validators'

const ENTITY_ID = 'production_planning:work_center'

const listSchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().default('position'),
    sortDir: z.enum(['asc', 'desc']).default('asc'),
    search: z.string().optional(),
    stage: z.enum(WORK_CENTER_STAGES).optional(),
    isActive: z.string().optional(),
  })
  .passthrough()

type ListQuery = z.infer<typeof listSchema>

const listFields = [
  'id',
  'name',
  'code',
  'stage',
  'daily_capacity_minutes',
  'position',
  'notes',
  'is_active',
  'organization_id',
  'tenant_id',
  'created_at',
  'updated_at',
] as const

function mapInput(input: Partial<CreateWorkCenterInput>): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  const assign = (key: string, value: unknown) => {
    if (value !== undefined) data[key] = value
  }
  assign('name', input.name)
  assign('code', input.code)
  assign('stage', input.stage)
  assign('dailyCapacityMinutes', input.dailyCapacityMinutes)
  assign('position', input.position)
  assign('notes', input.notes)
  assign('isActive', input.isActive)
  return data
}

const crud = makeCrudRoute<CreateWorkCenterInput, UpdateWorkCenterInput, ListQuery>({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['production_planning.view'] },
    POST: { requireAuth: true, requireFeatures: ['production_planning.create'] },
    PUT: { requireAuth: true, requireFeatures: ['production_planning.edit'] },
    DELETE: { requireAuth: true, requireFeatures: ['production_planning.delete'] },
  },
  orm: {
    entity: WorkCenter,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: ENTITY_ID },
  events: { module: 'production_planning', entity: 'work_center' },
  list: {
    schema: listSchema,
    entityId: ENTITY_ID,
    fields: [...listFields],
    sortFieldMap: {
      name: 'name',
      code: 'code',
      stage: 'stage',
      position: 'position',
      daily_capacity_minutes: 'daily_capacity_minutes',
      dailyCapacityMinutes: 'daily_capacity_minutes',
      updated_at: 'updated_at',
      updatedAt: 'updated_at',
    },
    buildFilters: (query) => {
      const filters: Record<string, unknown> = {}
      if (query.id) filters.id = { $eq: query.id }
      if (query.stage) filters.stage = { $eq: query.stage }
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
    schema: createWorkCenterSchema,
    mapToEntity: (input) => mapInput(input),
    response: (entity: WorkCenter) => ({ id: entity.id }),
  },
  update: {
    schema: updateWorkCenterSchema,
    applyToEntity: (entity: WorkCenter, input) => {
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
})

export const metadata = crud.metadata

export const GET = crud.GET
export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const workCenterSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string().nullable(),
  stage: z.enum(WORK_CENTER_STAGES),
  daily_capacity_minutes: z.number(),
  position: z.number(),
  notes: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})

const buildOpenApi = createCrudOpenApiFactory({ defaultTag: 'Production planning' })

export const openApi = buildOpenApi({
  resourceName: 'Work center',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(workCenterSchema),
  create: {
    schema: createWorkCenterSchema,
    description: 'Creates a work centre with its daily capacity in minutes.',
  },
  update: {
    schema: updateWorkCenterSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a work centre by id. A capacity change re-colours the plan on the next read.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a work centre by id (query parameter `id`).',
  },
})
