import type { OrderStatus, TaskStatus } from '../data/entities'
import type { OrderView, TaskView } from '../lib/order-service'

/** A row of `GET /api/department_routing/departments` — snake_case, as the query engine returns it. */
export type DepartmentRow = {
  id: string
  name: string
  code: string | null
  position: number
  description: string | null
  is_active: boolean
  open_task_count: number
  open_units: number
  updated_at?: string
}

export type ProductRow = {
  id: string
  name: string
  code: string | null
  department_ids: string[]
  department_names: string[]
  description: string | null
  is_active: boolean
  updated_at?: string
}

export type OrderRow = {
  id: string
  number: string
  customer_name: string
  due_date: string | null
  status: OrderStatus
  departments_done: number
  departments_total: number
  accepted_at: string | null
  ready_at: string | null
  notes: string | null
  lines_summary: string
  units_total: number
  updated_at?: string
}

export type BoardTask = TaskView & {
  orderStatus: OrderStatus
  orderDepartmentsDone: number
  orderDepartmentsTotal: number
}

export type ListResponse<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type { OrderView, TaskView, OrderStatus, TaskStatus }
