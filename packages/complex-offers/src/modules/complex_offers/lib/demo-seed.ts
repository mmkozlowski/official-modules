import type { EntityManager } from '@mikro-orm/postgresql'
import {
  Offer,
  OfferLine,
  OfferVersion,
  PricedModel,
  PricedModelOption,
  type VersionStatus,
} from '../data/entities'
import type { ParameterKind, QuantityDiscount } from './pricing'
import { applyPricing, priceForModel, refreshTotals, toPricingModel } from './offer-repository'

/**
 * Example data for the same small garden-furniture and upholstery workshop as
 * the production BOM demo: the models point at the BOM products by code
 * (PO-120, PO-45, ST-120) and the fabrics carry the BOM's fabric prices.
 *
 * Everything is invented: customer names are generic, prices are round
 * made-up numbers, there are no people. It exists so a fresh tenant shows a
 * working offer flow, not to model any real price list.
 */
type OptionSeed = {
  key: string
  kind: ParameterKind
  label: string
  surcharge?: string
  sizeFactor?: string
  fabricPricePerMeter?: string
  isDefault?: boolean
}

type ModelSeed = {
  key: string
  name: string
  code: string
  description: string
  basePrice: string
  marginPercent: string
  bomProductCode: string
  bomMaterialCost: string
  fabricConsumption: string
  quantityDiscounts: QuantityDiscount[]
  options: OptionSeed[]
}

const FABRICS: OptionSeed[] = [
  { key: 'fabricGrey', kind: 'fabric', label: 'Tkanina outdoor szara', fabricPricePerMeter: '38.50', isDefault: true },
  { key: 'fabricBeige', kind: 'fabric', label: 'Tkanina outdoor beżowa', fabricPricePerMeter: '41.00' },
  { key: 'fabricStripe', kind: 'fabric', label: 'Tkanina outdoor grafit w paski', fabricPricePerMeter: '46.00' },
]

export const DEMO_MODELS: ModelSeed[] = [
  {
    key: 'bench',
    name: 'Poduszka na ławkę na wymiar',
    code: 'OF-PO-LAW',
    description: 'Poduszka na ławkę ogrodową szyta na wymiar, zamek na trzech bokach.',
    basePrice: '55.00',
    marginPercent: '35',
    bomProductCode: 'PO-120',
    bomMaterialCost: '82.10',
    fabricConsumption: '1.45',
    quantityDiscounts: [
      { minQuantity: 10, percent: 3 },
      { minQuantity: 25, percent: 5 },
      { minQuantity: 50, percent: 8 },
    ],
    options: [
      { key: 'size120', kind: 'size', label: '120 × 60 cm', sizeFactor: '1', isDefault: true },
      { key: 'size150', kind: 'size', label: '150 × 60 cm', surcharge: '10.00', sizeFactor: '1.25' },
      { key: 'size180', kind: 'size', label: '180 × 60 cm', surcharge: '20.00', sizeFactor: '1.5' },
      ...FABRICS,
      { key: 'pipingSame', kind: 'color', label: 'Lamówka w kolorze tkaniny', isDefault: true },
      { key: 'pipingBlack', kind: 'color', label: 'Lamówka kontrastowa czarna', surcharge: '8.00' },
      { key: 'ties', kind: 'addon', label: 'Wiązania do ławki', surcharge: '6.00' },
      { key: 'quickDry', kind: 'addon', label: 'Gąbka szybkoschnąca', surcharge: '38.00' },
      { key: 'impregnation', kind: 'addon', label: 'Impregnacja hydrofobowa', surcharge: '12.00' },
    ],
  },
  {
    key: 'chair',
    name: 'Poduszka na krzesło na wymiar',
    code: 'OF-PO-KRZ',
    description: 'Poduszka siedziska z zamkiem, w trzech rozmiarach.',
    basePrice: '22.00',
    marginPercent: '40',
    bomProductCode: 'PO-45',
    bomMaterialCost: '23.00',
    fabricConsumption: '0.55',
    quantityDiscounts: [
      { minQuantity: 20, percent: 4 },
      { minQuantity: 50, percent: 7 },
      { minQuantity: 100, percent: 10 },
    ],
    options: [
      { key: 'size40', kind: 'size', label: '40 × 40 cm', sizeFactor: '0.85' },
      { key: 'size45', kind: 'size', label: '45 × 45 cm', sizeFactor: '1', isDefault: true },
      { key: 'size50', kind: 'size', label: '50 × 50 cm', surcharge: '4.00', sizeFactor: '1.2' },
      ...FABRICS,
      { key: 'ties', kind: 'addon', label: 'Wiązania do krzesła', surcharge: '3.00' },
      { key: 'quickDry', kind: 'addon', label: 'Gąbka szybkoschnąca', surcharge: '14.00' },
    ],
  },
  {
    key: 'table',
    name: 'Stół ogrodowy na wymiar',
    code: 'OF-ST-WYM',
    description: 'Stół z blatem z desek akacjowych na stelażu aluminiowym.',
    basePrice: '160.00',
    marginPercent: '30',
    bomProductCode: 'ST-120',
    bomMaterialCost: '680.56',
    fabricConsumption: '0',
    quantityDiscounts: [
      { minQuantity: 5, percent: 3 },
      { minQuantity: 10, percent: 6 },
    ],
    options: [
      { key: 'size120', kind: 'size', label: '120 × 80 cm', sizeFactor: '1', isDefault: true },
      { key: 'size160', kind: 'size', label: '160 × 90 cm', surcharge: '40.00', sizeFactor: '1.35' },
      { key: 'size200', kind: 'size', label: '200 × 100 cm', surcharge: '80.00', sizeFactor: '1.7' },
      { key: 'frameAnthracite', kind: 'color', label: 'Stelaż antracyt', isDefault: true },
      { key: 'frameWhite', kind: 'color', label: 'Stelaż biały' },
      { key: 'frameRal', kind: 'color', label: 'Stelaż w kolorze RAL na zamówienie', surcharge: '180.00' },
      { key: 'umbrella', kind: 'addon', label: 'Otwór na parasol', surcharge: '35.00' },
      { key: 'cover', kind: 'addon', label: 'Pokrowiec zimowy', surcharge: '120.00' },
      { key: 'oil', kind: 'addon', label: 'Dodatkowe olejowanie (2 warstwy)', surcharge: '45.00' },
    ],
  },
]

