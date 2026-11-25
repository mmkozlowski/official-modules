import { planIcon } from '../../../components/navIcons'

export const metadata = {
  requireAuth: true,
  requireFeatures: ['production_planning.view'],
  pageTitle: 'Production plan',
  pageTitleKey: 'production_planning.plan.title',
  pageGroup: 'Production',
  pageGroupKey: 'production_bom.nav.group',
  pagePriority: 31,
  pageOrder: 30,
  icon: planIcon,
  breadcrumb: [{ label: 'Production plan', labelKey: 'production_planning.plan.title' }],
}

export default metadata
