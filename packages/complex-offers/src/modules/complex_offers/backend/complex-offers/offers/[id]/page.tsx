'use client'

import * as React from 'react'
import Link from 'next/link'
import { CheckCircle2, CopyPlus, Lock, Plus, Printer, Send, XCircle } from 'lucide-react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { ErrorMessage, LoadingMessage } from '@open-mercato/ui/backend/detail'
import { Button } from '@open-mercato/ui/primitives/button'
import { Alert, AlertDescription, AlertTitle } from '@open-mercato/ui/primitives/alert'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import type { VersionStatus } from '../../../../data/entities'
import type { BreakdownStep, PricingModel } from '../../../../lib/pricing'
import { VAT_PERCENT } from '../../../../lib/pricing'
import { formatMoney } from '../../../../lib/format'
import { OfferLineCard, type LineChange } from '../../../../components/OfferLineCard'
import { AddLineDialog } from '../../../../components/AddLineDialog'
import { VersionStatusBadge } from '../../../../components/StatusBadgeForVersion'
import type { ListResponse, ModelRow, OfferView, RulesResponse, VersionView } from '../../../../components/types'

type LastChange = { lineId: string; previousTotal: string; previousSteps: BreakdownStep[]; previousVersionTotal: string }

/**
 * The offer screen. Versions are tabs; the current one is on top. A draft is a
 * configurator — every parameter change goes to the server, is re-priced with
 * the rules, and the line, its breakdown and the totals redraw with what moved
 * highlighted. A sent version is the same screen, read-only, with a lock.
 */
