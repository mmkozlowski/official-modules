export const metadata = {
  requireAuth: true,
  navHidden: true,
  requireFeatures: ['production_bom.create'],
  pageTitle: 'New material',
  pageTitleKey: 'production_bom.materials.create.title',
  breadcrumb: [
    { label: 'Materials', labelKey: 'production_bom.materials.list.title', href: '/backend/production-bom/materials' },
    { label: 'New material', labelKey: 'production_bom.materials.create.title' },
  ],
}

export default metadata
