import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'production_bom',
  title: 'Production BOM',
  version: '0.1.0',
  description:
    'Bill of materials for furniture and upholstery production — materials, products with a BOM and labour time, material cost and requirements for N units.',
  author: 'Open Mercato Community',
  ejectable: true,
}

export { features } from './acl'

export default metadata
