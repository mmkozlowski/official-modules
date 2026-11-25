export const metadata = {
  requireAuth: true,
  navHidden: true,
  requireFeatures: ['production_planning.create'],
  pageTitle: 'New production order',
  pageTitleKey: 'production_planning.orders.create.title',
  breadcrumb: [
    { label: 'Production orders', labelKey: 'production_planning.orders.list.title', href: '/backend/production-planning/orders' },
    { label: 'New production order', labelKey: 'production_planning.orders.create.title' },
  ],
}

export default metadata