type LineSeed = { model: string; quantity: number; size?: string; fabric?: string; color?: string; addons?: string[] }
type VersionSeed = { status: VersionStatus; daysAgo: number; lines: LineSeed[] }
type OfferSeed = {
  title: string
  customerName: string
  contactPerson: string | null
  validInDays: number
  notes: string | null
  versions: VersionSeed[]
}

/**
 * The first offer is the one the recording uses: v1 was SENT, the customer
 * asks for another fabric, a v2 is made and re-priced while v1 stays frozen.
 */
export const DEMO_OFFERS: OfferSeed[] = [
  {
    title: 'Meble i poduszki na taras',
    customerName: 'Pensjonat Leśna Polana',
    contactPerson: 'Dział zakupów',
    validInDays: 21,
    notes: 'Termin realizacji: 4 tygodnie od akceptacji. Transport w cenie przy zamówieniu powyżej 5 000 zł netto.',
    versions: [
      {
        status: 'sent',
        daysAgo: 3,
        lines: [
          { model: 'bench', quantity: 24, size: 'size150', fabric: 'fabricGrey', color: 'pipingSame', addons: ['ties'] },
          { model: 'chair', quantity: 48, size: 'size45', fabric: 'fabricGrey', addons: ['ties'] },
          { model: 'table', quantity: 6, size: 'size160', color: 'frameAnthracite', addons: ['umbrella'] },
        ],
      },
    ],
  },
  {
    title: 'Poduszki na krzesła ogrodowe',
    customerName: 'Restauracja Taras nad Rzeką',
    contactPerson: 'Kierownik sali',
    validInDays: 14,
    notes: null,
    versions: [
      {
        status: 'sent',
        daysAgo: 12,
        lines: [{ model: 'chair', quantity: 40, size: 'size45', fabric: 'fabricBeige', addons: ['ties'] }],
      },
      {
        status: 'accepted',
        daysAgo: 6,
        lines: [{ model: 'chair', quantity: 60, size: 'size45', fabric: 'fabricBeige', addons: ['ties', 'quickDry'] }],
      },
    ],
  },
  {
    title: 'Zestawy na sezon 2027',
    customerName: 'Sklep Dom i Ogród (hurt)',
    contactPerson: null,
    validInDays: 30,
    notes: 'Wycena wstępna — ilości do potwierdzenia.',
    versions: [
      {
        status: 'draft',
        daysAgo: 1,
        lines: [
          { model: 'chair', quantity: 100, size: 'size45', fabric: 'fabricStripe', addons: ['ties'] },
          { model: 'bench', quantity: 20, size: 'size120', fabric: 'fabricStripe' },
        ],
      },
    ],
  },
  {
    title: 'Stoliki do ogródka kawiarni',
    customerName: 'Kawiarnia Pod Kasztanem',
    contactPerson: null,
    validInDays: -5,
    notes: null,
    versions: [
      {
        status: 'rejected',
        daysAgo: 20,
        lines: [{ model: 'table', quantity: 4, size: 'size120', color: 'frameRal', addons: ['cover'] }],
      },
    ],
  },
]

const DAY = 24 * 60 * 60 * 1000

/**
 * Seeds the example models and offers once per organisation. Idempotent: an
 * organisation that already has any priced model is left untouched.
 */
