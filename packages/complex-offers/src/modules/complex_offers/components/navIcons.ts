import React from 'react'

const svg = (...children: React.ReactElement[]) =>
  React.createElement(
    'svg',
    { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
    ...children,
  )

/** A document with a price line — an offer. */
export const offersIcon = svg(
  React.createElement('path', { key: 'a', d: 'M6 2h9l5 5v15H6z' }),
  React.createElement('path', { key: 'b', d: 'M14 2v6h6' }),
  React.createElement('path', { key: 'c', d: 'M9 13h6M9 17h4' }),
)

/** Sliders — a model with parameters and pricing rules. */
export const modelsIcon = svg(
  React.createElement('path', { key: 'a', d: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0' }),
  React.createElement('circle', { key: 'b', cx: 16, cy: 6, r: 2 }),
  React.createElement('circle', { key: 'c', cx: 10, cy: 12, r: 2 }),
  React.createElement('circle', { key: 'd', cx: 18, cy: 18, r: 2 }),
)
