'use client'

import * as React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@open-mercato/ui/primitives/dialog'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { PlanInput, PlanOrder } from '../lib/plan-model'
import { shiftWorkingDays, workingDayOnOrAfter } from '../lib/schedule'

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * "Urgent order" — product, quantity, due date, optional fabric. Saved as a
 * normal production order with `priority: urgent`; the plan page adds it to
 * its input and the load repaints with it in.
 */
export function UrgentOrderDialog({
  open,
  input,
  onClose,
  onCreated,
}: {
  open: boolean
  input: PlanInput
  onClose: () => void
  onCreated: (order: PlanOrder) => void
}) {
  const t = useT()
  const products = input.products
  const fabrics = React.useMemo(() => input.materials.filter((material) => material.materialType === 'fabric'), [input.materials])
  const [productId, setProductId] = React.useState('')
  const [quantity, setQuantity] = React.useState('')
  const [dueDate, setDueDate] = React.useState('')
  const [fabricId, setFabricId] = React.useState('')
  const [reference, setReference] = React.useState('')
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setProductId(products[0]?.id ?? '')
    setQuantity('')
    setDueDate(shiftWorkingDays(workingDayOnOrAfter(input.today), 4))
    setFabricId('')
    setReference('')
  }, [input.today, open, products])

  const product = products.find((entry) => entry.id === productId)
  const takesFabric = !!product && Number(product.fabricConsumption) > 0
  const canSubmit = !!productId && Number(quantity) >= 1 && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) && !isSaving

  const submit = React.useCallback(async () => {
    if (!canSubmit) return
    setIsSaving(true)
    const payload = {
      productId,
      quantity: Math.trunc(Number(quantity)),
      dueDate,
      priority: 'urgent',
      status: 'planned',
      fabricMaterialId: takesFabric && fabricId ? fabricId : null,
      reference: reference.trim() || null,
    }
    const call = await apiCall<{ id: string; number: string }>('/api/production_planning/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setIsSaving(false)
    if (!call.ok || !call.result?.id) {
      flash(t('production_planning.urgent.failed', 'The order could not be saved. Nothing was added to the plan.'), 'error')
      return
    }
    onCreated({
      id: call.result.id,
      number: call.result.number,
      productId,
      quantity: payload.quantity,
      dueDate,
      priority: 'urgent',
      status: 'planned',
      fabricMaterialId: payload.fabricMaterialId,
      reference: payload.reference,
    })
  }, [canSubmit, dueDate, fabricId, onCreated, productId, quantity, reference, t, takesFabric])

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            void submit()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('production_planning.urgent.title', 'Urgent order')}</DialogTitle>
          <DialogDescription>
            {t(
              'production_planning.urgent.description',
              'Goes straight onto the plan, scheduled back from its due date. The load shows at once whether the workshop can take it.',
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="urgent-product">{t('production_planning.orders.fields.product', 'Product')}</Label>
            <select
              id="urgent-product"
              className={SELECT_CLASS}
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
            >
              {products.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.code ? `${entry.code} — ${entry.name}` : entry.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="urgent-quantity">{t('production_planning.orders.fields.quantity', 'Quantity')}</Label>
            <Input
              id="urgent-quantity"
              type="number"
              min={1}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="urgent-due">{t('production_planning.orders.fields.dueDate', 'Due date')}</Label>
            <Input id="urgent-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>
          {takesFabric ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="urgent-fabric">{t('production_planning.orders.fields.fabric', 'Fabric')}</Label>
              <select id="urgent-fabric" className={SELECT_CLASS} value={fabricId} onChange={(event) => setFabricId(event.target.value)}>
                <option value="">{t('production_planning.orders.fields.fabricNone', '— choose later —')}</option>
                {fabrics.map((fabric) => (
                  <option key={fabric.id} value={fabric.id}>
                    {fabric.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="urgent-reference">{t('production_planning.orders.fields.reference', 'Reference')}</Label>
            <Input id="urgent-reference" value={reference} onChange={(event) => setReference(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            {t('production_planning.common.cancel', 'Cancel')}
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit} data-testid="urgent-submit">
            {t('production_planning.urgent.submit', 'Add to plan')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
