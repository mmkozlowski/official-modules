export const metadata = {
  requireAuth: true,
  navHidden: true,
  requireFeatures: ['production_planning.view'],
  pageTitle: 'Routing',
  pageTitleKey: 'production_planning.routings.detail.title',
  breadcrumb: [
    { label: 'Routings', labelKey: 'production_planning.routings.list.title', href: '/backend/production-planning/routings' },
    { label: 'Routing', labelKey: 'production_planning.routings.detail.title' },
  ],
}

export default metadata
