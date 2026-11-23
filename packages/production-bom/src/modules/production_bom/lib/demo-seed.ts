import type { EntityManager } from '@mikro-orm/postgresql'
import { BomLine, Material, Product, type MaterialType, type MaterialUnit, type ProductType } from '../data/entities'
import { quantityFromSegments } from './bom-calculations'

/**
 * Example data for a small upholstery and garden-furniture workshop.
 *
 * Everything here is invented: names are generic, prices are round made-up
 * numbers. It exists so a fresh tenant shows a working BOM, not to model any
 * real supplier or price list.
 */
type MaterialSeed = {
  key: string
  name: string
  code: string
  materialType: MaterialType
  unit: MaterialUnit
  unitPrice: string
  wastePercent?: string
}

const MATERIALS: MaterialSeed[] = [
  { key: 'foamSeat45', name: 'Gąbka T25 45×45×5 cm', code: 'GA-T25-45', materialType: 'foam', unit: 'pcs', unitPrice: '18.40' },
  { key: 'foamInlet50', name: 'Gąbka T35 50×50×8 cm', code: 'GA-T35-50', materialType: 'foam', unit: 'pcs', unitPrice: '31.20' },
  { key: 'foamBench', name: 'Gąbka T25 120×60×8 cm', code: 'GA-T25-120', materialType: 'foam', unit: 'pcs', unitPrice: '64.00' },
  { key: 'zipper', name: 'Zamek spiralny 5 mm (metraż)', code: 'ZA-5-MB', materialType: 'zipper', unit: 'm', unitPrice: '2.10', wastePercent: '5' },
  { key: 'slider', name: 'Suwak do zamka 5 mm', code: 'ZA-5-SUW', materialType: 'zipper', unit: 'pcs', unitPrice: '0.45' },
  { key: 'cord', name: 'Sznurek ozdobny 6 mm', code: 'AK-SZN-6', materialType: 'accessory', unit: 'm', unitPrice: '1.30', wastePercent: '5' },
  { key: 'thread', name: 'Nici poliestrowe outdoor', code: 'AK-NICI', materialType: 'accessory', unit: 'kg', unitPrice: '89.00' },
  { key: 'velcro', name: 'Rzep 20 mm', code: 'AK-RZEP-20', materialType: 'accessory', unit: 'm', unitPrice: '3.60' },
  { key: 'wadding', name: 'Owata 100 g/m²', code: 'AK-OW-100', materialType: 'accessory', unit: 'm2', unitPrice: '4.80', wastePercent: '10' },
  { key: 'bag', name: 'Worek foliowy 60×60 cm', code: 'OP-WOR-60', materialType: 'packaging', unit: 'pcs', unitPrice: '0.35' },
  { key: 'box', name: 'Karton 130×90×15 cm', code: 'OP-KAR-130', materialType: 'packaging', unit: 'pcs', unitPrice: '14.90' },
  { key: 'frame', name: 'Stelaż stołu aluminiowy 120×80 cm', code: 'ME-STEL-120', materialType: 'other', unit: 'pcs', unitPrice: '410.00' },
  { key: 'plank', name: 'Deska ogrodowa akacja 120×9 cm', code: 'ME-DES-120', materialType: 'other', unit: 'pcs', unitPrice: '27.50', wastePercent: '5' },
  { key: 'screw', name: 'Wkręt nierdzewny 4×30 mm', code: 'ME-WKR-430', materialType: 'accessory', unit: 'pcs', unitPrice: '0.12' },
  { key: 'oil', name: 'Olej do drewna ogrodowego', code: 'ME-OLEJ', materialType: 'other', unit: 'kg', unitPrice: '48.00' },
  { key: 'fabricGrey', name: 'Tkanina outdoor szara', code: 'TK-OUT-SZA', materialType: 'fabric', unit: 'm', unitPrice: '38.50', wastePercent: '10' },
  { key: 'fabricBeige', name: 'Tkanina outdoor beżowa', code: 'TK-OUT-BEZ', materialType: 'fabric', unit: 'm', unitPrice: '41.00', wastePercent: '10' },
  { key: 'fabricStripe', name: 'Tkanina outdoor grafit w paski', code: 'TK-OUT-PAS', materialType: 'fabric', unit: 'm', unitPrice: '46.00', wastePercent: '12' },
]

type LineSeed = { material: string; quantity?: string; pieces?: [number, string] }

type ProductSeed = {
  name: string
  code: string
  productType: ProductType
  laborMinutes: number
  fabricConsumption: string
  description: string
  lines: LineSeed[]
}

