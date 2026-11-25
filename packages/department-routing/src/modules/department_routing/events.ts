import { createModuleEvents } from '@open-mercato/shared/modules/events'

/**
 * Event catalog. Every id is a contract surface — adding is additive, renaming
 * or removing is a breaking change.
 *
 * The lifecycle events are broadcast to the browser, so an order screen open in
 * one window refreshes the moment a department reports in another. They also
 * carry the numbers that make the module measurable: how many tasks one
 * acceptance created automatically, how much each report moved.
 */
const events = [
  { id: 'department_routing.department.created', label: 'Department Created', entity: 'department', category: 'crud' as const },
  { id: 'department_routing.department.updated', label: 'Department Updated', entity: 'department', category: 'crud' as const },
  { id: 'department_routing.department.deleted', label: 'Department Deleted', entity: 'department', category: 'crud' as const },
  { id: 'department_routing.product.created', label: 'Product Created', entity: 'product', category: 'crud' as const },
  { id: 'department_routing.product.updated', label: 'Product Updated', entity: 'product', category: 'crud' as const },
  { id: 'department_routing.product.deleted', label: 'Product Deleted', entity: 'product', category: 'crud' as const },
  { id: 'department_routing.order.created', label: 'Order Created', entity: 'order', category: 'crud' as const },
  { id: 'department_routing.order.updated', label: 'Order Updated', entity: 'order', category: 'crud' as const },
  { id: 'department_routing.order.deleted', label: 'Order Deleted', entity: 'order', category: 'crud' as const },
  {
    id: 'department_routing.order.accepted',
    label: 'Order Accepted and Split into Department Tasks',
    entity: 'order',
    category: 'lifecycle' as const,
    clientBroadcast: true,
  },
  {
    id: 'department_routing.task.reported',
    label: 'Department Reported Done Quantity',
    entity: 'task',
    category: 'lifecycle' as const,
    clientBroadcast: true,
  },
  {
    id: 'department_routing.order.ready_to_ship',
    label: 'Order Ready to Ship',
    entity: 'order',
    category: 'lifecycle' as const,
    clientBroadcast: true,
  },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'department_routing',
  events,
})

export const emitDepartmentRoutingEvent = eventsConfig.emit

export type DepartmentRoutingEventId = (typeof events)[number]['id']

export default eventsConfig
