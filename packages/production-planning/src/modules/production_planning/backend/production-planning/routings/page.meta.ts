import { routingsIcon } from '../../../components/navIcons'

export const metadata = {
  requireAuth: true,
  requireFeatures: ['production_planning.view'],
  pageTitle: 'Routings',
  pageTitleKey: 'production_planning.routings.list.title',
  pageGroup: 'Production',
  pageGroupKey: 'production_bom.nav.group',
  pagePriority: 31,
  pageOrder: 60,
  icon: routingsIcon,
  breadcrumb: [{ label: 'Routings', labelKey: 'production_planning.routings.list.title' }],
}

export default metadata
