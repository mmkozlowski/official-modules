import { boardIcon } from '../../../components/navIcons'

export const metadata = {
  requireAuth: true,
  requireFeatures: ['department_routing.view'],
  pageTitle: 'Department board',
  pageTitleKey: 'department_routing.board.title',
  pageGroup: 'Production',
  // Same group key as the BOM module, so both live under one "Production" menu.
  pageGroupKey: 'production_bom.nav.group',
  pagePriority: 31,
  pageOrder: 31,
  icon: boardIcon,
  breadcrumb: [{ label: 'Department board', labelKey: 'department_routing.board.title' }],
}

export default metadata
