/**
 * `GET /api/complex_offers/versions/{id}/print` — the customer document for one
 * version as a self-contained A4 HTML page; the browser's "Save as PDF" turns
 * it into the PDF. No PDF library and no headless browser on the server: one
 * dependency less to break, and the document is exactly what the screen shows.
 *
 * Deliberately NOT printed: the price breakdown. Base price, BOM cost and
 * margin are internal — the customer sees parameters, quantity, unit price,
 * the quantity discount and totals.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { OpenApiMethodDoc, OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { Organization } from '@open-mercato/core/modules/directory/data/entities'
import { Offer, OfferVersion } from '../../../../data/entities'
import { loadVersionLines } from '../../../../lib/offer-repository'
import { parameterKindLabel } from '../../../../lib/breakdown-labels'
import { formatDecimal, formatMoney } from '../../../../lib/format'
import { VAT_PERCENT } from '../../../../lib/pricing'
import { notFound } from '../../../../lib/http'
import { requireUuidParam, resolveRequestScope } from '../../../../lib/request-scope'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['complex_offers.view'] },
}

type RouteContext = { params: { id: string } | Promise<{ id: string }> }

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function GET(req: NextRequest, context: RouteContext) {
  const guard = await resolveRequestScope(req)
  if (!guard.ok) return guard.response
  const { em, tenantId, organizationId } = guard.scope
  const scope = { tenantId, organizationId }
  const idCheck = requireUuidParam((await Promise.resolve(context.params)).id)
  if (!idCheck.ok) return idCheck.response

  const version = await em.findOne(OfferVersion, { id: idCheck.id, tenantId, organizationId })
  if (!version) return notFound()
  const offer = await em.findOne(Offer, { id: version.offerId, tenantId, organizationId, deletedAt: null })
  if (!offer) return notFound()
  const lines = await loadVersionLines(em, scope, [version.id])

  let sellerName = ''
  try {
    const organization = await em.findOne(Organization, { id: organizationId })
    sellerName = organization?.name ?? ''
  } catch {
    sellerName = ''
  }

  const { translate, locale } = await resolveTranslations()
  const t = (key: string, fallback: string, params?: Record<string, string | number>) => translate(key, fallback, params)
  const currency = offer.currencyCode || 'PLN'
  const money = (value: string) => escapeHtml(formatMoney(value, currency, locale))
  const date = (value: Date | null | undefined) =>
    value ? escapeHtml(new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(value))) : '—'

  const rows = lines
    .map((line, index) => {
      const parameters = (line.selected ?? [])
        .map((parameter) => `${escapeHtml(parameterKindLabel(parameter.kind, t))}: ${escapeHtml(parameter.label)}`)
        .join('<br/>')
      const discount = Number(line.discountPercent) > 0
        ? `<div class="muted">${escapeHtml(t('complex_offers.print.discountNote', 'incl. quantity discount {percent}%', { percent: formatDecimal(String(line.discountPercent), locale, 2) }))}</div>`
        : ''
      return `<tr>
        <td class="num">${index + 1}</td>
        <td><strong>${escapeHtml(line.modelName)}</strong><div class="params">${parameters}</div></td>
        <td class="num">${line.quantity}</td>
        <td class="num">${money(String(line.unitPrice))}${discount}</td>
        <td class="num"><strong>${money(String(line.lineTotal))}</strong></td>
      </tr>`
    })
    .join('')

  const statusLabel = t(`complex_offers.status.${version.status}`, version.status)
  const isDraft = version.status === 'draft'
  const title = t('complex_offers.print.title', 'Offer {number}', { number: offer.number })

  const html = `<!doctype html>
<html lang="${escapeHtml(locale)}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)} · v${version.versionNumber}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111827; margin: 0; background: #f3f4f6; }
  .sheet { background: #fff; width: 210mm; min-height: 297mm; margin: 24px auto; padding: 16mm 14mm; box-shadow: 0 1px 4px rgba(0,0,0,.12); position: relative; }
  .toolbar { position: sticky; top: 0; background: #111827; color: #fff; padding: 10px 16px; display: flex; gap: 12px; align-items: center; justify-content: center; font-size: 14px; }
  .toolbar button { background: #fff; color: #111827; border: 0; border-radius: 6px; padding: 8px 14px; font-weight: 600; cursor: pointer; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 18px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .muted { color: #6b7280; font-size: 11px; }
  .seller { text-align: right; font-size: 13px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; font-size: 13px; margin-bottom: 18px; }
  .meta b { display: block; font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; border-bottom: 1px solid #d1d5db; padding: 6px 6px; }
  td { border-bottom: 1px solid #e5e7eb; padding: 8px 6px; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  th.num { text-align: right; }
  .params { color: #4b5563; font-size: 11.5px; margin-top: 3px; line-height: 1.45; }
  .totals { margin-left: auto; margin-top: 14px; width: 300px; font-size: 13px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .grand { border-top: 2px solid #111827; margin-top: 4px; padding-top: 8px; font-size: 16px; font-weight: 700; }
  .notes { margin-top: 24px; font-size: 12.5px; white-space: pre-wrap; }
  .badge { display: inline-block; border-radius: 999px; padding: 2px 10px; font-size: 11px; font-weight: 600; background: #e5e7eb; }
  .watermark { position: absolute; top: 45%; left: 0; right: 0; text-align: center; font-size: 88px; font-weight: 800; color: rgba(220, 38, 38, .08); transform: rotate(-24deg); pointer-events: none; }
  @media print { body { background: #fff; } .toolbar { display: none; } .sheet { margin: 0; box-shadow: none; width: auto; min-height: auto; padding: 0; } }
</style>
</head>
<body>
<div class="toolbar">
  <span>${escapeHtml(t('complex_offers.print.hint', 'Print preview — choose "Save as PDF" in the print dialog.'))}</span>
  <button type="button" onclick="window.print()">${escapeHtml(t('complex_offers.print.button', 'Print / save as PDF'))}</button>
</div>
<div class="sheet">
  ${isDraft ? `<div class="watermark">${escapeHtml(t('complex_offers.print.draftWatermark', 'DRAFT'))}</div>` : ''}
  <header>
    <div>
      <h1>${escapeHtml(title)}</h1>
      <div>${escapeHtml(t('complex_offers.print.version', 'Version {version}', { version: version.versionNumber }))} · <span class="badge">${escapeHtml(statusLabel)}</span></div>
    </div>
    <div class="seller">${sellerName ? `<strong>${escapeHtml(sellerName)}</strong><br/>` : ''}<span class="muted">${escapeHtml(t('complex_offers.print.issued', 'Issued'))}: ${date(version.sentAt ?? version.createdAt)}</span></div>
  </header>
  <section class="meta">
    <div><b>${escapeHtml(t('complex_offers.fields.customerName', 'Customer'))}</b>${escapeHtml(offer.customerName)}${offer.contactPerson ? `<br/>${escapeHtml(offer.contactPerson)}` : ''}</div>
    <div><b>${escapeHtml(t('complex_offers.fields.title', 'Subject'))}</b>${escapeHtml(offer.title)}</div>
    <div><b>${escapeHtml(t('complex_offers.fields.validUntil', 'Valid until'))}</b>${date(offer.validUntil)}</div>
    <div><b>${escapeHtml(t('complex_offers.print.prices', 'Prices'))}</b>${escapeHtml(t('complex_offers.print.pricesNet', 'net, {currency}', { currency }))}</div>
  </section>
  <table>
    <thead><tr>
      <th class="num">#</th>
      <th>${escapeHtml(t('complex_offers.lines.product', 'Product and parameters'))}</th>
      <th class="num">${escapeHtml(t('complex_offers.lines.quantity', 'Qty'))}</th>
      <th class="num">${escapeHtml(t('complex_offers.lines.unitPrice', 'Unit price'))}</th>
      <th class="num">${escapeHtml(t('complex_offers.lines.lineTotal', 'Value'))}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div><span>${escapeHtml(t('complex_offers.totals.net', 'Total net'))}</span><span>${money(String(version.totalNet))}</span></div>
    <div><span>${escapeHtml(t('complex_offers.totals.vat', 'VAT {percent}%', { percent: VAT_PERCENT }))}</span><span>${money(String(version.vatAmount))}</span></div>
    <div class="grand"><span>${escapeHtml(t('complex_offers.totals.gross', 'Total gross'))}</span><span>${money(String(version.totalGross))}</span></div>
  </div>
  ${offer.notes ? `<div class="notes">${escapeHtml(offer.notes)}</div>` : ''}
</div>
</body>
</html>`

  return new NextResponse(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } })
}

const getDoc: OpenApiMethodDoc = {
  summary: 'Printable offer document for one version',
  description: 'Self-contained A4 HTML (save as PDF from the print dialog). The internal price breakdown is not included.',
  tags: ['Complex Offers'],
  responses: [{ status: 200, description: 'HTML document', schema: z.string() }],
  errors: [{ status: 404, description: 'No such version in this scope', schema: z.object({ error: z.string() }) }],
}

export const openApi: OpenApiRouteDoc = { summary: 'Print offer version', methods: { GET: getDoc } }
