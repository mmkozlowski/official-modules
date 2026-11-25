// Barrel for @open-mercato/department-routing
export { metadata, features } from './modules/department_routing/index'
export { eventsConfig as departmentRoutingEventsConfig, emitDepartmentRoutingEvent } from './modules/department_routing/events'
export type { DepartmentRoutingEventId } from './modules/department_routing/events'
export {
  applyReport,
  orderStatusFor,
  planDepartmentTasks,
  summarizeDepartments,
  taskStatusFor,
} from './modules/department_routing/lib/routing'
