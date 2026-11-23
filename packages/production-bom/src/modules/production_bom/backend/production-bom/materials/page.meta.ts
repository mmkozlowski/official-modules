import { materialsIcon } from '../../../components/navIcons'

export const metadata = {
  requireAuth: true,
  requireFeatures: ['production_bom.view'],
  pageTitle: 'Materials',
  pageTitleKey: 'production_bom.materials.list.title',
  pageGroup: 'Production',
  pageGroupKey: 'production_bom.nav.group',
  pagePriority: 40,
  pageOrder: 20,
  icon: materialsIcon,
  breadcrumb: [{ label: 'Materials', labelKey: 'production_bom.materials.list.title' }],
}

export default metadata
