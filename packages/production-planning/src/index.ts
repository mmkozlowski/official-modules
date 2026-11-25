// Barrel for @open-mercato/production-planning
export { metadata, features } from './modules/production_planning/index'
export { eventsConfig as productionPlanningEventsConfig, emitProductionPlanningEvent } from './modules/production_planning/events'
export type { ProductionPlanningEventId } from './modules/production_planning/events'
export { computePlan, scheduleOrder } from './modules/production_planning/lib/schedule'
