import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { makeCrudRoute, type CrudCtx } from '@open-mercato/shared/lib/crud/factory'
import { parseBooleanToken } from '@open-mercato/shared/lib/boolean'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import {
  createCrudOpenApiFactory,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from '@open-mercato/shared/lib/openapi/crud'
import { PricedModel } from '../../data/entities'
import {
  createModelSchema,
  updateModelSchema,
  type CreateModelInput,
  type UpdateModelInput,
} from '../../data/validators'
import { loadModelOptions } from '../../lib/offer-repository'

const ENTITY_ID = 'complex_offers:priced_model'

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

const listFields = [
  'id',
  'name',
  'code',
  'description',
  'base_price',
  'margin_percent',
  'bom_product_code',
  'bom_material_cost',
  'bom_cost_refreshed_at',
  'fabric_consumption',
  'quantity_discounts',
  'currency_code',
  'is_active',
  'organization_id',
  'tenant_id',
  'created_at',
  'updated_at',
] as const

function mapModelInput(input: Partial<CreateModelInput>): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  const assign = (key: string, value: unknown) => {
    if (value !== undefined) data[key] = value
  }
  const decimal = (value: number | undefined) => (value === undefined ? undefined : String(value))
  assign('name', input.name)
  assign('code', input.code)
  assign('description', input.description)
  assign('basePrice', decimal(input.basePrice))
  assign('marginPercent', decimal(input.marginPercent))
  assign('bomProductCode', input.bomProductCode)
  assign('bomMaterialCost', decimal(input.bomMaterialCost))
  assign('fabricConsumption', decimal(input.fabricConsumption))
  assign('currencyCode', input.currencyCode)
  assign('isActive', input.isActive)
  return data
}

function scopeOf(ctx: CrudCtx): { tenantId: string; organizationId: string } | null {
  const tenantId = ctx.auth?.tenantId ?? null
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  return tenantId && organizationId ? { tenantId, organizationId } : null
}

const crud = makeCrudRoute<CreateModelInput, UpdateModelInput, ListQuery>({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['complex_offers.view'] },
    POST: { requireAuth: true, requireFeatures: ['complex_offers.manage_pricing'] },
    PUT: { requireAuth: true, requireFeatures: ['complex_offers.manage_pricing'] },
    DELETE: { requireAuth: true, requireFeatures: ['complex_offers.manage_pricing'] },
  },
  orm: {
    entity: PricedModel,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: ENTITY_ID },
  events: { module: 'complex_offers', entity: 'model' },
  list: {
    schema: listSchema,
    entityId: ENTITY_ID,
    fields: [...listFields],
    sortFieldMap: {
      name: 'name',
      code: 'code',
      base_price: 'base_price',
      margin_percent: 'margin_percent',
      bom_material_cost: 'bom_material_cost',
      updated_at: 'updated_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
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
    schema: createModelSchema,
    mapToEntity: (input) => mapModelInput(input),
    response: (entity: PricedModel) => ({ id: entity.id }),
  },
  update: {
    schema: updateModelSchema,
    applyToEntity: (entity: PricedModel, input) => {
      const { id: _id, bomCostRefreshed, ...rest } = input
      Object.assign(entity, mapModelInput(rest))
      if (bomCostRefreshed) entity.bomCostRefreshedAt = new Date()
    },
    response: () => ({ ok: true as const }),
  },
  del: {
    idFrom: 'query',
    softDelete: true,
    response: () => ({ ok: true as const }),
  },
  hooks: {
    /** How many values each parameter has — the list shows "3 sizes · 4 fabrics · 3 add-ons". */
    afterList: async (payload, ctx) => {
      const items: Array<Record<string, unknown>> = Array.isArray(payload?.items) ? payload.items : []
      if (!items.length) return
      const scope = scopeOf(ctx)
      if (!scope) return
      const em = ctx.container.resolve('em') as EntityManager
      const options = await loadModelOptions(em, scope, items.map((item) => String(item.id)))
      for (const item of items) {
        const own = options.filter((option) => option.modelId === String(item.id))
        item.option_counts = {
          size: own.filter((option) => option.kind === 'size').length,
          fabric: own.filter((option) => option.kind === 'fabric').length,
          color: own.filter((option) => option.kind === 'color').length,
          addon: own.filter((option) => option.kind === 'addon').length,
        }
        item.option_count = own.length
      }
    },
  },
})

export const metadata = crud.metadata

export const GET = crud.GET
export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const modelSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string().nullable(),
  description: z.string().nullable(),
  base_price: z.string(),
  margin_percent: z.string(),
  bom_product_code: z.string().nullable(),
  bom_material_cost: z.string(),
  bom_cost_refreshed_at: z.string().nullable(),
  fabric_consumption: z.string(),
  quantity_discounts: z.array(z.object({ minQuantity: z.number(), percent: z.number() })).nullable(),
  currency_code: z.string(),
  is_active: z.boolean(),
  option_count: z.number(),
  option_counts: z.object({ size: z.number(), fabric: z.number(), color: z.number(), addon: z.number() }),
  created_at: z.string(),
  updated_at: z.string(),
})

const buildOpenApi = createCrudOpenApiFactory({ defaultTag: 'Complex Offers' })

export const openApi = buildOpenApi({
  resourceName: 'Priced model',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(modelSchema),
  create: {
    schema: createModelSchema,
    description:
      'Creates a configurable model with its base price and margin. Parameters, surcharges and quantity ' +
      'discounts are written through PUT /api/complex_offers/models/{id}/rules.',
  },
  update: {
    schema: updateModelSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a model by id. `bomCostRefreshed: true` stamps the moment the BOM cost was copied.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a model by id (query parameter `id`). Lines already priced keep their snapshot.',
  },
})
