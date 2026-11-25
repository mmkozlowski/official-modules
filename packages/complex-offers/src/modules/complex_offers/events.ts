import { createModuleEvents } from '@open-mercato/shared/modules/events'

/**
 * Event catalog. Every id is a contract surface — adding is additive, renaming
 * or removing is a breaking change.
 *
 * The lifecycle events are what makes the module measurable without separate
 * analytics: how many versions an offer needs before a decision
 * (`version.created`), the win rate (`version.accepted` / `version.sent`), and
 * how often a line is re-priced by changing a parameter (`line.repriced`) —
 * each of those is a recalculation nobody did by hand.
 */
const events = [
  { id: 'complex_offers.offer.created', label: 'Offer Created', entity: 'offer', category: 'crud' as const },
  { id: 'complex_offers.offer.updated', label: 'Offer Updated', entity: 'offer', category: 'crud' as const },
  { id: 'complex_offers.offer.deleted', label: 'Offer Deleted', entity: 'offer', category: 'crud' as const },
  { id: 'complex_offers.model.created', label: 'Priced Model Created', entity: 'model', category: 'crud' as const },
  { id: 'complex_offers.model.updated', label: 'Priced Model Updated', entity: 'model', category: 'crud' as const },
  { id: 'complex_offers.model.deleted', label: 'Priced Model Deleted', entity: 'model', category: 'crud' as const },
  { id: 'complex_offers.model.rules_updated', label: 'Pricing Rules Updated', entity: 'model', category: 'lifecycle' as const },
  { id: 'complex_offers.version.created', label: 'Offer Version Created', entity: 'version', category: 'lifecycle' as const },
  { id: 'complex_offers.version.sent', label: 'Offer Version Sent', entity: 'version', category: 'lifecycle' as const },
  { id: 'complex_offers.version.accepted', label: 'Offer Version Accepted', entity: 'version', category: 'lifecycle' as const },
  { id: 'complex_offers.version.rejected', label: 'Offer Version Rejected', entity: 'version', category: 'lifecycle' as const },
  { id: 'complex_offers.line.repriced', label: 'Offer Line Repriced', entity: 'line', category: 'lifecycle' as const },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'complex_offers',
  events,
})

export const emitComplexOffersEvent = eventsConfig.emit

export type ComplexOffersEventId = (typeof events)[number]['id']

export default eventsConfig
