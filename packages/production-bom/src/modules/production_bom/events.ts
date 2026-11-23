import { createModuleEvents } from '@open-mercato/shared/modules/events'

/**
 * Event catalog. Every id is a contract surface — adding is additive, renaming
 * or removing is a breaking change.
 *
 * `product.duplicated` and `product.bom_updated` make the module's value
 * measurable without separate analytics: how often a new product starts as a
 * copy rather than from scratch, and how often a BOM is reworked.
 */
const events = [
  { id: 'production_bom.material.created', label: 'Material Created', entity: 'material', category: 'crud' as const },
  { id: 'production_bom.material.updated', label: 'Material Updated', entity: 'material', category: 'crud' as const },
  { id: 'production_bom.material.deleted', label: 'Material Deleted', entity: 'material', category: 'crud' as const },
  { id: 'production_bom.product.created', label: 'Product Created', entity: 'product', category: 'crud' as const },
  { id: 'production_bom.product.updated', label: 'Product Updated', entity: 'product', category: 'crud' as const },
  { id: 'production_bom.product.deleted', label: 'Product Deleted', entity: 'product', category: 'crud' as const },
  {
    id: 'production_bom.product.bom_updated',
    label: 'Product BOM Updated',
    entity: 'product',
    category: 'lifecycle' as const,
  },
  {
    id: 'production_bom.product.duplicated',
    label: 'Product Duplicated',
    entity: 'product',
    category: 'lifecycle' as const,
  },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'production_bom',
  events,
})

export const emitProductionBomEvent = eventsConfig.emit

export type ProductionBomEventId = (typeof events)[number]['id']

export default eventsConfig
