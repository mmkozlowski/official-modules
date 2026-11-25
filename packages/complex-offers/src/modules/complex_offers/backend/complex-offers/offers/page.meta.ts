import { offersIcon } from '../../../components/navIcons'

export const metadata = {
  requireAuth: true,
  requireFeatures: ['complex_offers.view'],
  pageTitle: 'Offers',
  pageTitleKey: 'complex_offers.offers.list.title',
  pageGroup: 'Offers',
  pageGroupKey: 'complex_offers.nav.group',
  pagePriority: 32,
  pageOrder: 10,
  icon: offersIcon,
  breadcrumb: [{ label: 'Offers', labelKey: 'complex_offers.offers.list.title' }],
}

export default metadata
