import { routingIcon } from '../../../components/navIcons'

export const metadata = {
  requireAuth: true,
  requireFeatures: ['department_routing.view'],
  pageTitle: 'Product routing',
  pageTitleKey: 'department_routing.products.list.title',
  pageGroup: 'Production',
  // Same group key as the BOM module, so both live under one "Production" menu.
  pageGroupKey: 'production_bom.nav.group',
  pagePriority: 31,
  pageOrder: 33,
  icon: routingIcon,
  breadcrumb: [{ label: 'Product routing', labelKey: 'department_routing.products.list.title' }],
}

export default metadata
