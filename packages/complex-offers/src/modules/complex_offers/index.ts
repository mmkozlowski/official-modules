import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'complex_offers',
  title: 'Complex Offers',
  version: '0.1.0',
  description:
    'Offers for made-to-order furniture — configurable models with pricing rules, lines priced from parameters with a price breakdown, versions and a status flow that freezes a sent version.',
  author: 'Open Mercato Community',
  ejectable: true,
}

export { features } from './acl'

export default metadata
