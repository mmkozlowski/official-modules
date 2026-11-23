export const metadata = {
  requireAuth: true,
  navHidden: true,
  requireFeatures: ['production_bom.view'],
  pageTitle: 'Product',
  pageTitleKey: 'production_bom.products.detail.title',
  breadcrumb: [
    { label: 'Products (BOM)', labelKey: 'production_bom.products.list.title', href: '/backend/production-bom/products' },
    { label: 'Product', labelKey: 'production_bom.products.detail.title' },
  ],
}

export default metadata
