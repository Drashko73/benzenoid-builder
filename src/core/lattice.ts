/**
 * Exact honeycomb (polyhex) geometry — a port of `molgen/lattice.py` from the
 * current-density project, kept line-for-line compatible so that both tools
 * produce identical coordinates for the same set of cells.
 *
 * A benzenoid is a set of hexagons on a triangular lattice. Every carbon sits on
 * a honeycomb lattice site, so the whole construction is done in *integer*
 * coordinates and converted to Angstroms once at the end: no float dedup
 * tolerances, no geometry optimisation.
 *
 * A hexagon at axial cell (q, r) has its centre at
 *
 *     (sqrt(3)·d·(q + r/2),  1.5·d·r)
 *
 * and six vertices at radius d, angles 90 + k·60 degrees. Writing those as
 *
 *     X = 2q + r + a_k,   Y = 3r + b_k
 *     (a_k, b_k) = (0,2) (-1,1) (-1,-1) (0,-2) (1,-1) (1,1)
 *
 * gives exact integers, with the Cartesian position (sqrt(3)·d·X/2, d·Y/2).
 *
 * Two sublattices exist, distinguished by Y mod 3 (always 1 or 2). Each site has
 * exactly three neighbour offsets. A carbon bonded to only two of them carries a
 * hydrogen along the third (missing) direction — the exterior angle bisector,
 * obtained without any trigonometry.
 */
import { element, formatFormula } from './elements';
import { principalRotation, type Rotation } from './orient';
import type { Atom, Bond, BuildParams, Cell, ElementSymbol, Molecule, Site } from './types';

/** Bond lengths fitted to the whole DFT dataset of the current-density project. */
export const CC_BOND = 1.42;
export const CH_BOND = 1.09;

export const DEFAULT_PARAMS: BuildParams = {
  ccBond: CC_BOND,
  chBond: CH_BOND,
  orient: 'principal',
};

/** Vertex offsets (a, b) for the six corners of one hexagon, k = 0..5, starting at the top. */
export const CELL_CORNERS: readonly (readonly [number, number])[] = [
  [0, 2],
  [-1, 1],
  [-1, -1],
  [0, -2],
  [1, -1],
  [1, 1],
];

/** The three neighbours of a site, keyed by sublattice (Y mod 3). */
export const NEIGHBOUR_OFFSETS: Readonly<Record<1 | 2, readonly (readonly [number, number])[]>> = {
  2: [
    [0, 2],
    [-1, -1],
    [1, -1],
  ],
  1: [
    [0, -2],
    [-1, 1],
    [1, 1],
  ],
};

/** The six cells sharing an edge with an axial cell (q, r). */
export const CELL_NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
];

const SQRT3 = Math.sqrt(3);

export function cellKey(cell: Cell): string;
export function cellKey(q: number, r: number): string;
export function cellKey(a: Cell | number, b?: number): string {
  return typeof a === 'number' ? `${a},${b}` : `${a[0]},${a[1]}`;
}

export function parseCellKey(key: string): Cell {
  const [q, r] = key.split(',').map(Number);
  if (!Number.isInteger(q) || !Number.isInteger(r)) throw new Error(`bad cell key ${key}`);
  return [q, r];
}

export function siteKey(site: Site): string {
  return `${site[0]},${site[1]}`;
}

/** Sublattice of a site; Y mod 3 is never 0 for a honeycomb vertex. */
export function sublattice(Y: number): 1 | 2 {
  const m = ((Y % 3) + 3) % 3;
  if (m !== 1 && m !== 2) throw new Error(`site Y=${Y} is not a honeycomb vertex`);
  return m;
}

/** Centre of cell (q, r) in Angstroms. */
export function cellCenter(cell: Cell, cc = CC_BOND): [number, number] {
  const [q, r] = cell;
  return [SQRT3 * cc * (q + r / 2), 1.5 * cc * r];
}

