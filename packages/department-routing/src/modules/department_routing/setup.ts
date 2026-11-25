import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'
import { seedDepartmentRoutingExamples } from './lib/demo-seed'

const ALL_FEATURES = [
  'department_routing.view',
  'department_routing.create',
  'department_routing.edit',
  'department_routing.delete',
  'department_routing.report',
]

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ALL_FEATURES,
    admin: ALL_FEATURES,
    employee: ['department_routing.view', 'department_routing.report'],
  },
  /** Departments, routed products and example orders for a fresh tenant. Idempotent. */
  seedExamples: async ({ em, tenantId, organizationId }) => {
    await seedDepartmentRoutingExamples(em, { tenantId, organizationId })
  },
}

export default setup
