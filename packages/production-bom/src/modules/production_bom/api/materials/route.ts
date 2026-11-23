import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { parseBooleanToken } from '@open-mercato/shared/lib/boolean'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import {
  createCrudOpenApiFactory,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from '@open-mercato/shared/lib/openapi/crud'
import { Material } from '../../data/entities'
import {
  MATERIAL_TYPES,
  MATERIAL_UNITS,
  createMaterialSchema,
  updateMaterialSchema,
  type CreateMaterialInput,
  type UpdateMaterialInput,
} from '../../data/validators'

const ENTITY_ID = 'production_bom:material'

const listSchema = z
  .object({
    id: z.string().uuid().optional(),
    ids: z.string().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().default('name'),
    sortDir: z.enum(['asc', 'desc']).default('asc'),
    search: z.string().optional(),
    materialType: z.enum(MATERIAL_TYPES).optional(),
    unit: z.enum(MATERIAL_UNITS).optional(),
    isActive: z.string().optional(),
  })
  .passthrough()

type ListQuery = z.infer<typeof listSchema>

const listFields = [
  'id',
  'name',
  'code',
  'material_type',
  'unit',
  'unit_price',
  'waste_percent',
  'currency_code',
  'notes',
  'is_active',
  'organization_id',
  'tenant_id',
  'created_at',
  'updated_at',
] as const

function mapMaterialInput(input: Partial<CreateMaterialInput>): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  const assign = (key: string, value: unknown) => {
    if (value !== undefined) data[key] = value
  }
  assign('name', input.name)
  assign('code', input.code)
  assign('materialType', input.materialType)
  assign('unit', input.unit)
  assign('unitPrice', input.unitPrice === undefined ? undefined : String(input.unitPrice))
  assign('wastePercent', input.wastePercent === undefined ? undefined : String(input.wastePercent))
  assign('currencyCode', input.currencyCode)
  assign('notes', input.notes)
  assign('isActive', input.isActive)
  return data
}

const crud = makeCrudRoute<CreateMaterialInput, UpdateMaterialInput, ListQuery>({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['production_bom.view'] },
    POST: { requireAuth: true, requireFeatures: ['production_bom.create'] },
    PUT: { requireAuth: true, requireFeatures: ['production_bom.edit'] },
    DELETE: { requireAuth: true, requireFeatures: ['production_bom.delete'] },
  },
  orm: {
    entity: Material,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: ENTITY_ID },
  events: { module: 'production_bom', entity: 'material' },
  list: {
    schema: listSchema,
    entityId: ENTITY_ID,
    fields: [...listFields],
    sortFieldMap: {
      name: 'name',
      code: 'code',
      materialType: 'material_type',
      material_type: 'material_type',
      unit: 'unit',
      unitPrice: 'unit_price',
      unit_price: 'unit_price',
      waste_percent: 'waste_percent',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      updated_at: 'updated_at',
    },
    buildFilters: (query) => {
      const filters: Record<string, unknown> = {}
      if (query.id) filters.id = { $eq: query.id }
      if (query.ids) {
        const ids = query.ids.split(',').map((value) => value.trim()).filter(Boolean)
        if (ids.length) filters.id = { $in: ids }
      }
      if (query.materialType) filters.material_type = { $eq: query.materialType }
      if (query.unit) filters.unit = { $eq: query.unit }
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
    schema: createMaterialSchema,
    mapToEntity: (input) => mapMaterialInput(input),
    response: (entity: Material) => ({ id: entity.id }),
  },
  update: {
    schema: updateMaterialSchema,
    applyToEntity: (entity: Material, input) => {
      const { id: _id, ...rest } = input
      Object.assign(entity, mapMaterialInput(rest))
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

const materialSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string().nullable(),
  material_type: z.enum(MATERIAL_TYPES),
  unit: z.enum(MATERIAL_UNITS),
  unit_price: z.string(),
  waste_percent: z.string(),
  currency_code: z.string(),
  notes: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})

const buildOpenApi = createCrudOpenApiFactory({ defaultTag: 'Production BOM' })

export const openApi = buildOpenApi({
  resourceName: 'Material',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(materialSchema),
  create: {
    schema: createMaterialSchema,
    description: 'Creates a material (fabric, foam, zipper, accessory…) with its unit, unit price and cutting allowance.',
  },
  update: {
    schema: updateMaterialSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a material by id. A price change re-costs every product whose BOM uses it.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a material by id (query parameter `id`).',
  },
})
