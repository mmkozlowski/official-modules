import { modelsIcon } from '../../../components/navIcons'

export const metadata = {
  requireAuth: true,
  requireFeatures: ['complex_offers.view'],
  pageTitle: 'Models and price lists',
  pageTitleKey: 'complex_offers.models.list.title',
  pageGroup: 'Offers',
  pageGroupKey: 'complex_offers.nav.group',
  pagePriority: 32,
  pageOrder: 20,
  icon: modelsIcon,
  breadcrumb: [{ label: 'Models and price lists', labelKey: 'complex_offers.models.list.title' }],
}

export default metadata
