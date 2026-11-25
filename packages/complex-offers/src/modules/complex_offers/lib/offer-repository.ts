import type { EntityManager } from '@mikro-orm/postgresql'
import { Offer, OfferLine, OfferVersion, PricedModel, PricedModelOption, type VersionStatus } from '../data/entities'
import {
  computeVersionTotals,
  normalizeSelection,
  priceLine,
  type LinePricing,
  type LineSelection,
  type PricingModel,
} from './pricing'

export type Scope = { tenantId: string; organizationId: string }

const live = (scope: Scope) => ({ tenantId: scope.tenantId, organizationId: scope.organizationId })

export async function findModelInScope(em: EntityManager, scope: Scope, id: string): Promise<PricedModel | null> {
  return em.findOne(PricedModel, { id, ...live(scope), deletedAt: null })
}

export async function findOfferInScope(em: EntityManager, scope: Scope, id: string): Promise<Offer | null> {
  return em.findOne(Offer, { id, ...live(scope), deletedAt: null })
}

export async function findVersionInScope(em: EntityManager, scope: Scope, id: string): Promise<OfferVersion | null> {
  return em.findOne(OfferVersion, { id, ...live(scope) })
}

export async function loadModelOptions(em: EntityManager, scope: Scope, modelIds: string[]): Promise<PricedModelOption[]> {
  if (!modelIds.length) return []
  return em.find(
    PricedModelOption,
    { modelId: { $in: Array.from(new Set(modelIds)) }, ...live(scope) },
    { orderBy: { modelId: 'asc', position: 'asc' } },
  )
}

export function toPricingModel(model: PricedModel, options: PricedModelOption[]): PricingModel {
  return {
    basePrice: String(model.basePrice),
    bomMaterialCost: String(model.bomMaterialCost),
    fabricConsumption: String(model.fabricConsumption),
    marginPercent: String(model.marginPercent),
    quantityDiscounts: Array.isArray(model.quantityDiscounts) ? model.quantityDiscounts : [],
    currencyCode: model.currencyCode || 'PLN',
    options: options
      .filter((option) => option.modelId === model.id)
      .map((option) => ({
        id: option.id,
        kind: option.kind,
        label: option.label,
        surcharge: String(option.surcharge),
        sizeFactor: String(option.sizeFactor),
        fabricPricePerMeter: String(option.fabricPricePerMeter),
        isDefault: option.isDefault,
      })),
  }
}

export async function loadPricingModel(
  em: EntityManager,
  scope: Scope,
  modelId: string,
): Promise<{ model: PricedModel; pricing: PricingModel } | null> {
  const model = await findModelInScope(em, scope, modelId)
  if (!model) return null
  const options = await loadModelOptions(em, scope, [model.id])
  return { model, pricing: toPricingModel(model, options) }
}

/** Writes a priced result onto a line — the snapshot a sent version keeps. */
export function applyPricing(line: OfferLine, pricing: LinePricing, selection: LineSelection) {
  line.selection = selection
  line.selected = pricing.selected
  line.breakdown = pricing.steps
  line.listUnitPrice = pricing.listUnitPrice
  line.discountPercent = String(pricing.discountPercent)
  line.unitPrice = pricing.unitPrice
  line.lineTotal = pricing.lineTotal
}

export function priceForModel(pricing: PricingModel, selection: LineSelection, quantity: number) {
  const normalized = normalizeSelection(pricing, selection)
  return { selection: normalized, pricing: priceLine(pricing, normalized, quantity) }
}

export async function loadVersionLines(em: EntityManager, scope: Scope, versionIds: string[]): Promise<OfferLine[]> {
  if (!versionIds.length) return []
  return em.find(
    OfferLine,
    { versionId: { $in: versionIds }, ...live(scope) },
    { orderBy: { versionId: 'asc', position: 'asc', createdAt: 'asc' } },
  )
}

/**
 * Recomputes a version's totals from its lines and mirrors the CURRENT
 * version's number, status and value onto the offer row (what the list shows).
 * Call inside the same unit of work as the change, then flush.
 */
export async function refreshTotals(em: EntityManager, scope: Scope, version: OfferVersion): Promise<void> {
  const lines = await em.find(OfferLine, { versionId: version.id, ...live(scope) })
  const totals = computeVersionTotals(lines.map((line) => String(line.lineTotal)))
  version.totalNet = totals.totalNet
  version.vatAmount = totals.vatAmount
  version.totalGross = totals.totalGross
  await syncOfferWithCurrentVersion(em, scope, version.offerId)
}

export async function syncOfferWithCurrentVersion(em: EntityManager, scope: Scope, offerId: string): Promise<void> {
  const offer = await em.findOne(Offer, { id: offerId, ...live(scope) })
  if (!offer) return
  const versions = await em.find(OfferVersion, { offerId, ...live(scope) }, { orderBy: { versionNumber: 'desc' } })
  const current = versions[0]
  if (!current) return
  offer.currentVersionNumber = current.versionNumber
  offer.status = current.status
  offer.totalNet = String(current.totalNet)
}

/** `OF/2026/0007` — sequence per organisation and year, counted from existing numbers. */
export async function nextOfferNumber(em: EntityManager, scope: Scope, now: Date = new Date()): Promise<string> {
  const year = now.getFullYear()
  const prefix = `OF/${year}/`
  const existing = await em.find(Offer, { ...live(scope), number: { $like: `${prefix}%` } }, { fields: ['number'] })
  const highest = existing.reduce((max, offer) => {
    const sequence = Number(String(offer.number).slice(prefix.length))
    return Number.isFinite(sequence) && sequence > max ? sequence : max
  }, 0)
  return `${prefix}${String(highest + 1).padStart(4, '0')}`
}

