/**
 * Generate public/favicon.svg from the lattice geometry: three fused rings
 * (the phenalene motif) with carbon dots, in the app's amber / charcoal palette.
 *
 *     node scripts/favicon.mjs
 */
import { writeFileSync } from 'node:fs';

const d = 1; // bond length in icon units
const SQRT3 = Math.sqrt(3);
const cells = [
  [0, 0],
  [1, 0],
  [0, 1],
]; // three mutually adjacent rings

const corners = [
  [0, 2],
  [-1, 1],
  [-1, -1],
  [0, -2],
  [1, -1],
  [1, 1],
];
const site = ([q, r], [a, b]) => [2 * q + r + a, 3 * r + b];
const xy = ([X, Y]) => [(SQRT3 * d * X) / 2, (d * Y) / 2];

const polygons = cells.map((c) => corners.map((k) => xy(site(c, k))));
const sites = new Map();
for (const poly of polygons)
  for (const [x, y] of poly) sites.set(`${x.toFixed(4)},${y.toFixed(4)}`, [x, y]);

const pts = [...sites.values()];
const minX = Math.min(...pts.map((p) => p[0]));
const maxX = Math.max(...pts.map((p) => p[0]));
const minY = Math.min(...pts.map((p) => p[1]));
const maxY = Math.max(...pts.map((p) => p[1]));
const cx = (minX + maxX) / 2;
const cy = (minY + maxY) / 2;
const half = Math.max(maxX - minX, maxY - minY) / 2 + 0.55;

// y is flipped so the icon is drawn "chemistry up"; the rounded square is the background.
const fmt = (v) => v.toFixed(3);
const polyText = (poly) => poly.map(([x, y]) => `${fmt(x - cx)},${fmt(-(y - cy))}`).join(' ');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(-half)} ${fmt(-half)} ${fmt(2 * half)} ${fmt(2 * half)}">
  <rect x="${fmt(-half)}" y="${fmt(-half)}" width="${fmt(2 * half)}" height="${fmt(2 * half)}" rx="${fmt(half * 0.28)}" fill="#1f2933"/>
  <g fill="#f5b942" stroke="#1f2933" stroke-width="0.14" stroke-linejoin="round">
${polygons.map((p) => `    <polygon points="${polyText(p)}"/>`).join('\n')}
  </g>
  <g fill="#fff4dc">
${pts.map(([x, y]) => `    <circle cx="${fmt(x - cx)}" cy="${fmt(-(y - cy))}" r="0.2"/>`).join('\n')}
  </g>
</svg>
`;
writeFileSync('public/favicon.svg', svg);
console.log(`wrote public/favicon.svg (${pts.length} carbons)`);
