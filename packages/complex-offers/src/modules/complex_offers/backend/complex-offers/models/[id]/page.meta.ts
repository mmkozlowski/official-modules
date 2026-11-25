export const metadata = {
  requireAuth: true,
  navHidden: true,
  requireFeatures: ['complex_offers.view'],
  pageTitle: 'Model',
  pageTitleKey: 'complex_offers.models.detail.title',
  breadcrumb: [
    { label: 'Models and price lists', labelKey: 'complex_offers.models.list.title', href: '/backend/complex-offers/models' },
    { label: 'Model', labelKey: 'complex_offers.models.detail.title' },
  ],
}

export default metadata
