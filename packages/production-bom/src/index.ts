// Barrel for @open-mercato/production-bom
export { metadata, features } from './modules/production_bom/index'
export { eventsConfig as productionBomEventsConfig, emitProductionBomEvent } from './modules/production_bom/events'
export type { ProductionBomEventId } from './modules/production_bom/events'
export {
  computeLineCost,
  computeMaterialCost,
  computeRequirements,
  planProductDuplicate,
} from './modules/production_bom/lib/bom-calculations'
