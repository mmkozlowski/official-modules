'use client'

import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@open-mercato/ui/primitives/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@open-mercato/ui/primitives/table'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { SectionHeader } from '@open-mercato/ui/backend/SectionHeader'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { OrderView, ProductRow } from './types'

type DraftLine = { key: string; productId: string; quantity: string }

let draftKeySeed = 0
const nextKey = () => `order-line-${++draftKeySeed}`

function toDraft(view: OrderView): DraftLine[] {
  return view.lines.map((line) => ({ key: nextKey(), productId: line.productId, quantity: String(line.quantity) }))
}

function isPositiveInteger(value: string): boolean {
  return /^\d+$/.test(value.trim()) && Number(value) > 0
}

/**
 * Lines of an order that is still `new`: product and quantity. Each row shows
 * the departments the product goes through, so before accepting you already
 * see how the order will split. Saved as a whole list.
 */
export function OrderLinesEditor({
  view,
  products,
  onSaved,
  onDirtyChange,
}: {
  view: OrderView
  products: ProductRow[]
  onSaved: (view: OrderView) => void
  onDirtyChange?: (dirty: boolean) => void
}) {
  const t = useT()
  const [lines, setLines] = React.useState<DraftLine[]>(() => toDraft(view))
  const [isSaving, setIsSaving] = React.useState(false)
  const savedSignature = React.useMemo(
    () => JSON.stringify(view.lines.map((line) => [line.productId, String(line.quantity)])),
    [view.lines],
  )
  const draftSignature = JSON.stringify(lines.map((line) => [line.productId, line.quantity.trim()]))
  const isDirty = savedSignature !== draftSignature

  React.useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  const productById = React.useMemo(() => new Map(products.map((product) => [product.id, product])), [products])

  const update = (key: string, patch: Partial<DraftLine>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  const remove = (key: string) => setLines((current) => current.filter((line) => line.key !== key))
  const add = () => setLines((current) => [...current, { key: nextKey(), productId: '', quantity: '1' }])

  const save = async () => {
    if (lines.some((line) => !line.productId || !isPositiveInteger(line.quantity))) {
      flash(t('department_routing.lines.invalid', 'Every line needs a product and a whole quantity above zero.'), 'error')
      return
    }
    setIsSaving(true)
    try {
      const call = await apiCall<OrderView>(`/api/department_routing/orders/${encodeURIComponent(view.order.id)}/lines`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lines: lines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity) })) }),
      })
      if (!call.ok || !call.result) {
        flash(t('department_routing.lines.saveFailed', 'The lines were not saved.'), 'error')
        return
      }
      flash(t('department_routing.lines.saved', 'Order lines saved.'), 'success')
      onSaved(call.result)
      setLines(toDraft(call.result))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <SectionHeader
        title={t('department_routing.lines.title', 'Order lines')}
        count={lines.length}
        action={
          <div className="flex items-center gap-2">
            {isDirty ? (
              <StatusBadge variant="warning">{t('department_routing.lines.unsaved', 'Unsaved changes')}</StatusBadge>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={add}>
              <Plus className="size-4" />
              {t('department_routing.lines.add', 'Add product')}
            </Button>
            <Button type="button" size="sm" onClick={() => void save()} disabled={isSaving || !isDirty}>
              {t('department_routing.lines.save', 'Save lines')}
            </Button>
          </div>
        }
      />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead className="min-w-[280px]">{t('department_routing.lines.product', 'Product')}</TableHead>
              <TableHead className="w-[140px]">{t('department_routing.lines.quantity', 'Quantity (pcs)')}</TableHead>
              <TableHead>{t('department_routing.lines.departments', 'Goes through')}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  {t('department_routing.lines.empty', 'No products yet. Add what the customer ordered.')}
                </TableCell>
              </TableRow>
            ) : null}
            {lines.map((line, index) => {
              const product = productById.get(line.productId)
              return (
                <TableRow key={line.key} data-testid="order-line">
                  <TableCell className="tabular-nums text-muted-foreground">{index + 1}</TableCell>
                  <TableCell>
                    <Select value={line.productId || undefined} onValueChange={(value) => update(line.key, { productId: value })}>
                      <SelectTrigger size="sm" className="w-full" aria-label={t('department_routing.lines.product', 'Product')}>
                        <SelectValue placeholder={t('department_routing.lines.pickProduct', 'Pick a product…')} />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      inputMode="numeric"
                      className="h-8 w-24 tabular-nums"
                      value={line.quantity}
                      aria-label={t('department_routing.lines.quantity', 'Quantity (pcs)')}
                      onChange={(event) => update(line.key, { quantity: event.target.value.replace(/[^\d]/g, '') })}
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {product ? (
                      product.department_names.length ? (
                        product.department_names.join(' → ')
                      ) : (
                        <span className="text-destructive">{t('department_routing.lines.noRouting', 'No departments set')}</span>
                      )
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(line.key)}
                      aria-label={t('department_routing.common.delete', 'Delete')}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