/** Integer lattice sites of the six carbons around hexagon (q, r), starting at the top corner. */
export function cellSites(cell: Cell): Site[] {
  const [q, r] = cell;
  return CELL_CORNERS.map(([a, b]) => [2 * q + r + a, 3 * r + b] as const);
}

/** Cartesian corner positions of a cell, in Angstroms (for drawing). */
export function cellPolygon(cell: Cell, cc = CC_BOND): [number, number][] {
  return cellSites(cell).map((s) => siteToCartesian(s, cc));
}

export function siteToCartesian(site: Site, cc = CC_BOND): [number, number] {
  return [(SQRT3 * cc * site[0]) / 2, (cc * site[1]) / 2];
}

/** Axial cell containing a Cartesian point (inverse of cellCenter, rounded to the nearest cell). */
export function cartesianToCell(x: number, y: number, cc = CC_BOND): Cell {
  const r = y / (1.5 * cc);
  const q = x / (SQRT3 * cc) - r / 2;
  return roundAxial(q, r);
}

function roundAxial(qf: number, rf: number): Cell {
  // Cube rounding (Red Blob Games): keep the two coordinates with the smallest error.
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf);
  const dr = Math.abs(r - rf);
  const ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return [q + 0, r + 0]; // "+ 0" turns -0 into +0
}

export function neighbourCells(cell: Cell): Cell[] {
  return CELL_NEIGHBOURS.map(([dq, dr]) => [cell[0] + dq, cell[1] + dr] as const);
}

export interface Skeleton {
  /** Sorted (X, then Y) integer carbon sites. */
  sites: Site[];
  index: Map<string, number>;
  /** neighbours[i] = indices of sites bonded to site i (0–3 entries). */
  neighbours: number[][];
}

function compareSites(a: Site, b: Site): number {
  return a[0] - b[0] || a[1] - b[1];
}

/**
 * Deduplicated carbon sites and their in-molecule neighbours.
 *
 * Any two sites that are lattice neighbours are treated as bonded, exactly as in
 * the Python generator. An unselected cell whose six corners are all present
 * therefore behaves like a ring; `validate.ts` reports those so the user can make
 * them explicit.
 */
export function buildSkeleton(cells: readonly Cell[]): Skeleton {
  const siteMap = new Map<string, Site>();
  for (const cell of cells) {
    for (const s of cellSites(cell)) siteMap.set(siteKey(s), s);
  }
  const sites = [...siteMap.values()].sort(compareSites);
  const index = new Map(sites.map((s, i) => [siteKey(s), i]));
  const neighbours = sites.map(([x, y]) => {
    const nb: number[] = [];
    for (const [dx, dy] of NEIGHBOUR_OFFSETS[sublattice(y)]) {
      const j = index.get(`${x + dx},${y + dy}`);
      if (j !== undefined) nb.push(j);
    }
    return nb;
  });
  return { sites, index, neighbours };
}

/** Unit direction (in Cartesian space) of a lattice offset. */
function offsetDirection(dx: number, dy: number): [number, number] {
  const vx = (SQRT3 * dx) / 2;
  const vy = dy / 2;
  const n = Math.hypot(vx, vy);
  return [vx / n, vy / n];
}

function applyRotation(rot: Rotation, x: number, y: number): [number, number] {
  // positions @ rot.T — i.e. rot applied to the column vector (x, y).
  return [rot[0][0] * x + rot[0][1] * y, rot[1][0] * x + rot[1][1] * y];
}

/**
 * Build a benzenoid from a list of axial hexagon cells.
 *
 * The cells are assumed to be a valid polyhex (see validate.ts); this function
 * builds geometry for any cell set that gives every carbon at least two carbon
 * neighbours. Applies the dataset convention: all-atom centroid at the origin,
 * molecule in the z = 0 plane, long axis along x when `orient === 'principal'`.
 */
