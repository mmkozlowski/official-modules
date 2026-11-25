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
import { Offer } from '../../data/entities'
import {
  VERSION_STATUSES,
  createOfferSchema,
  updateOfferSchema,
  type CreateOfferInput,
  type UpdateOfferInput,
} from '../../data/validators'
import { createVersionEntity, nextOfferNumber } from '../../lib/offer-repository'
import { emitComplexOffersEvent } from '../../events'

const ENTITY_ID = 'complex_offers:offer'

const listSchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().default('number'),
    sortDir: z.enum(['asc', 'desc']).default('desc'),
    search: z.string().optional(),
    status: z.enum(VERSION_STATUSES).optional(),
  })
  .passthrough()

type ListQuery = z.infer<typeof listSchema>

const listFields = [
  'id',
  'number',
  'title',
  'customer_name',
  'contact_person',
  'customer_id',
  'valid_until',
  'notes',
  'current_version_number',
  'status',
  'total_net',
  'currency_code',
  'organization_id',
  'tenant_id',
  'created_at',
  'updated_at',
] as const

/** The number is assigned on the server in `beforeCreate` and travels on the input to `mapToEntity`. */
type CreateWithNumber = CreateOfferInput & { number?: string }

function mapOfferInput(input: Partial<CreateWithNumber>): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  const assign = (key: string, value: unknown) => {
    if (value !== undefined) data[key] = value
  }
  assign('number', input.number)
  assign('title', input.title)
  assign('customerName', input.customerName)
  assign('contactPerson', input.contactPerson)
  assign('customerId', input.customerId)
  assign('validUntil', input.validUntil)
  assign('notes', input.notes)
  return data
}

function scopeOf(ctx: CrudCtx): { tenantId: string; organizationId: string } | null {
  const tenantId = ctx.auth?.tenantId ?? null
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  return tenantId && organizationId ? { tenantId, organizationId } : null
}

const crud = makeCrudRoute<CreateWithNumber, UpdateOfferInput, ListQuery>({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['complex_offers.view'] },
    POST: { requireAuth: true, requireFeatures: ['complex_offers.create'] },
    PUT: { requireAuth: true, requireFeatures: ['complex_offers.edit'] },
    DELETE: { requireAuth: true, requireFeatures: ['complex_offers.delete'] },
  },
  orm: {
    entity: Offer,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: ENTITY_ID },
  events: { module: 'complex_offers', entity: 'offer' },
  list: {
    schema: listSchema,
    entityId: ENTITY_ID,
    fields: [...listFields],
    sortFieldMap: {
      number: 'number',
      title: 'title',
      customer_name: 'customer_name',
      status: 'status',
      total_net: 'total_net',
      valid_until: 'valid_until',
      current_version_number: 'current_version_number',
      updated_at: 'updated_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    buildFilters: (query) => {
      const filters: Record<string, unknown> = {}
      if (query.id) filters.id = { $eq: query.id }
      if (query.status) filters.status = { $eq: query.status }
      if (query.search && query.search.trim()) {
        const pattern = `%${escapeLikePattern(query.search.trim())}%`
        filters.$or = [{ number: { $ilike: pattern } }, { title: { $ilike: pattern } }, { customer_name: { $ilike: pattern } }]
      }
      return filters
    },
    export: { enabled: true },
  },
  create: {
    schema: createOfferSchema as unknown as z.ZodType<CreateWithNumber>,
    mapToEntity: (input) => mapOfferInput(input),
    response: (entity: Offer) => ({ id: entity.id, number: entity.number }),
  },
  update: {
    schema: updateOfferSchema,
    applyToEntity: (entity: Offer, input) => {
      // The header is printed on the offer, so it freezes with the version: once
      // the current version left draft, a change goes into a new version.
      if (entity.status !== 'draft') throw new CrudHttpError(409, { error: 'version_locked', status: entity.status })
      const { id: _id, ...rest } = input
      Object.assign(entity, mapOfferInput(rest))
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
      const scope = scopeOf(ctx)
      if (!scope) throw new CrudHttpError(403, { error: 'Organization scope required' })
      const em = ctx.container.resolve('em') as EntityManager
      return { ...input, number: await nextOfferNumber(em, scope) }
    },
    /** Every offer starts with its first, empty, editable version. */
    afterCreate: async (entity: Offer, ctx) => {
      const scope = scopeOf(ctx)
      if (!scope) return
      const em = (ctx.container.resolve('em') as EntityManager).fork()
      createVersionEntity(em, scope, entity.id, 1, null)
      await em.flush()
      try {
        await emitComplexOffersEvent('complex_offers.version.created', {
          offerId: entity.id,
          versionNumber: 1,
          copiedFromVersion: null,
          organizationId: scope.organizationId,
          tenantId: scope.tenantId,
        })
      } catch {
        // Events never fail a committed write.
      }
    },
  },
})

export const metadata = crud.metadata

export const GET = crud.GET
export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const offerSchema = z.object({
  id: z.string().uuid(),
  number: z.string(),
  title: z.string(),
  customer_name: z.string(),
  contact_person: z.string().nullable(),
  customer_id: z.string().uuid().nullable(),
  valid_until: z.string().nullable(),
  notes: z.string().nullable(),
  current_version_number: z.number(),
  status: z.enum(VERSION_STATUSES),
  total_net: z.string(),
  currency_code: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})

const buildOpenApi = createCrudOpenApiFactory({ defaultTag: 'Complex Offers' })

export const openApi = buildOpenApi({
  resourceName: 'Offer',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(offerSchema),
  create: {
    schema: createOfferSchema,
    description: 'Creates an offer with its number (OF/<year>/<seq>) and an empty draft version 1.',
  },
  update: {
    schema: updateOfferSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates the offer header. Refused with 409 `version_locked` once the current version was sent.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes an offer by id (query parameter `id`).',
  },
})
