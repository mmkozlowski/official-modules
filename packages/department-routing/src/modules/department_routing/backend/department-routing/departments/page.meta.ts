import { departmentsIcon } from '../../../components/navIcons'

export const metadata = {
  requireAuth: true,
  requireFeatures: ['department_routing.view'],
  pageTitle: 'Departments',
  pageTitleKey: 'department_routing.departments.list.title',
  pageGroup: 'Production',
  // Same group key as the BOM module, so both live under one "Production" menu.
  pageGroupKey: 'production_bom.nav.group',
  pagePriority: 31,
  pageOrder: 32,
  icon: departmentsIcon,
  breadcrumb: [{ label: 'Departments', labelKey: 'department_routing.departments.list.title' }],
}

export default metadata
