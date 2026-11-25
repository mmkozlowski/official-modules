import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'
import { seedComplexOffersExamples } from './lib/demo-seed'

const ALL_FEATURES = [
  'complex_offers.view',
  'complex_offers.create',
  'complex_offers.edit',
  'complex_offers.delete',
  'complex_offers.manage_pricing',
]

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ALL_FEATURES,
    admin: ALL_FEATURES,
    employee: ['complex_offers.view', 'complex_offers.create', 'complex_offers.edit'],
  },
  /** Example models and offers for a fresh tenant (`mercato init` with examples). Idempotent. */
  seedExamples: async ({ em, tenantId, organizationId }) => {
    await seedComplexOffersExamples(em, { tenantId, organizationId })
  },
}

export default setup
