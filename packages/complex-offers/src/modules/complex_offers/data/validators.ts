import { z } from 'zod'
import { PARAMETER_KINDS } from '../lib/pricing'
import { VERSION_STATUSES } from './entities'

export { PARAMETER_KINDS, VERSION_STATUSES }

export const MAX_OPTIONS = 200
export const MAX_LINES = 100
export const MAX_QUANTITY = 100_000
const MAX_MONEY = 99_999_999

const trimmedString = (max: number) => z.string().trim().min(1).max(max)
const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .optional()

export const quantityDiscountSchema = z.object({
  minQuantity: z.coerce.number().int().min(1).max(MAX_QUANTITY),
  percent: z.coerce.number().min(0).max(90),
})

/**
 * Model fields WITHOUT defaults. Defaults belong to create only: zod applies
 * `.default()` even inside `.partial()`, so an update schema derived from a
 * schema with defaults silently resets every omitted field — a PUT of just
 * `{ id, isActive }` would zero the margin. Keep the two schemas apart.
 */
const modelFields = {
  name: trimmedString(255),
  code: optionalTrimmed(64),
  description: optionalTrimmed(4000),
  basePrice: z.coerce.number().min(0).max(MAX_MONEY),
  marginPercent: z.coerce.number().min(0).max(500),
  bomProductCode: optionalTrimmed(64),
  bomMaterialCost: z.coerce.number().min(0).max(MAX_MONEY),
  fabricConsumption: z.coerce.number().min(0).max(10_000),
  currencyCode: z.string().trim().length(3).toUpperCase(),
  isActive: z.boolean(),
}

export const createModelSchema = z.object({
  ...modelFields,
  marginPercent: modelFields.marginPercent.default(0),
  bomMaterialCost: modelFields.bomMaterialCost.default(0),
  fabricConsumption: modelFields.fabricConsumption.default(0),
  currencyCode: modelFields.currencyCode.default('PLN'),
  isActive: modelFields.isActive.optional(),
})

export const updateModelSchema = z.object(modelFields).partial().extend({
  id: z.string().uuid(),
  /** Set when the material cost was just copied from the BOM. */
  bomCostRefreshed: z.boolean().optional(),
})

export const modelOptionInputSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(PARAMETER_KINDS),
  label: trimmedString(255),
  surcharge: z.coerce.number().min(-MAX_MONEY).max(MAX_MONEY).default(0),
  sizeFactor: z.coerce.number().positive().max(100).default(1),
  fabricPricePerMeter: z.coerce.number().min(0).max(MAX_MONEY).default(0),
  isDefault: z.boolean().default(false),
})

/**
 * Pricing rules are written as a whole: every option and every discount tier
 * in one request. An option keeps its id when sent with it, so lines that
 * point at it keep pointing at it.
 */
export const replaceRulesSchema = z.object({
  options: z.array(modelOptionInputSchema).max(MAX_OPTIONS),
  quantityDiscounts: z.array(quantityDiscountSchema).max(20),
})

export const createOfferSchema = z.object({
  title: trimmedString(255),
  customerName: trimmedString(255),
  contactPerson: optionalTrimmed(255),
  customerId: z.string().uuid().nullable().optional(),
  validUntil: z.coerce.date().nullable().optional(),
  notes: optionalTrimmed(4000),
})

export const updateOfferSchema = createOfferSchema.partial().extend({ id: z.string().uuid() })

export const lineSelectionSchema = z.object({
  sizeOptionId: z.string().uuid().nullable().optional(),
  fabricOptionId: z.string().uuid().nullable().optional(),
  colorOptionId: z.string().uuid().nullable().optional(),
  addonOptionIds: z.array(z.string().uuid()).max(50).optional(),
})

export const createLineSchema = z.object({
  modelId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(MAX_QUANTITY).default(1),
  selection: lineSelectionSchema.default({}),
})

export const updateLineSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(MAX_QUANTITY).optional(),
  selection: lineSelectionSchema.optional(),
})

/** Allowed moves. Anything else is refused — a sent version never goes back to draft. */
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['sent'],
  sent: ['accepted', 'rejected'],
  accepted: [],
  rejected: [],
}

export const changeStatusSchema = z.object({ status: z.enum(VERSION_STATUSES) })

export type CreateModelInput = z.infer<typeof createModelSchema>
export type UpdateModelInput = z.infer<typeof updateModelSchema>
export type ModelOptionInput = z.infer<typeof modelOptionInputSchema>
export type ReplaceRulesInput = z.infer<typeof replaceRulesSchema>
export type CreateOfferInput = z.infer<typeof createOfferSchema>
export type UpdateOfferInput = z.infer<typeof updateOfferSchema>
export type CreateLineInput = z.infer<typeof createLineSchema>
export type UpdateLineInput = z.infer<typeof updateLineSchema>
