export const metadata = {
  requireAuth: true,
  navHidden: true,
  requireFeatures: ['production_planning.create'],
  pageTitle: 'New work centre',
  pageTitleKey: 'production_planning.workCenters.create.title',
  breadcrumb: [
    { label: 'Work centres', labelKey: 'production_planning.workCenters.list.title', href: '/backend/production-planning/work-centers' },
    { label: 'New work centre', labelKey: 'production_planning.workCenters.create.title' },
  ],
}

export default metadata
