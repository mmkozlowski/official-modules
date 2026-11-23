export const metadata = {
  requireAuth: true,
  navHidden: true,
  requireFeatures: ['production_bom.create'],
  pageTitle: 'New product',
  pageTitleKey: 'production_bom.products.create.title',
  breadcrumb: [
    { label: 'Products (BOM)', labelKey: 'production_bom.products.list.title', href: '/backend/production-bom/products' },
    { label: 'New product', labelKey: 'production_bom.products.create.title' },
  ],
}

export default metadata
