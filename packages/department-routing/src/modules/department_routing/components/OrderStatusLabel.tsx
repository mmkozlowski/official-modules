'use client'

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { OrderStatus } from '../data/entities'

/** "Nowe" / "W realizacji 2/4 działy" / "Gotowe do wysyłki" — the count only when it is known. */
export function OrderStatusLabel({
  status,
  departmentsDone,
  departmentsTotal,
}: {
  status: OrderStatus
  departmentsDone?: number
  departmentsTotal?: number
}) {
  const t = useT()
  if (status === 'in_progress' && departmentsTotal) {
    return (
      <>
        {t('department_routing.orderStatus.inProgressCount', 'In progress {done}/{total} departments', {
          done: departmentsDone ?? 0,
          total: departmentsTotal,
        })}
      </>
    )
  }
  return <>{t(`department_routing.orderStatus.${status}`, status)}</>
}
