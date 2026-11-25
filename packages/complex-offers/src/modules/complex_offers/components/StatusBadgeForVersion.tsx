'use client'

import * as React from 'react'
import { Lock } from 'lucide-react'
import { StatusBadge } from '@open-mercato/ui/primitives/status-badge'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { VersionStatus } from '../data/entities'

const VARIANT: Record<VersionStatus, 'neutral' | 'info' | 'success' | 'error'> = {
  draft: 'neutral',
  sent: 'info',
  accepted: 'success',
  rejected: 'error',
}

/** Status of a version; anything past draft carries a lock — it is frozen. */
export function VersionStatusBadge({ status }: { status: VersionStatus }) {
  const t = useT()
  return (
    <StatusBadge variant={VARIANT[status] ?? 'neutral'}>
      <span className="inline-flex items-center gap-1">
        {status !== 'draft' ? <Lock className="size-3" aria-hidden /> : null}
        {t(`complex_offers.status.${status}`, status)}
      </span>
    </StatusBadge>
  )
}
