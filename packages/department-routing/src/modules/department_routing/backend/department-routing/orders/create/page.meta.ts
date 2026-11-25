export const metadata = {
  requireAuth: true,
  navHidden: true,
  requireFeatures: ['department_routing.create'],
  pageTitle: 'New order',
  pageTitleKey: 'department_routing.orders.create.title',
  breadcrumb: [
    { label: 'Production orders', labelKey: 'department_routing.orders.list.title', href: '/backend/department-routing/orders' },
    { label: 'New order', labelKey: 'department_routing.orders.create.title' },
  ],
}

export default metadata
