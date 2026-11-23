import { productsIcon } from '../../../components/navIcons'

export const metadata = {
  requireAuth: true,
  requireFeatures: ['production_bom.view'],
  pageTitle: 'Products (BOM)',
  pageTitleKey: 'production_bom.products.list.title',
  pageGroup: 'Production',
  pageGroupKey: 'production_bom.nav.group',
  pagePriority: 40,
  pageOrder: 10,
  icon: productsIcon,
  breadcrumb: [{ label: 'Products (BOM)', labelKey: 'production_bom.products.list.title' }],
}

export default metadata