export function createVersionEntity(
  em: EntityManager,
  scope: Scope,
  offerId: string,
  versionNumber: number,
  sourceVersionId: string | null,
): OfferVersion {
  const version = em.create(OfferVersion, {
    ...live(scope),
    offerId,
    versionNumber,
    status: 'draft' as VersionStatus,
    sourceVersionId,
    totalNet: '0',
    vatAmount: '0',
    totalGross: '0',
  } as never) as OfferVersion
  em.persist(version)
  return version
}

/**
 * New draft version copied from `source`: same models, parameters and
 * quantities, re-priced with the CURRENT pricing rules. The source is not
 * touched — that is the whole point of versioning a sent offer.
 *
 * A line whose model has since been deleted is copied as its snapshot, so a
 * copy never silently loses a position.
 */
export async function copyVersion(em: EntityManager, scope: Scope, source: OfferVersion): Promise<OfferVersion> {
  const latest = await em.findOne(
    OfferVersion,
    { offerId: source.offerId, ...live(scope) },
    { orderBy: { versionNumber: 'desc' } },
  )
  const version = createVersionEntity(em, scope, source.offerId, (latest?.versionNumber ?? source.versionNumber) + 1, source.id)
  await em.flush()

  const lines = await loadVersionLines(em, scope, [source.id])
  const modelIds = Array.from(new Set(lines.map((line) => line.modelId)))
  const models = modelIds.length
    ? await em.find(PricedModel, { id: { $in: modelIds }, ...live(scope), deletedAt: null })
    : []
  const options = await loadModelOptions(em, scope, models.map((model) => model.id))
  const pricingById = new Map(models.map((model) => [model.id, toPricingModel(model, options)]))

  for (const line of lines) {
    const copy = em.create(OfferLine, {
      ...live(scope),
      offerId: source.offerId,
      versionId: version.id,
      modelId: line.modelId,
      modelName: line.modelName,
      quantity: line.quantity,
      selection: line.selection,
      selected: line.selected,
      breakdown: line.breakdown,
      listUnitPrice: String(line.listUnitPrice),
      discountPercent: String(line.discountPercent),
      unitPrice: String(line.unitPrice),
      lineTotal: String(line.lineTotal),
      position: line.position,
    } as never) as OfferLine
    const pricing = pricingById.get(line.modelId)
    if (pricing) {
      const priced = priceForModel(pricing, line.selection ?? {}, line.quantity)
      applyPricing(copy, priced.pricing, priced.selection)
    }
    em.persist(copy)
  }
  await em.flush()
  await refreshTotals(em, scope, version)
  await em.flush()
  return version
}

// ── Views returned by the API ──────────────────────────────────────────────

export type LineView = {
  id: string
  modelId: string
  modelName: string
  quantity: number
  selection: LineSelection
  selected: OfferLine['selected']
  breakdown: OfferLine['breakdown']
  listUnitPrice: string
  discountPercent: string
  unitPrice: string
  lineTotal: string
  position: number
}

export type VersionView = {
  id: string
  versionNumber: number
  status: VersionStatus
  isEditable: boolean
  sourceVersionId: string | null
  totalNet: string
  vatAmount: string
  totalGross: string
  sentAt: string | null
  decidedAt: string | null
  createdAt: string
  lines: LineView[]
}

export type OfferView = {
  id: string
  number: string
  title: string
  customerName: string
  contactPerson: string | null
  validUntil: string | null
  notes: string | null
  status: VersionStatus
  currentVersionNumber: number
  currencyCode: string
  versions: VersionView[]
}

const iso = (value: Date | null | undefined) => (value ? new Date(value).toISOString() : null)

function toLineView(line: OfferLine): LineView {
  return {
    id: line.id,
    modelId: line.modelId,
    modelName: line.modelName,
    quantity: line.quantity,
    selection: line.selection ?? {},
    selected: line.selected ?? [],
    breakdown: line.breakdown ?? [],
    listUnitPrice: String(line.listUnitPrice),
    discountPercent: String(line.discountPercent),
    unitPrice: String(line.unitPrice),
    lineTotal: String(line.lineTotal),
    position: line.position,
  }
}

export async function buildOfferView(em: EntityManager, scope: Scope, offer: Offer): Promise<OfferView> {
  const versions = await em.find(OfferVersion, { offerId: offer.id, ...live(scope) }, { orderBy: { versionNumber: 'asc' } })
  const lines = await loadVersionLines(em, scope, versions.map((version) => version.id))
  return {
    id: offer.id,
    number: offer.number,
    title: offer.title,
    customerName: offer.customerName,
    contactPerson: offer.contactPerson ?? null,
    validUntil: iso(offer.validUntil),
    notes: offer.notes ?? null,
    status: offer.status,
    currentVersionNumber: offer.currentVersionNumber,
    currencyCode: offer.currencyCode || 'PLN',
    versions: versions.map((version) => ({
      id: version.id,
      versionNumber: version.versionNumber,
      status: version.status,
      isEditable: version.status === 'draft',
      sourceVersionId: version.sourceVersionId ?? null,
      totalNet: String(version.totalNet),
      vatAmount: String(version.vatAmount),
      totalGross: String(version.totalGross),
      sentAt: iso(version.sentAt),
      decidedAt: iso(version.decidedAt),
      createdAt: iso(version.createdAt) ?? new Date().toISOString(),
      lines: lines.filter((line) => line.versionId === version.id).map(toLineView),
    })),
  }
}
