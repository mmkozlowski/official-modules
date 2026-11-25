export const metadata = {
  requireAuth: true,
  navHidden: true,
  requireFeatures: ['department_routing.create'],
  pageTitle: 'New department',
  pageTitleKey: 'department_routing.departments.create.title',
  breadcrumb: [
    { label: 'Departments', labelKey: 'department_routing.departments.list.title', href: '/backend/department-routing/departments' },
    { label: 'New department', labelKey: 'department_routing.departments.create.title' },
  ],
}

export default metadata