export default function OfferDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const locale = useLocale()
  const offerId = String(params?.id ?? '')
  const { confirm, ConfirmDialogElement } = useConfirmDialog()

  const [offer, setOffer] = React.useState<OfferView | null>(null)
  const [selectedVersionId, setSelectedVersionId] = React.useState<string | null>(null)
  const [rulesByModel, setRulesByModel] = React.useState<Record<string, PricingModel>>({})
  const [models, setModels] = React.useState<ModelRow[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [busyLineId, setBusyLineId] = React.useState<string | null>(null)
  const [isActing, setIsActing] = React.useState(false)
  const [lastChange, setLastChange] = React.useState<LastChange | null>(null)
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())
  const [isAddOpen, setIsAddOpen] = React.useState(false)

  const loadRules = React.useCallback(async (modelIds: string[]) => {
    const missing = Array.from(new Set(modelIds))
    const results = await Promise.all(
      missing.map((id) => apiCall<RulesResponse>(`/api/complex_offers/models/${encodeURIComponent(id)}/rules`).catch(() => null)),
    )
    setRulesByModel((current) => {
      const next = { ...current }
      results.forEach((call, index) => {
        if (call?.ok && call.result?.pricing) next[missing[index]] = call.result.pricing
      })
      return next
    })
  }, [])

  const applyOffer = React.useCallback(
    (view: OfferView, focusVersionId?: string) => {
      setOffer(view)
      setSelectedVersionId((current) => {
        if (focusVersionId) return focusVersionId
        if (current && view.versions.some((version) => version.id === current)) return current
        return view.versions.at(-1)?.id ?? null
      })
      const modelIds = view.versions.flatMap((version) => version.lines.map((line) => line.modelId))
      void loadRules(modelIds)
    },
    [loadRules],
  )

  React.useEffect(() => {
    if (!offerId) {
      setIsLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      setError(null)
      const [offerCall, modelsCall] = await Promise.all([
        apiCall<OfferView>(`/api/complex_offers/offers/${encodeURIComponent(offerId)}/view`).catch(() => null),
        apiCall<ListResponse<ModelRow>>('/api/complex_offers/models?pageSize=100&isActive=true&sortField=name&sortDir=asc').catch(() => null),
      ])
      if (cancelled) return
      if (!offerCall?.ok || !offerCall.result) {
        setError(t('complex_offers.offers.detail.notFound', 'Offer not found.'))
        setIsLoading(false)
        return
      }
      applyOffer(offerCall.result)
      setModels(modelsCall?.ok ? modelsCall.result?.items ?? [] : [])
      setIsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [applyOffer, offerId, t])

  const version: VersionView | null = React.useMemo(
    () => offer?.versions.find((candidate) => candidate.id === selectedVersionId) ?? offer?.versions.at(-1) ?? null,
    [offer, selectedVersionId],
  )
  const currentVersion = offer?.versions.at(-1) ?? null
  const isCurrent = Boolean(version && currentVersion && version.id === currentVersion.id)
  const sourceVersion = version?.sourceVersionId ? offer?.versions.find((candidate) => candidate.id === version.sourceVersionId) ?? null : null
  const currency = offer?.currencyCode ?? 'PLN'
  const money = (value: string | number) => formatMoney(value, currency, locale)
  const formatDate = (value: string | null) =>
    value ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'

  const changeLine = async (lineId: string, change: LineChange) => {
    if (!version) return
    const line = version.lines.find((candidate) => candidate.id === lineId)
    if (!line) return
    setBusyLineId(lineId)
    const call = await apiCall<{ offer: OfferView; previousTotal: string }>(`/api/complex_offers/lines/${encodeURIComponent(lineId)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(change),
    })
    setBusyLineId(null)
    if (!call.ok || !call.result) {
      const code = (call.result as unknown as { error?: string } | null)?.error
      flash(
        code === 'version_locked'
          ? t('complex_offers.lines.locked', 'This version was sent and is locked. Create a new version to change it.')
          : t('complex_offers.lines.saveFailed', 'The change was not saved.'),
        'error',
      )
      return
    }
    setLastChange({
      lineId,
      previousTotal: line.lineTotal,
      previousSteps: line.breakdown,
      previousVersionTotal: version.totalNet,
    })
    setExpanded((current) => new Set(current).add(lineId))
    applyOffer(call.result.offer)
  }

  const removeLine = async (lineId: string) => {
    const confirmed = await confirm({ title: t('complex_offers.lines.removeConfirm', 'Remove this line?'), variant: 'destructive' })
    if (!confirmed) return
    setBusyLineId(lineId)
    const call = await apiCall<{ offer: OfferView }>(`/api/complex_offers/lines/${encodeURIComponent(lineId)}`, { method: 'DELETE' })
    setBusyLineId(null)
    if (!call.ok || !call.result) {
      flash(t('complex_offers.lines.saveFailed', 'The change was not saved.'), 'error')
      return
    }
    setLastChange(null)
    applyOffer(call.result.offer)
  }

  const addLine = async (modelId: string, quantity: number) => {
    if (!version) return false
    const call = await apiCall<{ offer: OfferView; lineId: string }>(
      `/api/complex_offers/versions/${encodeURIComponent(version.id)}/lines`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ modelId, quantity }) },
    )
    if (!call.ok || !call.result) {
      flash(t('complex_offers.lines.saveFailed', 'The change was not saved.'), 'error')
      return false
    }
    setLastChange(null)
    applyOffer(call.result.offer)
    flash(t('complex_offers.lines.added', 'Product added — set its parameters on the line.'), 'success')
    return true
  }

  const changeStatus = async (status: VersionStatus) => {
    if (!version) return
    if (status === 'sent') {
      const confirmed = await confirm({
        title: t('complex_offers.status.sendConfirmTitle', 'Send version {version} to the customer?', { version: version.versionNumber }),
        text: t(
          'complex_offers.status.sendConfirmText',
          'After sending, this version is locked: its prices and parameters stay exactly as the customer received them. Any change will be a new version.',
        ),
      })
      if (!confirmed) return
    }
    setIsActing(true)
    const call = await apiCall<{ offer: OfferView }>(`/api/complex_offers/versions/${encodeURIComponent(version.id)}/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setIsActing(false)
    if (!call.ok || !call.result) {
      const code = (call.result as unknown as { error?: string } | null)?.error
      flash(
        code === 'empty_version'
          ? t('complex_offers.status.emptyVersion', 'Add at least one product before sending.')
          : t('complex_offers.status.failed', 'The status was not changed.'),
        'error',
      )
      return
    }
    setLastChange(null)
    applyOffer(call.result.offer)
    flash(t(`complex_offers.status.changed.${status}`, 'Status changed.'), 'success')
  }

  const createVersion = async () => {
    if (!version) return
    setIsActing(true)
    const call = await apiCall<{ offer: OfferView; versionId: string }>(
      `/api/complex_offers/versions/${encodeURIComponent(version.id)}/copy`,
      { method: 'POST' },
    )
    setIsActing(false)
    if (!call.ok || !call.result) {
      flash(t('complex_offers.versions.copyFailed', 'The new version was not created.'), 'error')
      return
    }
    setLastChange(null)
    applyOffer(call.result.offer, call.result.versionId)
    const created = call.result.offer.versions.find((candidate) => candidate.id === call.result!.versionId)
    flash(
      t('complex_offers.versions.created', 'Version {version} created from v{source} — v{source} stays unchanged.', {
        version: created?.versionNumber ?? '',
        source: version.versionNumber,
      }),
      'success',
    )
  }

  const openPrint = () => {
    if (version) window.open(`/api/complex_offers/versions/${version.id}/print`, '_blank', 'noopener')
  }

  if (isLoading && !offer) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('complex_offers.common.loading', 'Loading…')} />
        </PageBody>
      </Page>
    )
  }
  if (error || !offer || !version) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={error ?? t('complex_offers.offers.detail.notFound', 'Offer not found.')} />
          <div className="mt-4">
            <Button asChild variant="outline">
              <Link href="/backend/complex-offers/offers">{t('complex_offers.common.backToList', 'Back to offers')}</Link>
            </Button>
          </div>
        </PageBody>
      </Page>
    )
  }

  const versionDelta = sourceVersion ? Number(version.totalNet) - Number(sourceVersion.totalNet) : 0
  const totalDelta =
    lastChange && version.lines.some((line) => line.id === lastChange.lineId)
      ? Number(version.totalNet) - Number(lastChange.previousVersionTotal)
      : 0
  const canCopy = isCurrent && version.status !== 'draft'

  return (
    <Page>
      <PageBody>
        <div className="space-y-6">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">
                <Link href="/backend/complex-offers/offers" className="hover:underline">
                  {t('complex_offers.offers.list.title', 'Offers')}
                </Link>{' '}
                / <span className="tabular-nums">{offer.number}</span>
              </div>
              <h1 className="text-2xl font-semibold">{offer.customerName}</h1>
              <div className="text-sm text-muted-foreground">
                {offer.title}
                {offer.contactPerson ? ` · ${offer.contactPerson}` : ''}
                {offer.validUntil
                  ? ` · ${t('complex_offers.fields.validUntil', 'Valid until')} ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(offer.validUntil))}`
                  : ''}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={openPrint} data-testid="print-version">
                <Printer className="size-4" />
                {t('complex_offers.offers.printVersion', 'PDF v{version}', { version: version.versionNumber })}
              </Button>
              {isCurrent && version.status === 'draft' ? (
                <Button type="button" onClick={() => void changeStatus('sent')} disabled={isActing} data-testid="send-version">
                  <Send className="size-4" />
                  {t('complex_offers.status.send', 'Send to customer')}
                </Button>
              ) : null}
              {isCurrent && version.status === 'sent' ? (
                <>
                  <Button type="button" variant="outline" onClick={() => void changeStatus('rejected')} disabled={isActing}>
                    <XCircle className="size-4" />
                    {t('complex_offers.status.reject', 'Customer rejected')}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void changeStatus('accepted')} disabled={isActing}>
                    <CheckCircle2 className="size-4" />
                    {t('complex_offers.status.accept', 'Customer accepted')}
                  </Button>
                </>
              ) : null}
              {canCopy ? (
                <Button type="button" onClick={() => void createVersion()} disabled={isActing} data-testid="new-version">
                  <CopyPlus className="size-4" />
                  {t('complex_offers.versions.new', 'New version (v{version})', { version: version.versionNumber + 1 })}
                </Button>
              ) : null}
            </div>
          </header>

          <nav className="flex flex-wrap gap-2" aria-label={t('complex_offers.versions.title', 'Versions')} data-testid="version-tabs">
            {offer.versions
              .slice()
              .reverse()
              .map((candidate) => (
                <Button
                  key={candidate.id}
                  type="button"
                  variant={candidate.id === version.id ? 'secondary' : 'ghost'}
                  onClick={() => {
                    setSelectedVersionId(candidate.id)
                    setLastChange(null)
                  }}
                  className={cn('gap-2', candidate.id === version.id ? 'ring-1 ring-border' : '')}
                >
                  <span className="font-semibold">v{candidate.versionNumber}</span>
                  <VersionStatusBadge status={candidate.status} />
                  <span className="tabular-nums text-muted-foreground">{money(candidate.totalNet)}</span>
                </Button>
              ))}
          </nav>

          {version.status !== 'draft' ? (
            <Alert status={version.status === 'rejected' ? 'error' : 'information'} icon={<Lock className="size-4" />} data-testid="locked-banner">
              <AlertTitle>
                {t('complex_offers.versions.lockedTitle', 'Version {version} is locked — {status}', {
                  version: version.versionNumber,
                  status: t(`complex_offers.status.${version.status}`, version.status).toLowerCase(),
                })}
              </AlertTitle>
              <AlertDescription>
                {t(
                  'complex_offers.versions.lockedText',
                  'Sent {date}. The customer has exactly these prices and parameters, so this version cannot be edited.',
                  { date: formatDate(version.sentAt) },
                )}{' '}
                {canCopy
                  ? t('complex_offers.versions.lockedHint', 'To change something, create a new version — this one stays as it is.')
                  : !isCurrent
                    ? t('complex_offers.versions.notCurrent', 'This is an earlier version; the current one is v{version}.', {
                        version: currentVersion?.versionNumber ?? '',
                      })
                    : ''}
              </AlertDescription>
            </Alert>
          ) : null}

          <section className="space-y-3">
            {version.lines.length === 0 ? (
              <div className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
                {t('complex_offers.lines.empty', 'No products yet. Add a model — it is priced from its parameters at once.')}
              </div>
            ) : null}
            {version.lines.map((line, index) => (
              <OfferLineCard
                key={line.id}
                index={index}
                line={line}
                rules={rulesByModel[line.modelId] ?? null}
                editable={version.isEditable}
                currencyCode={currency}
                isBusy={busyLineId === line.id}
                lastChange={lastChange?.lineId === line.id ? lastChange : null}
                isExpanded={expanded.has(line.id)}
                onToggleExpanded={() =>
                  setExpanded((current) => {
                    const next = new Set(current)
                    if (next.has(line.id)) next.delete(line.id)
                    else next.add(line.id)
                    return next
                  })
                }
                onChange={(change) => void changeLine(line.id, change)}
                onRemove={() => void removeLine(line.id)}
              />
            ))}
            {version.isEditable ? (
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(true)} data-testid="add-line">
                <Plus className="size-4" />
                {t('complex_offers.lines.add', 'Add product')}
              </Button>
            ) : null}
          </section>

          <section className="ml-auto w-full max-w-md rounded-lg border bg-card p-4 shadow-xs" data-testid="version-totals">
            <div className="flex justify-between py-1 text-sm">
              <span className="text-muted-foreground">{t('complex_offers.totals.net', 'Total net')}</span>
              <span className="flex items-center gap-2 font-semibold tabular-nums">
                {totalDelta !== 0 ? (
                  <StatusBadge variant={totalDelta > 0 ? 'warning' : 'success'}>
                    {totalDelta > 0 ? '+' : '−'} {money(Math.abs(totalDelta))}
                  </StatusBadge>
                ) : null}
                <span data-testid="total-net">{money(version.totalNet)}</span>
              </span>
            </div>
            <div className="flex justify-between py-1 text-sm">
              <span className="text-muted-foreground">{t('complex_offers.totals.vat', 'VAT {percent}%', { percent: VAT_PERCENT })}</span>
              <span className="tabular-nums">{money(version.vatAmount)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t pt-2 text-base">
              <span className="font-medium">{t('complex_offers.totals.gross', 'Total gross')}</span>
              <span className="font-semibold tabular-nums">{money(version.totalGross)}</span>
            </div>
            {sourceVersion ? (
              <div className="mt-2 text-right text-xs text-muted-foreground" data-testid="version-compare">
                {t('complex_offers.versions.compare', 'vs v{version} ({status}): {delta}', {
                  version: sourceVersion.versionNumber,
                  status: t(`complex_offers.status.${sourceVersion.status}`, sourceVersion.status).toLowerCase(),
                  delta: `${versionDelta >= 0 ? '+' : '−'} ${money(Math.abs(versionDelta))}`,
                })}
              </div>
            ) : null}
          </section>
        </div>
      </PageBody>
      <AddLineDialog open={isAddOpen} models={models} onClose={() => setIsAddOpen(false)} onSubmit={addLine} />
      {ConfirmDialogElement}
    </Page>
  )
}
