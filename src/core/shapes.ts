/**
 * Parametric families of benzenoids, identical to `molgen/shapes.py` so that a
 * family generated here matches the one the current-density API produces.
 */
import type { Cell } from './types';

/** Linear chain of n fused rings: benzene, naphthalene, anthracene, tetracene, ... */
export function acene(n: number): Cell[] {
  if (n < 1) throw new RangeError('acene needs n >= 1');
  return Array.from({ length: n }, (_, i) => [i, 0] as const);
}

/** Angular (phenanthrene-like) chain of n rings, alternating the bend; n = 4 is chrysene. */
export function zigzag(n: number): Cell[] {
  if (n < 1) throw new RangeError('zigzag needs n >= 1');
  const cells: Cell[] = [[0, 0]];
  let q = 0;
  let r = 0;
  for (let i = 0; i < n - 1; i++) {
    const [dq, dr] = i % 2 === 0 ? [1, 0] : [1, -1];
    q += dq;
    r += dr;
    cells.push([q, r]);
  }
  return cells;
}

/** Compact hexagonal flake: every cell within `radius` of the centre. 0 = benzene, 1 = coronene. */
export function hexFlake(radius: number): Cell[] {
  if (radius < 0) throw new RangeError('hexFlake needs radius >= 0');
  const cells: Cell[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if ((Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2 <= radius) cells.push([q + 0, r + 0]);
    }
  }
  return cells;
}

/** Compact rows x cols block of rings; rows = 1 is an acene, 2 x 2 is pyrene. */
export function rectFlake(rows: number, cols: number): Cell[] {
  if (rows < 1 || cols < 1) throw new RangeError('rectFlake needs rows >= 1 and cols >= 1');
  const cells: Cell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let q = 0; q < cols; q++) cells.push([q - Math.floor(r / 2), r]);
  }
  return cells;
}

export interface FamilyParam {
  key: string;
  label: string;
  min: number;
  max: number;
  default: number;
}

export interface Family {
  id: 'acene' | 'zigzag' | 'hex_flake' | 'rect_flake';
  name: string;
  description: string;
  params: FamilyParam[];
  build: (values: Record<string, number>) => Cell[];
}

export const FAMILIES: readonly Family[] = [
  {
    id: 'acene',
    name: 'Acene',
    description: 'n rings in a straight line',
    params: [{ key: 'n', label: 'rings', min: 1, max: 30, default: 3 }],
    build: (v) => acene(v.n),
  },
  {
    id: 'zigzag',
    name: 'Zigzag (angular)',
    description: 'n rings in an angular chain; 3 = phenanthrene, 4 = chrysene',
    params: [{ key: 'n', label: 'rings', min: 1, max: 30, default: 4 }],
    build: (v) => zigzag(v.n),
  },
  {
    id: 'hex_flake',
    name: 'Hexagonal flake',
    description: 'all rings within a radius; 0 = benzene, 1 = coronene, 2 = C54H18',
    params: [{ key: 'radius', label: 'radius', min: 0, max: 6, default: 1 }],
    build: (v) => hexFlake(v.radius),
  },
  {
    id: 'rect_flake',
    name: 'Rectangular flake',
    description: 'rows x cols block of rings; 2 x 2 = pyrene',
    params: [
      { key: 'rows', label: 'rows', min: 1, max: 12, default: 2 },
      { key: 'cols', label: 'cols', min: 1, max: 12, default: 3 },
    ],
    build: (v) => rectFlake(v.rows, v.cols),
  },
];
