export const metadata = {
  requireAuth: true,
  navHidden: true,
  requireFeatures: ['production_bom.view'],
  pageTitle: 'Material',
  pageTitleKey: 'production_bom.materials.edit.title',
  breadcrumb: [
    { label: 'Materials', labelKey: 'production_bom.materials.list.title', href: '/backend/production-bom/materials' },
    { label: 'Material', labelKey: 'production_bom.materials.edit.title' },
  ],
}

export default metadata
