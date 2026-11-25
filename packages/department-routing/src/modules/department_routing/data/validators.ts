import { z } from 'zod'
import { ORDER_STATUSES, TASK_STATUSES } from './entities'

export { ORDER_STATUSES, TASK_STATUSES }

export const MAX_ORDER_LINES = 100
export const MAX_LINE_QUANTITY = 100_000
export const MAX_ROUTE_DEPARTMENTS = 20

const trimmedString = (max: number) => z.string().trim().min(1).max(max)
const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .optional()

/** `YYYY-MM-DD`; an empty string from a cleared date field means "no due date". */
const isoDate = z
  .union([z.literal(''), z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/)])
  .nullable()
  .optional()
  .transform((value) => (value ? value : value === undefined ? undefined : null))

export const createDepartmentSchema = z.object({
  name: trimmedString(120),
  code: optionalTrimmed(16),
  position: z.coerce.number().int().min(0).max(999).default(0),
  description: optionalTrimmed(1000),
  isActive: z.boolean().optional(),
})

export const updateDepartmentSchema = createDepartmentSchema.partial().extend({ id: z.string().uuid() })

/**
 * `departmentIds` is the routing: the ordered list of departments one unit
 * passes through. Duplicates are refused — a department appearing twice would
 * get two tasks for the same work.
 */
export const departmentIdsSchema = z
  .array(z.string().uuid())
  .max(MAX_ROUTE_DEPARTMENTS)
  .refine((ids) => new Set(ids).size === ids.length, { message: 'A department can appear on a routing only once.' })

export const createProductSchema = z.object({
  name: trimmedString(255),
  code: optionalTrimmed(64),
  departmentIds: departmentIdsSchema.default([]),
  description: optionalTrimmed(2000),
  isActive: z.boolean().optional(),
})

export const updateProductSchema = createProductSchema.partial().extend({ id: z.string().uuid() })

export const createOrderSchema = z.object({
  number: optionalTrimmed(40),
  customerName: trimmedString(255),
  dueDate: isoDate,
  notes: optionalTrimmed(2000),
})

/** Header fields only — status and progress are never written by hand. */
export const updateOrderSchema = createOrderSchema.partial().extend({ id: z.string().uuid() })

export const orderLineInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(MAX_LINE_QUANTITY),
})

export const replaceOrderLinesSchema = z.object({
  lines: z.array(orderLineInputSchema).max(MAX_ORDER_LINES),
})

/** `add` — "+3 done" (the usual report); `set` — a correction to an absolute number. Exactly one of the two. */
export const reportTaskSchema = z
  .object({
    add: z.coerce.number().int().min(1).max(MAX_LINE_QUANTITY).optional(),
    set: z.coerce.number().int().min(0).max(MAX_LINE_QUANTITY).optional(),
  })
  .refine((value) => (value.add === undefined) !== (value.set === undefined), {
    message: 'Send either add or set.',
  })

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>
export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>
export type OrderLineInput = z.infer<typeof orderLineInputSchema>
export type ReplaceOrderLinesInput = z.infer<typeof replaceOrderLinesSchema>
export type ReportTaskInput = z.infer<typeof reportTaskSchema>
