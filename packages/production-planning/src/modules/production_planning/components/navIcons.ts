import React from 'react'

const svg = (...children: React.ReactElement[]) =>
  React.createElement(
    'svg',
    { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
    ...children,
  )

/** Bars on a timeline — the plan. */
export const planIcon = svg(
  React.createElement('path', { key: 'a', d: 'M3 4v16h18' }),
  React.createElement('rect', { key: 'b', x: 6, y: 6, width: 7, height: 3, rx: 1 }),
  React.createElement('rect', { key: 'c', x: 10, y: 11, width: 8, height: 3, rx: 1 }),
  React.createElement('rect', { key: 'd', x: 14, y: 16, width: 6, height: 2, rx: 1 }),
)

/** A clipboard — a production order. */
export const ordersIcon = svg(
  React.createElement('rect', { key: 'a', x: 5, y: 4, width: 14, height: 17, rx: 2 }),
  React.createElement('path', { key: 'b', d: 'M9 4V3h6v1M9 10h6M9 14h6M9 18h3' }),
)

/** A gauge — a work centre with its capacity. */
export const workCentersIcon = svg(
  React.createElement('path', { key: 'a', d: 'M4 18a8 8 0 1 1 16 0' }),
  React.createElement('path', { key: 'b', d: 'M12 18l4-6' }),
  React.createElement('path', { key: 'c', d: 'M3 21h18' }),
)

/** Arrows through stations — a routing. */
export const routingsIcon = svg(
  React.createElement('circle', { key: 'a', cx: 5, cy: 12, r: 2 }),
  React.createElement('circle', { key: 'b', cx: 12, cy: 12, r: 2 }),
  React.createElement('circle', { key: 'c', cx: 19, cy: 12, r: 2 }),
  React.createElement('path', { key: 'd', d: 'M7 12h3M14 12h3' }),
)
