'use client'

import * as React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@open-mercato/ui/primitives/dialog'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'

export type DuplicateSource = { id: string; name: string }

/**
 * "Duplicate product" — asks for the new name (and optionally a code), then
 * makes the deep copy on the server and says, out loud, what was copied.
 *
 * Both outcomes are visible: a success names the line count, a failure names
 * the failure. A copy that silently does nothing is the bug this replaces.
 */
export function DuplicateProductDialog({
  source,
  onClose,
  onDuplicated,
}: {
  source: DuplicateSource | null
  onClose: () => void
  onDuplicated: (newProductId: string) => void
}) {
  const t = useT()
  const [name, setName] = React.useState('')
  const [code, setCode] = React.useState('')
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    if (source) {
      setName(t('production_bom.duplicate.defaultName', '{name} (copy)', { name: source.name }))
      setCode('')
    }
  }, [source, t])

  const submit = React.useCallback(async () => {
    if (!source || !name.trim() || isSaving) return
    setIsSaving(true)
    const call = await apiCall<{ id: string; lineCount: number }>(
      `/api/production_bom/products/${encodeURIComponent(source.id)}/duplicate`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), code: code.trim() || null }),
      },
    )
    setIsSaving(false)
    if (!call.ok || !call.result?.id) {
      flash(t('production_bom.duplicate.failed', 'The product could not be duplicated. Nothing was saved.'), 'error')
      return
    }
    flash(
      t('production_bom.duplicate.done', 'Copied with {count} BOM line(s), quantities and pieces.', {
        count: call.result.lineCount,
      }),
      'success',
    )
    onDuplicated(call.result.id)
  }, [code, isSaving, name, onDuplicated, source, t])

  return (
    <Dialog open={source !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            void submit()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('production_bom.duplicate.title', 'Duplicate product')}</DialogTitle>
          <DialogDescription>
            {t(
              'production_bom.duplicate.description',
              'A new, independent product with the same BOM, labour time and fabric consumption. Changing the original later does not change the copy.',
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="duplicate-name">{t('production_bom.products.fields.name', 'Product')}</Label>
            <Input id="duplicate-name" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="duplicate-code">{t('production_bom.products.fields.code', 'Code')}</Label>
            <Input id="duplicate-code" value={code} onChange={(event) => setCode(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            {t('production_bom.common.cancel', 'Cancel')}
          </Button>
          <Button onClick={() => void submit()} disabled={isSaving || !name.trim()}>
            {t('production_bom.duplicate.submit', 'Duplicate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
