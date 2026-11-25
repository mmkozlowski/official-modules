import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'
import { seedProductionPlanningExamples } from './lib/demo-seed'

const ALL_FEATURES = [
  'production_planning.view',
  'production_planning.create',
  'production_planning.edit',
  'production_planning.delete',
]

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ALL_FEATURES,
    admin: ALL_FEATURES,
  },
  /**
   * Example work centres, routings and orders for a fresh tenant. Runs after
   * `production_bom` (declared in `requires`), because routings and orders point
   * at its products. Idempotent.
   */
  seedExamples: async ({ em, tenantId, organizationId }) => {
    await seedProductionPlanningExamples(em, { tenantId, organizationId })
  },
}

export default setup
