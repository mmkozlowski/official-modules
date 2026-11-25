import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'production_planning',
  title: 'Production planning',
  version: '0.1.0',
  description:
    'Production orders scheduled backwards from their due date through product routings onto work centres with daily capacity — plan, work-centre load and material requirements from the BOM.',
  author: 'Open Mercato Community',
  requires: ['production_bom'],
  ejectable: true,
}

export { features } from './acl'

export default metadata
