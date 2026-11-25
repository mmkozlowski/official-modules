// Barrel for @open-mercato/complex-offers
export { metadata, features } from './modules/complex_offers/index'
export { eventsConfig as complexOffersEventsConfig, emitComplexOffersEvent } from './modules/complex_offers/events'
export type { ComplexOffersEventId } from './modules/complex_offers/events'
export {
  priceLine,
  normalizeSelection,
  resolveQuantityDiscount,
  computeVersionTotals,
} from './modules/complex_offers/lib/pricing'
