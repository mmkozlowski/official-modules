export const metadata = {
  requireAuth: true,
  navHidden: true,
  requireFeatures: ['production_planning.view'],
  pageTitle: 'Production order',
  pageTitleKey: 'production_planning.orders.detail.title',
  breadcrumb: [
    { label: 'Production orders', labelKey: 'production_planning.orders.list.title', href: '/backend/production-planning/orders' },
    { label: 'Production order', labelKey: 'production_planning.orders.detail.title' },
  ],
}

export default metadata
