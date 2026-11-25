export const metadata = {
  requireAuth: true,
  navHidden: true,
  requireFeatures: ['production_planning.view'],
  pageTitle: 'Work centre',
  pageTitleKey: 'production_planning.workCenters.detail.title',
  breadcrumb: [
    { label: 'Work centres', labelKey: 'production_planning.workCenters.list.title', href: '/backend/production-planning/work-centers' },
    { label: 'Work centre', labelKey: 'production_planning.workCenters.detail.title' },
  ],
}

export default metadata
