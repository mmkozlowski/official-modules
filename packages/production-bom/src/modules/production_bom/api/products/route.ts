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
import { Product } from '../../data/entities'
import {
  PRODUCT_TYPES,
  createProductSchema,
  updateProductSchema,
  type CreateProductInput,
  type UpdateProductInput,
} from '../../data/validators'
import { buildBomViews } from '../../lib/bom-repository'

const ENTITY_ID = 'production_bom:product'

const listSchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().default('name'),
    sortDir: z.enum(['asc', 'desc']).default('asc'),
    search: z.string().optional(),
    productType: z.enum(PRODUCT_TYPES).optional(),
    isActive: z.string().optional(),
  })
  .passthrough()

type ListQuery = z.infer<typeof listSchema>

const listFields = [
  'id',
  'name',
  'code',
  'product_type',
  'labor_minutes',
  'fabric_consumption',
  'description',
  'source_product_id',
  'catalog_product_id',
  'is_active',
  'organization_id',
  'tenant_id',
  'created_at',
  'updated_at',
] as const

function mapProductInput(input: Partial<CreateProductInput>): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  const assign = (key: string, value: unknown) => {
    if (value !== undefined) data[key] = value
  }
  assign('name', input.name)
  assign('code', input.code)
  assign('productType', input.productType)
  assign('laborMinutes', input.laborMinutes)
  assign('fabricConsumption', input.fabricConsumption === undefined ? undefined : String(input.fabricConsumption))
  assign('description', input.description)
  assign('catalogProductId', input.catalogProductId)
  assign('isActive', input.isActive)
  return data
}

function scopeOf(ctx: CrudCtx): { tenantId: string; organizationId: string } | null {
  const tenantId = ctx.auth?.tenantId ?? null
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  return tenantId && organizationId ? { tenantId, organizationId } : null
}

const crud = makeCrudRoute<CreateProductInput, UpdateProductInput, ListQuery>({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['production_bom.view'] },
    POST: { requireAuth: true, requireFeatures: ['production_bom.create'] },
    PUT: { requireAuth: true, requireFeatures: ['production_bom.edit'] },
    DELETE: { requireAuth: true, requireFeatures: ['production_bom.delete'] },
  },
  orm: {
    entity: Product,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: ENTITY_ID },
  events: { module: 'production_bom', entity: 'product' },
  list: {
    schema: listSchema,
    entityId: ENTITY_ID,
    fields: [...listFields],
    sortFieldMap: {
      name: 'name',
      code: 'code',
      product_type: 'product_type',
      productType: 'product_type',
      labor_minutes: 'labor_minutes',
      laborMinutes: 'labor_minutes',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      updated_at: 'updated_at',
    },
    buildFilters: (query) => {
      const filters: Record<string, unknown> = {}
      if (query.id) filters.id = { $eq: query.id }
      if (query.productType) filters.product_type = { $eq: query.productType }
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
    response: (entity: Product) => ({ id: entity.id }),
  },
  update: {
    schema: updateProductSchema,
    applyToEntity: (entity: Product, input) => {
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
    /**
     * Every row carries its material cost and line count, so the list can show
     * "what one piece costs in materials" without a request per row. Computed
     * from the live material prices on every read — a price change re-costs the
     * list immediately, there is no stored total to go stale.
     */
    afterList: async (payload, ctx) => {
      const items: Array<Record<string, unknown>> = Array.isArray(payload?.items) ? payload.items : []
      if (!items.length) return
      const scope = scopeOf(ctx)
      if (!scope) return
      const em = ctx.container.resolve('em') as EntityManager
      const ids = items.map((item) => String(item.id))
      const views = await buildBomViews(em, scope, ids)
      for (const item of items) {
        const view = views.get(String(item.id))
        item.material_cost = view?.materialCost ?? '0.00'
        item.bom_line_count = view?.lines.length ?? 0
        item.currency_code = view?.currencyCode ?? 'PLN'
      }
    },
  },
})

export const metadata = crud.metadata

export const GET = crud.GET
export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const productSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string().nullable(),
  product_type: z.enum(PRODUCT_TYPES),
  labor_minutes: z.number(),
  fabric_consumption: z.string(),
  description: z.string().nullable(),
  source_product_id: z.string().uuid().nullable(),
  catalog_product_id: z.string().uuid().nullable(),
  is_active: z.boolean(),
  material_cost: z.string(),
  bom_line_count: z.number(),
  currency_code: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})

const buildOpenApi = createCrudOpenApiFactory({ defaultTag: 'Production BOM' })

export const openApi = buildOpenApi({
  resourceName: 'Product',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(productSchema),
  create: {
    schema: createProductSchema,
    description:
      'Creates a manufactured product. Its BOM is written separately through ' +
      'PUT /api/production_bom/products/{id}/bom. Labour time and fabric consumption are product fields, not BOM lines.',
  },
  update: {
    schema: updateProductSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a product by id.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a product by id (query parameter `id`).',
  },
})
