import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'department_routing',
  title: 'Department Routing',
  version: '0.1.0',
  description:
    'Make-to-order orders split into department tasks by product routing — departments report done quantities and the order status recomputes itself.',
  author: 'Open Mercato Community',
  ejectable: true,
}

export { features } from './acl'

export default metadata
