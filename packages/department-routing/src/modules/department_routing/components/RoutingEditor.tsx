'use client'

import * as React from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { Button } from '@open-mercato/ui/primitives/button'
import { Checkbox } from '@open-mercato/ui/primitives/checkbox'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { SectionHeader } from '@open-mercato/ui/backend/SectionHeader'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { DepartmentRow } from './types'

/**
 * Which departments make this product, in order. Ticked departments form the
 * routing; the arrows change the order. Saved as the whole list — it applies to
 * orders accepted from now on.
 */
export function RoutingEditor({
  productId,
  departmentIds,
  departments,
  onSaved,
}: {
  productId: string
  departmentIds: string[]
  departments: DepartmentRow[]
  onSaved: () => void
}) {
  const t = useT()
  const [selected, setSelected] = React.useState<string[]>(departmentIds)
  const [isSaving, setIsSaving] = React.useState(false)
  const isDirty = JSON.stringify(selected) !== JSON.stringify(departmentIds)
  const byId = React.useMemo(() => new Map(departments.map((department) => [department.id, department])), [departments])
  const unselected = departments.filter((department) => !selected.includes(department.id))

  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  const move = (index: number, delta: number) =>
    setSelected((current) => {
      const next = [...current]
      const target = index + delta
      if (target < 0 || target >= next.length) return current
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  const save = async () => {
    setIsSaving(true)
    try {
      const call = await apiCall('/api/department_routing/products', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: productId, departmentIds: selected }),
      })
      if (!call.ok) {
        flash(t('department_routing.routing.saveFailed', 'The routing was not saved.'), 'error')
        return
      }
      flash(t('department_routing.routing.saved', 'Routing saved — new orders will split this way.'), 'success')
      onSaved()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <SectionHeader
        title={t('department_routing.routing.title', 'Departments that make this product')}
        count={selected.length}
        action={
          <div className="flex items-center gap-2">
            {isDirty ? <StatusBadge variant="warning">{t('department_routing.lines.unsaved', 'Unsaved changes')}</StatusBadge> : null}
            <Button type="button" size="sm" onClick={() => void save()} disabled={isSaving || !isDirty}>
              {t('department_routing.routing.save', 'Save routing')}
            </Button>
          </div>
        }
      />
      <div className="rounded-md border divide-y">
        {selected.map((id, index) => {
          const department = byId.get(id)
          return (
            <div key={id} className="flex items-center gap-3 p-3" data-testid="routing-step">
              <Checkbox checked onCheckedChange={() => toggle(id)} aria-label={department?.name ?? id} />
              <span className="w-6 tabular-nums text-muted-foreground">{index + 1}.</span>
              <span className="flex-1 font-medium">{department?.name ?? '—'}</span>
              <Button type="button" variant="ghost" size="icon" onClick={() => move(index, -1)} disabled={index === 0}
                aria-label={t('department_routing.routing.moveUp', 'Move up')}>
                <ArrowUp className="size-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => move(index, 1)} disabled={index === selected.length - 1}
                aria-label={t('department_routing.routing.moveDown', 'Move down')}>
                <ArrowDown className="size-4" />
              </Button>
            </div>
          )
        })}
        {unselected.map((department) => (
          <div key={department.id} className="flex items-center gap-3 p-3 text-muted-foreground">
            <Checkbox checked={false} onCheckedChange={() => toggle(department.id)} aria-label={department.name} />
            <span className="w-6" />
            <span className="flex-1">{department.name}</span>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {selected.length
          ? t('department_routing.routing.preview', 'One unit goes: {path}.', {
              path: selected.map((id) => byId.get(id)?.name ?? '—').join(' → '),
            })
          : t('department_routing.routing.none', 'No department ticked — an order with this product cannot be accepted.')}
      </p>
    </div>
  )
}
