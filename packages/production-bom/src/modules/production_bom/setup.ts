import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'
import { seedProductionBomExamples } from './lib/demo-seed'

const ALL_FEATURES = [
  'production_bom.view',
  'production_bom.create',
  'production_bom.edit',
  'production_bom.delete',
]

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ALL_FEATURES,
    admin: ALL_FEATURES,
  },
  /** Example materials and products for a fresh tenant (`mercato init` with examples). Idempotent. */
  seedExamples: async ({ em, tenantId, organizationId }) => {
    await seedProductionBomExamples(em, { tenantId, organizationId })
  },
}

export default setup
