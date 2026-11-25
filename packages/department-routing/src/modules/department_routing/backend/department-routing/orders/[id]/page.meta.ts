export const metadata = {
  requireAuth: true,
  navHidden: true,
  requireFeatures: ['department_routing.view'],
  pageTitle: 'Order',
  pageTitleKey: 'department_routing.orders.detail.title',
  breadcrumb: [
    { label: 'Production orders', labelKey: 'department_routing.orders.list.title', href: '/backend/department-routing/orders' },
    { label: 'Order', labelKey: 'department_routing.orders.detail.title' },
  ],
}

export default metadata
