export const metadata = {
  requireAuth: true,
  navHidden: true,
  requireFeatures: ['complex_offers.create'],
  pageTitle: 'New offer',
  pageTitleKey: 'complex_offers.offers.create.title',
  breadcrumb: [
    { label: 'Offers', labelKey: 'complex_offers.offers.list.title', href: '/backend/complex-offers/offers' },
    { label: 'New offer', labelKey: 'complex_offers.offers.create.title' },
  ],
}

export default metadata
