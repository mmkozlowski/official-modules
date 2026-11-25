export const metadata = {
  requireAuth: true,
  navHidden: true,
  requireFeatures: ['department_routing.create'],
  pageTitle: 'New product',
  pageTitleKey: 'department_routing.products.create.title',
  breadcrumb: [
    { label: 'Product routing', labelKey: 'department_routing.products.list.title', href: '/backend/department-routing/products' },
    { label: 'New product', labelKey: 'department_routing.products.create.title' },
  ],
}

export default metadata
