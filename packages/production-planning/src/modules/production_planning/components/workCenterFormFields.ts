import type { CrudField } from '@open-mercato/ui/backend/CrudForm'
import type { TranslateFn } from '@open-mercato/shared/lib/i18n/context'
import { WORK_CENTER_STAGES } from '../data/validators'

export type WorkCenterFormValues = {
  name?: string
  code?: string
  stage?: string
  dailyCapacityMinutes?: string | number
  position?: string | number
  notes?: string
  isActive?: boolean
}

export function buildWorkCenterFields(t: TranslateFn, options: { includeActive: boolean }): CrudField[] {
  const fields: CrudField[] = [
    { id: 'name', label: t('production_planning.workCenters.fields.name', 'Work centre'), type: 'text', required: true },
    { id: 'code', label: t('production_planning.workCenters.fields.code', 'Code'), type: 'text', layout: 'half',
      description: t('production_planning.workCenters.fields.codeHint', 'Short label shown on the plan bars, e.g. SZW.') },
    {
      id: 'stage',
      label: t('production_planning.workCenters.fields.stage', 'Stage'),
      type: 'select',
      layout: 'half',
      options: WORK_CENTER_STAGES.map((value) => ({ value, label: t(`production_planning.stage.${value}`, value) })),
    },
    {
      id: 'dailyCapacityMinutes',
      label: t('production_planning.workCenters.fields.capacity', 'Capacity per working day (min)'),
      type: 'number',
      required: true,
      layout: 'half',
      description: t('production_planning.workCenters.fields.capacityHint', 'People × shift length: 4 people × 8 h = 1920 min.'),
    },
    { id: 'position', label: t('production_planning.workCenters.fields.position', 'Order on the plan'), type: 'number', layout: 'half' },
    { id: 'notes', label: t('production_planning.workCenters.fields.notes', 'Notes'), type: 'textarea' },
  ]
  if (options.includeActive) fields.push({ id: 'isActive', label: t('production_planning.common.active', 'Active'), type: 'checkbox' })
  return fields
}

export function toWorkCenterPayload(values: WorkCenterFormValues): Record<string, unknown> {
  return {
    name: values.name,
    code: values.code || null,
    stage: values.stage || 'other',
    dailyCapacityMinutes: Math.trunc(Number(values.dailyCapacityMinutes ?? 0)),
    position: values.position === '' || values.position == null ? 0 : Math.trunc(Number(values.position)),
    notes: values.notes || null,
    ...(values.isActive === undefined ? {} : { isActive: values.isActive }),
  }
}
