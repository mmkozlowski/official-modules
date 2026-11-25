export const metadata = {
  requireAuth: true,
  navHidden: true,
  requireFeatures: ['complex_offers.manage_pricing'],
  pageTitle: 'New model',
  pageTitleKey: 'complex_offers.models.create.title',
  breadcrumb: [
    { label: 'Models and price lists', labelKey: 'complex_offers.models.list.title', href: '/backend/complex-offers/models' },
    { label: 'New model', labelKey: 'complex_offers.models.create.title' },
  ],
}

export default metadata
