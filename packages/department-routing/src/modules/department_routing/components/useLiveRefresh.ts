'use client'

import * as React from 'react'
import { useAppEvent } from '@open-mercato/ui/backend/injection/useAppEvent'

/**
 * Keeps a screen in step with what other people report: refreshes on every
 * broadcast `department_routing.*` event AND on a short interval while the tab
 * is visible. The interval is the safety net — a screen open in a second
 * window must show the new status even when the event stream is not connected.
 */
export function useLiveRefresh(refresh: () => void, intervalMs: number = 3000): void {
  const refreshRef = React.useRef(refresh)
  refreshRef.current = refresh

  useAppEvent('department_routing.*', () => refreshRef.current())

  React.useEffect(() => {
    const tick = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') refreshRef.current()
    }
    const timer = window.setInterval(tick, intervalMs)
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshRef.current()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [intervalMs])
}
