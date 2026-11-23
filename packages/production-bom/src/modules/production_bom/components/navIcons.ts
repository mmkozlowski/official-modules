import React from 'react'

const svg = (...children: React.ReactElement[]) =>
  React.createElement(
    'svg',
    { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
    ...children,
  )

/** A roll of material. */
export const materialsIcon = svg(
  React.createElement('ellipse', { key: 'a', cx: 7, cy: 12, rx: 3, ry: 7 }),
  React.createElement('path', { key: 'b', d: 'M7 5h10a3 7 0 0 1 0 14H7' }),
  React.createElement('path', { key: 'c', d: 'M17 19h4' }),
)

/** A list with a box — product and its bill of materials. */
export const productsIcon = svg(
  React.createElement('rect', { key: 'a', x: 3, y: 3, width: 8, height: 8, rx: 1 }),
  React.createElement('path', { key: 'b', d: 'M14 5h7M14 9h5M3 15h18M3 19h13' }),
)
