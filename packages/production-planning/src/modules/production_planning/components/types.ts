import type { OrderPriority, OrderStatus, WorkCenterStage } from '../data/entities'
import type { PlanInput, PlanView } from '../lib/plan-model'

export type { ListResponse } from '@open-mercato/production-bom/modules/production_bom/components/types'
export type { PlanInput, PlanView }

/** A row of `GET /api/production_planning/work-centers` — snake_case, as the query engine returns it. */
export type WorkCenterRow = {
  id: string
  name: string
  code: string | null
  stage: WorkCenterStage
  daily_capacity_minutes: number
  position: number
  notes: string | null
  is_active: boolean
  updated_at?: string
}

/** A row of `GET /api/production_planning/orders`, including the plan fields added by `afterList`. */
export type OrderRow = {
  id: string
  number: string
  product_id: string
  product_name: string | null
  product_code: string | null
  quantity: number
  due_date: string
  priority: OrderPriority
  status: OrderStatus
  fabric_material_id: string | null
  reference: string | null
  notes: string | null
  planned_start: string | null
  starts_in_past: boolean
  missing_routing: boolean
  on_overloaded_day: boolean
  labor_minutes_total: number | null
  updated_at?: string
}

/** A row of `GET /api/production_planning/routings`. */
export type RoutingSummaryRow = {
  id: string
  name: string
  code: string | null
  is_active: boolean
  labor_minutes: number
  step_count: number
  routing_minutes: number
  route: string
}

export type RoutingStepView = {
  id: string
  workCenterId: string
  workCenterName: string
  workCenterMissing: boolean
  sequence: number
  minutesPerUnit: string
  setupMinutes: number
  notes: string | null
}

export type RoutingView = {
  product: { id: string; name: string; code: string | null; laborMinutes: number }
  steps: RoutingStepView[]
}

export type PlanResponse = { input: PlanInput }
