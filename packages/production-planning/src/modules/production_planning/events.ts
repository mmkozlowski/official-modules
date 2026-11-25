import { createModuleEvents } from '@open-mercato/shared/modules/events'

/**
 * Event catalog. Every id is a contract surface — adding is additive, renaming
 * or removing is a breaking change.
 *
 * `order.rescheduled` carries the old and new due date and how many work-centre
 * days were overloaded before and after, so the value of the plan is measurable:
 * how often a planner moves work, and whether moves clear conflicts or create them.
 */
const events = [
  { id: 'production_planning.work_center.created', label: 'Work Center Created', entity: 'work_center', category: 'crud' as const },
  { id: 'production_planning.work_center.updated', label: 'Work Center Updated', entity: 'work_center', category: 'crud' as const },
  { id: 'production_planning.work_center.deleted', label: 'Work Center Deleted', entity: 'work_center', category: 'crud' as const },
  { id: 'production_planning.order.created', label: 'Production Order Created', entity: 'order', category: 'crud' as const },
  { id: 'production_planning.order.updated', label: 'Production Order Updated', entity: 'order', category: 'crud' as const },
  { id: 'production_planning.order.deleted', label: 'Production Order Deleted', entity: 'order', category: 'crud' as const },
  { id: 'production_planning.order.rescheduled', label: 'Production Order Rescheduled', entity: 'order', category: 'lifecycle' as const },
  { id: 'production_planning.routing.updated', label: 'Product Routing Updated', entity: 'routing', category: 'lifecycle' as const },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'production_planning',
  events,
})

export const emitProductionPlanningEvent = eventsConfig.emit

export type ProductionPlanningEventId = (typeof events)[number]['id']

export default eventsConfig
