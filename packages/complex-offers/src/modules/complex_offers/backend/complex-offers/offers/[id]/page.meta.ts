export const metadata = {
  requireAuth: true,
  navHidden: true,
  requireFeatures: ['complex_offers.view'],
  pageTitle: 'Offer',
  pageTitleKey: 'complex_offers.offers.detail.title',
  breadcrumb: [
    { label: 'Offers', labelKey: 'complex_offers.offers.list.title', href: '/backend/complex-offers/offers' },
    { label: 'Offer', labelKey: 'complex_offers.offers.detail.title' },
  ],
}

export default metadata