export function buildMolecule(
  cellsIn: readonly Cell[],
  paramsIn: Partial<BuildParams> = {},
): Molecule {
  const params: BuildParams = { ...DEFAULT_PARAMS, ...paramsIn };
  const cells = [...cellsIn].map((c) => [c[0], c[1]] as const);
  const { sites, neighbours } = buildSkeleton(cells);

  const carbons = sites.map((s) => siteToCartesian(s, params.ccBond));
  const terminals: { element: ElementSymbol; pos: [number, number]; parent: number; site: Site }[] =
    [];

  sites.forEach(([x, y], i) => {
    const present = new Set(neighbours[i].map((j) => siteKey(sites[j])));
    const missing = NEIGHBOUR_OFFSETS[sublattice(y)].filter(
      ([dx, dy]) => !present.has(`${x + dx},${y + dy}`),
    );
    if (missing.length === 1) {
      const [dx, dy] = missing[0];
      const [ux, uy] = offsetDirection(dx, dy);
      const symbol: ElementSymbol = params.terminal?.[`${x},${y}`] ?? 'H';
      const length = symbol === 'H' ? params.chBond : element(symbol).bondToCarbon;
      terminals.push({
        element: symbol,
        pos: [carbons[i][0] + length * ux, carbons[i][1] + length * uy],
        parent: i,
        site: sites[i],
      });
    } else if (missing.length > 1) {
      throw new Error(
        `carbon at lattice site (${x}, ${y}) has only ${3 - missing.length} carbon neighbours; ` +
          'a benzenoid carbon needs at least two',
      );
    }
  });

  // --- dataset convention: centre on the all-atom centroid, long axis along x
  const all = [...carbons, ...terminals.map((t) => t.pos)];
  const n = all.length;
  const shift: [number, number] = n
    ? [all.reduce((s, p) => s + p[0], 0) / n, all.reduce((s, p) => s + p[1], 0) / n]
    : [0, 0];
  let cpos = carbons.map(([x, y]) => [x - shift[0], y - shift[1]] as [number, number]);
  let tpos = terminals.map(({ pos: [x, y] }) => [x - shift[0], y - shift[1]] as [number, number]);

  if (params.orient === 'principal') {
    const rot = principalRotation(cpos);
    if (rot) {
      cpos = cpos.map(([x, y]) => applyRotation(rot, x, y));
      tpos = tpos.map(([x, y]) => applyRotation(rot, x, y));
    }
  } else if (params.orient !== 'none') {
    throw new Error(`unknown orient '${String(params.orient)}'; use 'principal' or 'none'`);
  }

  const atoms: Atom[] = [];
  cpos.forEach(([x, y], i) => {
    atoms.push({ index: i, element: 'C', kind: 'ring', x, y, z: 0, site: sites[i] });
  });
  const nCarbon = atoms.length;
  tpos.forEach(([x, y], k) => {
    const t = terminals[k];
    atoms.push({
      index: nCarbon + k,
      element: t.element,
      kind: 'terminal',
      x,
      y,
      z: 0,
      site: t.site,
      parent: t.parent,
    });
  });

  const bonds: Bond[] = [];
  neighbours.forEach((nb, i) => {
    for (const j of nb) if (i < j) bonds.push({ a: i, b: j });
  });
  terminals.forEach((t, k) => bonds.push({ a: t.parent, b: nCarbon + k }));

  const counts: Partial<Record<ElementSymbol, number>> = {};
  for (const a of atoms) counts[a.element] = (counts[a.element] ?? 0) + 1;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let maxRadius = 0;
  for (const a of atoms) {
    minX = Math.min(minX, a.x);
    maxX = Math.max(maxX, a.x);
    minY = Math.min(minY, a.y);
    maxY = Math.max(maxY, a.y);
    maxRadius = Math.max(maxRadius, Math.hypot(a.x, a.y));
  }
  if (!atoms.length) minX = maxX = minY = maxY = 0;

  return {
    cells,
    atoms,
    bonds,
    carbonSites: sites,
    params,
    nCarbon,
    nHydrogen: counts.H ?? 0,
    counts,
    formula: formatFormula(counts),
    extent: { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY, maxRadius },
  };
}
