export const metadata = {
  requireAuth: true,
  navHidden: true,
  requireFeatures: ['department_routing.view'],
  pageTitle: 'Product',
  pageTitleKey: 'department_routing.products.detail.title',
  breadcrumb: [
    { label: 'Product routing', labelKey: 'department_routing.products.list.title', href: '/backend/department-routing/products' },
    { label: 'Product', labelKey: 'department_routing.products.detail.title' },
  ],
}

export default metadata
