import React from 'react'

const svg = (...children: React.ReactElement[]) =>
  React.createElement(
    'svg',
    { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
    ...children,
  )

/** A clipboard — the customer's order. */
export const ordersIcon = svg(
  React.createElement('rect', { key: 'a', x: 5, y: 4, width: 14, height: 17, rx: 2 }),
  React.createElement('path', { key: 'b', d: 'M9 4V3h6v1M9 10h6M9 14h6M9 18h3' }),
)

/** Three columns — the department board. */
export const boardIcon = svg(
  React.createElement('rect', { key: 'a', x: 3, y: 4, width: 5, height: 16, rx: 1 }),
  React.createElement('rect', { key: 'b', x: 10, y: 4, width: 5, height: 11, rx: 1 }),
  React.createElement('rect', { key: 'c', x: 17, y: 4, width: 4, height: 7, rx: 1 }),
)

/** A building with sections — departments. */
export const departmentsIcon = svg(
  React.createElement('path', { key: 'a', d: 'M3 21V9l6-4v4l6-4v4l6-4v16z' }),
  React.createElement('path', { key: 'b', d: 'M7 17h2M12 17h2M17 17h1' }),
)

/** An arrow through stations — product routing. */
export const routingIcon = svg(
  React.createElement('circle', { key: 'a', cx: 5, cy: 12, r: 2 }),
  React.createElement('circle', { key: 'b', cx: 12, cy: 12, r: 2 }),
  React.createElement('circle', { key: 'c', cx: 19, cy: 12, r: 2 }),
  React.createElement('path', { key: 'd', d: 'M7 12h3M14 12h3' }),
)
