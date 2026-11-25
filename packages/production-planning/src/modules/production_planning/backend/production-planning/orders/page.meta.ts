import { ordersIcon } from '../../../components/navIcons'

export const metadata = {
  requireAuth: true,
  requireFeatures: ['production_planning.view'],
  pageTitle: 'Production orders',
  pageTitleKey: 'production_planning.orders.list.title',
  pageGroup: 'Production',
  pageGroupKey: 'production_bom.nav.group',
  pagePriority: 31,
  pageOrder: 40,
  icon: ordersIcon,
  breadcrumb: [{ label: 'Production orders', labelKey: 'production_planning.orders.list.title' }],
}

export default metadata
