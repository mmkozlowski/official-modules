import { ordersIcon } from '../../../components/navIcons'

export const metadata = {
  requireAuth: true,
  requireFeatures: ['department_routing.view'],
  pageTitle: 'Production orders',
  pageTitleKey: 'department_routing.orders.list.title',
  pageGroup: 'Production',
  // Same group key as the BOM module, so both live under one "Production" menu.
  pageGroupKey: 'production_bom.nav.group',
  pagePriority: 31,
  pageOrder: 30,
  icon: ordersIcon,
  breadcrumb: [{ label: 'Production orders', labelKey: 'department_routing.orders.list.title' }],
}

export default metadata