export async function seedComplexOffersExamples(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
  now: Date = new Date(),
): Promise<{ seeded: boolean; models: number; offers: number }> {
  const existing = await em.count(PricedModel, { tenantId: scope.tenantId, organizationId: scope.organizationId })
  if (existing > 0) return { seeded: false, models: 0, offers: 0 }

  const models = new Map<string, { model: PricedModel; optionIds: Map<string, string> }>()
  const allOptions: PricedModelOption[] = []
  for (const seed of DEMO_MODELS) {
    const model = em.create(PricedModel, {
      ...scope,
      name: seed.name,
      code: seed.code,
      description: seed.description,
      basePrice: seed.basePrice,
      marginPercent: seed.marginPercent,
      bomProductCode: seed.bomProductCode,
      bomMaterialCost: seed.bomMaterialCost,
      bomCostRefreshedAt: now,
      fabricConsumption: seed.fabricConsumption,
      quantityDiscounts: seed.quantityDiscounts,
      currencyCode: 'PLN',
      isActive: true,
    } as never) as PricedModel
    em.persist(model)
    await em.flush()
    const optionIds = new Map<string, string>()
    seed.options.forEach((option, position) => {
      const entity = em.create(PricedModelOption, {
        ...scope,
        modelId: model.id,
        kind: option.kind,
        label: option.label,
        surcharge: option.surcharge ?? '0',
        sizeFactor: option.sizeFactor ?? '1',
        fabricPricePerMeter: option.fabricPricePerMeter ?? '0',
        isDefault: option.isDefault ?? false,
        position,
      } as never) as PricedModelOption
      em.persist(entity)
      allOptions.push(entity)
    })
    await em.flush()
    for (const [index, option] of seed.options.entries()) {
      optionIds.set(option.key, allOptions[allOptions.length - seed.options.length + index].id)
    }
    models.set(seed.key, { model, optionIds })
  }

  const year = now.getFullYear()
  for (const [offerIndex, seed] of DEMO_OFFERS.entries()) {
    const firstVersion = seed.versions[0]
    const offer = em.create(Offer, {
      ...scope,
      number: `OF/${year}/${String(offerIndex + 1).padStart(4, '0')}`,
      title: seed.title,
      customerName: seed.customerName,
      contactPerson: seed.contactPerson,
      validUntil: new Date(now.getTime() + seed.validInDays * DAY),
      notes: seed.notes,
      currencyCode: 'PLN',
      createdAt: new Date(now.getTime() - (firstVersion?.daysAgo ?? 0) * DAY),
    } as never) as Offer
    em.persist(offer)
    await em.flush()

    let previousVersionId: string | null = null
    for (const [versionIndex, versionSeed] of seed.versions.entries()) {
      const at = new Date(now.getTime() - versionSeed.daysAgo * DAY)
      const version = em.create(OfferVersion, {
        ...scope,
        offerId: offer.id,
        versionNumber: versionIndex + 1,
        status: versionSeed.status,
        sourceVersionId: previousVersionId,
        sentAt: versionSeed.status === 'draft' ? null : at,
        decidedAt: versionSeed.status === 'accepted' || versionSeed.status === 'rejected' ? new Date(at.getTime() + DAY) : null,
        createdAt: at,
      } as never) as OfferVersion
      em.persist(version)
      await em.flush()
      versionSeed.lines.forEach((lineSeed, position) => {
        const entry = models.get(lineSeed.model)
        if (!entry) throw new Error(`Unknown seed model ${lineSeed.model}`)
        const pick = (key?: string) => (key ? entry.optionIds.get(key) ?? null : null)
        const pricing = toPricingModel(entry.model, allOptions)
        const priced = priceForModel(
          pricing,
          {
            sizeOptionId: pick(lineSeed.size),
            fabricOptionId: pick(lineSeed.fabric),
            colorOptionId: pick(lineSeed.color),
            addonOptionIds: (lineSeed.addons ?? []).map((key) => pick(key)).filter((id): id is string => Boolean(id)),
          },
          lineSeed.quantity,
        )
        const line = em.create(OfferLine, {
          ...scope,
          offerId: offer.id,
          versionId: version.id,
          modelId: entry.model.id,
          modelName: entry.model.name,
          quantity: lineSeed.quantity,
          position,
        } as never) as OfferLine
        applyPricing(line, priced.pricing, priced.selection)
        em.persist(line)
      })
      await em.flush()
      await refreshTotals(em, scope, version)
      await em.flush()
      previousVersionId = version.id
    }
  }

  return { seeded: true, models: DEMO_MODELS.length, offers: DEMO_OFFERS.length }
}

/** Removes every row of this module in one organisation. Used by the demo reset only. */
export async function clearComplexOffersData(em: EntityManager, scope: { tenantId: string; organizationId: string }) {
  for (const entity of [OfferLine, OfferVersion, Offer, PricedModelOption, PricedModel]) {
    await em.nativeDelete(entity as never, { tenantId: scope.tenantId, organizationId: scope.organizationId } as never)
  }
}
