import { workCentersIcon } from '../../../components/navIcons'

export const metadata = {
  requireAuth: true,
  requireFeatures: ['production_planning.view'],
  pageTitle: 'Work centres',
  pageTitleKey: 'production_planning.workCenters.list.title',
  pageGroup: 'Production',
  pageGroupKey: 'production_bom.nav.group',
  pagePriority: 31,
  pageOrder: 50,
  icon: workCentersIcon,
  breadcrumb: [{ label: 'Work centres', labelKey: 'production_planning.workCenters.list.title' }],
}

export default metadata