const PRODUCTS: ProductSeed[] = [
  {
    name: 'Poduszka na krzesło ogrodowe 45×45',
    code: 'PO-45',
    productType: 'cushion',
    laborMinutes: 18,
    fabricConsumption: '0.55',
    description: 'Poduszka siedziska z zamkiem i wiązaniami do krzesła.',
    lines: [
      { material: 'foamSeat45', quantity: '1' },
      { material: 'zipper', pieces: [1, '0.40'] },
      { material: 'slider', quantity: '1' },
      { material: 'cord', pieces: [4, '0.5'] },
      { material: 'thread', quantity: '0.004' },
      { material: 'bag', quantity: '1' },
    ],
  },
  {
    name: 'Poduszka na ławkę ogrodową 120×60',
    code: 'PO-120',
    productType: 'cushion',
    laborMinutes: 35,
    fabricConsumption: '1.45',
    description: 'Długa poduszka na ławkę, zamek na trzech bokach.',
    lines: [
      { material: 'foamBench', quantity: '1' },
      { material: 'wadding', quantity: '1.6' },
      { material: 'zipper', pieces: [3, '1.40'] },
      { material: 'slider', quantity: '1' },
      { material: 'thread', quantity: '0.009' },
      { material: 'bag', quantity: '1' },
    ],
  },
  {
    name: 'Pokrowiec na poduszkę 50×50',
    code: 'PK-50',
    productType: 'cover',
    laborMinutes: 14,
    fabricConsumption: '0.65',
    description: 'Sam pokrowiec z zamkiem, bez wkładu.',
    lines: [
      { material: 'zipper', pieces: [1, '0.45'] },
      { material: 'slider', quantity: '1' },
      { material: 'thread', quantity: '0.003' },
      { material: 'bag', quantity: '1' },
    ],
  },
  {
    name: 'Wkład do poduszki 50×50',
    code: 'WK-50',
    productType: 'inlet',
    laborMinutes: 8,
    fabricConsumption: '0',
    description: 'Wkład z gąbki owinięty owatą.',
    lines: [
      { material: 'foamInlet50', quantity: '1' },
      { material: 'wadding', quantity: '0.6' },
      { material: 'thread', quantity: '0.002' },
    ],
  },
  {
    name: 'Stół ogrodowy 120×80',
    code: 'ST-120',
    productType: 'furniture',
    laborMinutes: 95,
    fabricConsumption: '0',
    description: 'Stół z blatem z desek na stelażu aluminiowym.',
    lines: [
      { material: 'frame', quantity: '1' },
      { material: 'plank', quantity: '9' },
      { material: 'screw', quantity: '36' },
      { material: 'oil', quantity: '0.08' },
      { material: 'box', quantity: '1' },
    ],
  },
]

/**
 * Seeds the example catalogue once per organisation. Idempotent: an
 * organisation that already has any material is left untouched, so re-running
 * init never duplicates or overwrites someone's edits.
 */
export async function seedProductionBomExamples(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
): Promise<{ seeded: boolean; materials: number; products: number }> {
  const existing = await em.count(Material, { tenantId: scope.tenantId, organizationId: scope.organizationId })
  if (existing > 0) return { seeded: false, materials: 0, products: 0 }

  const materialIds = new Map<string, string>()
  for (const seed of MATERIALS) {
    const material = em.create(Material, {
      organizationId: scope.organizationId,
      tenantId: scope.tenantId,
      name: seed.name,
      code: seed.code,
      materialType: seed.materialType,
      unit: seed.unit,
      unitPrice: seed.unitPrice,
      wastePercent: seed.wastePercent ?? '0',
      currencyCode: 'PLN',
      isActive: true,
    } as never)
    em.persist(material)
    await em.flush()
    materialIds.set(seed.key, (material as Material).id)
  }

  for (const seed of PRODUCTS) {
    const product = em.create(Product, {
      organizationId: scope.organizationId,
      tenantId: scope.tenantId,
      name: seed.name,
      code: seed.code,
      productType: seed.productType,
      laborMinutes: seed.laborMinutes,
      fabricConsumption: seed.fabricConsumption,
      description: seed.description,
      isActive: true,
    } as never) as Product
    em.persist(product)
    await em.flush()
    seed.lines.forEach((line, position) => {
      const materialId = materialIds.get(line.material)
      if (!materialId) throw new Error(`Unknown seed material ${line.material}`)
      em.persist(
        em.create(BomLine, {
          organizationId: scope.organizationId,
          tenantId: scope.tenantId,
          productId: product.id,
          materialId,
          quantity: line.pieces ? quantityFromSegments(line.pieces[0], line.pieces[1]) : (line.quantity as string),
          segmentCount: line.pieces ? line.pieces[0] : null,
          segmentLength: line.pieces ? line.pieces[1] : null,
          position,
        } as never),
      )
    })
    await em.flush()
  }

  return { seeded: true, materials: MATERIALS.length, products: PRODUCTS.length }
}
