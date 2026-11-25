'use client'

import * as React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@open-mercato/ui/primitives/dialog'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@open-mercato/ui/primitives/select'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { ModelRow } from './types'

/**
 * Pick a model and a quantity. Parameters are chosen on the line itself,
 * after it is added with the model's defaults — so the price is visible from
 * the first second and every change after that shows its effect.
 */
export function AddLineDialog({
  open,
  models,
  onClose,
  onSubmit,
}: {
  open: boolean
  models: ModelRow[]
  onClose: () => void
  onSubmit: (modelId: string, quantity: number) => Promise<boolean>
}) {
  const t = useT()
  const [modelId, setModelId] = React.useState('')
  const [quantity, setQuantity] = React.useState('1')
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setModelId(models[0]?.id ?? '')
      setQuantity('1')
    }
  }, [models, open])

  const parsedQuantity = Number(quantity)
  const isValid = Boolean(modelId) && Number.isInteger(parsedQuantity) && parsedQuantity >= 1

  const submit = async () => {
    if (!isValid || isSaving) return
    setIsSaving(true)
    const ok = await onSubmit(modelId, parsedQuantity)
    setIsSaving(false)
    if (ok) onClose()
  }

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
          <DialogTitle>{t('complex_offers.lines.addTitle', 'Add a product')}</DialogTitle>
          <DialogDescription>
            {t('complex_offers.lines.addDescription', 'The line starts with the model defaults — change size, fabric or add-ons on the line and the price follows.')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('complex_offers.lines.model', 'Model')}</Label>
            <Select value={modelId || undefined} onValueChange={setModelId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('complex_offers.lines.pickModel', 'Pick a model…')} />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-line-quantity">{t('complex_offers.lines.quantity', 'Qty')}</Label>
            <Input
              id="add-line-quantity"
              inputMode="numeric"
              className="w-32"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            {t('complex_offers.common.cancel', 'Cancel')}
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={!isValid || isSaving}>
            {t('complex_offers.lines.add', 'Add product')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
