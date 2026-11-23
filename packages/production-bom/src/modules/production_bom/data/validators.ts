import { z } from 'zod'
import { MATERIAL_TYPES, MATERIAL_UNITS, PRODUCT_TYPES } from './entities'

export { MATERIAL_TYPES, MATERIAL_UNITS, PRODUCT_TYPES }

/** Largest value `numeric(13,6)` holds: seven integer digits. */
export const MAX_BOM_QUANTITY = 9_999_999
export const MAX_BOM_LINES = 200
export const MAX_REQUIREMENT_UNITS = 1_000_000

const trimmedString = (max: number) => z.string().trim().min(1).max(max)
const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .optional()

export const createMaterialSchema = z.object({
  name: trimmedString(255),
  code: optionalTrimmed(64),
  materialType: z.enum(MATERIAL_TYPES).default('other'),
  unit: z.enum(MATERIAL_UNITS),
  unitPrice: z.coerce.number().min(0).max(99_999_999),
  wastePercent: z.coerce.number().min(0).max(100).default(0),
  currencyCode: z.string().trim().length(3).toUpperCase().default('PLN'),
  notes: optionalTrimmed(2000),
  isActive: z.boolean().optional(),
})

export const updateMaterialSchema = createMaterialSchema.partial().extend({
  id: z.string().uuid(),
})

export const createProductSchema = z.object({
  name: trimmedString(255),
  code: optionalTrimmed(64),
  productType: z.enum(PRODUCT_TYPES).default('other'),
  laborMinutes: z.coerce.number().int().min(0).max(100_000).default(0),
  fabricConsumption: z.coerce.number().min(0).max(MAX_BOM_QUANTITY).default(0),
  description: optionalTrimmed(4000),
  catalogProductId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
})

export const updateProductSchema = createProductSchema.partial().extend({
  id: z.string().uuid(),
})

/**
 * A line is either a plain quantity or a split into pieces (`segmentCount` ×
 * `segmentLength`). When split, the quantity is derived on the server — a
 * client-sent quantity that disagrees with the pieces is ignored, so the two
 * can never drift apart.
 */
export const bomLineInputSchema = z
  .object({
    materialId: z.string().uuid(),
    quantity: z.coerce.number().positive().max(MAX_BOM_QUANTITY).optional(),
    segmentCount: z.coerce.number().int().min(1).max(10_000).nullable().optional(),
    segmentLength: z.coerce.number().positive().max(MAX_BOM_QUANTITY).nullable().optional(),
    notes: optionalTrimmed(500),
  })
  .superRefine((line, ctx) => {
    const hasCount = line.segmentCount != null
    const hasLength = line.segmentLength != null
    if (hasCount !== hasLength) {
      ctx.addIssue({
        code: 'custom',
        path: [hasCount ? 'segmentLength' : 'segmentCount'],
        message: 'A split needs both the number of pieces and the piece length.',
      })
    }
    if (!hasCount && !hasLength && line.quantity == null) {
      ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Quantity is required.' })
    }
  })

/**
 * The BOM is written as a whole: the request carries the full list of lines and
 * replaces what was there. Order in the array is the display order.
 */
export const replaceBomSchema = z.object({
  lines: z.array(bomLineInputSchema).max(MAX_BOM_LINES),
})

export const duplicateProductSchema = z.object({
  name: trimmedString(255),
  code: optionalTrimmed(64),
})

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>
export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type BomLineInput = z.infer<typeof bomLineInputSchema>
export type ReplaceBomInput = z.infer<typeof replaceBomSchema>
export type DuplicateProductInput = z.infer<typeof duplicateProductSchema>
