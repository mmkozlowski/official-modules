import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

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
}

export default setup
