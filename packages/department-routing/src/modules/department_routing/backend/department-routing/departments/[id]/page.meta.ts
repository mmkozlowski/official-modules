export const metadata = {
  requireAuth: true,
  navHidden: true,
  requireFeatures: ['department_routing.view'],
  pageTitle: 'Department',
  pageTitleKey: 'department_routing.departments.detail.title',
  breadcrumb: [
    { label: 'Departments', labelKey: 'department_routing.departments.list.title', href: '/backend/department-routing/departments' },
    { label: 'Department', labelKey: 'department_routing.departments.detail.title' },
  ],
}

export default metadata
