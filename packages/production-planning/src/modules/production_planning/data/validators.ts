import { z } from 'zod'
import { ORDER_PRIORITIES, ORDER_STATUSES, WORK_CENTER_STAGES } from './entities'

export { ORDER_PRIORITIES, ORDER_STATUSES, WORK_CENTER_STAGES }

export const MAX_ROUTING_STEPS = 30
export const MAX_ORDER_QUANTITY = 100_000
/** Longest plan window the API computes, in working days. */
export const MAX_PLAN_DAYS = 60

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date as YYYY-MM-DD')
const trimmedString = (max: number) => z.string().trim().min(1).max(max)
const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .optional()

export const createWorkCenterSchema = z.object({
  name: trimmedString(255),
  code: optionalTrimmed(64),
  stage: z.enum(WORK_CENTER_STAGES).default('other'),
  dailyCapacityMinutes: z.coerce.number().int().min(0).max(24 * 60 * 50),
  position: z.coerce.number().int().min(0).max(1000).default(0),
  notes: optionalTrimmed(2000),
  isActive: z.boolean().optional(),
})

export const updateWorkCenterSchema = createWorkCenterSchema.partial().extend({ id: z.string().uuid() })

export const createOrderSchema = z.object({
  number: optionalTrimmed(64),
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(MAX_ORDER_QUANTITY),
  dueDate: isoDate,
  priority: z.enum(ORDER_PRIORITIES).default('normal'),
  status: z.enum(ORDER_STATUSES).default('planned'),
  fabricMaterialId: z.string().uuid().nullable().optional(),
  reference: optionalTrimmed(255),
  notes: optionalTrimmed(2000),
})

export const updateOrderSchema = createOrderSchema.partial().extend({ id: z.string().uuid() })

export const rescheduleOrderSchema = z.object({ dueDate: isoDate })

export const routingStepInputSchema = z.object({
  workCenterId: z.string().uuid(),
  minutesPerUnit: z.coerce.number().min(0).max(100_000),
  setupMinutes: z.coerce.number().int().min(0).max(100_000).default(0),
  notes: optionalTrimmed(500),
})

/** The routing is written as a whole; array order is the step order. */
export const replaceRoutingSchema = z.object({
  steps: z.array(routingStepInputSchema).max(MAX_ROUTING_STEPS),
})

export const planQuerySchema = z.object({
  from: isoDate.optional(),
  days: z.coerce.number().int().min(1).max(MAX_PLAN_DAYS).default(10),
})

export type CreateWorkCenterInput = z.infer<typeof createWorkCenterSchema>
export type UpdateWorkCenterInput = z.infer<typeof updateWorkCenterSchema>
export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>
export type RescheduleOrderInput = z.infer<typeof rescheduleOrderSchema>
export type RoutingStepInput = z.infer<typeof routingStepInputSchema>
export type ReplaceRoutingInput = z.infer<typeof replaceRoutingSchema>
