/**
 * Shared types for the chemistry core. Nothing in src/core touches the DOM.
 */

/** Axial hexagon coordinates (q, r) on the triangular lattice of ring centres. */
export type Cell = readonly [q: number, r: number];

/** Integer honeycomb site (X, Y): a carbon position before scaling to Angstroms. */
export type Site = readonly [X: number, Y: number];

export type ElementSymbol = 'H' | 'C' | 'N' | 'O' | 'F' | 'S' | 'Cl' | 'B';

export interface ElementInfo {
  symbol: ElementSymbol;
  name: string;
  /** Atomic number, written in the .xyz files instead of the symbol. */
  Z: number;
  /** CPK-style display colour. */
  color: string;
  /** Covalent radius in Angstroms (display sizing only). */
  covalentRadius: number;
  /** Typical single-bond length to an aromatic carbon, in Angstroms. */
  bondToCarbon: number;
}

export type AtomKind = 'ring' | 'terminal';

export interface Atom {
  /** Row index in the exported file (carbons first, then terminal atoms). */
  index: number;
  element: ElementSymbol;
  kind: AtomKind;
  x: number;
  y: number;
  z: number;
  /** Integer lattice site for ring carbons. */
  site?: Site;
  /** For terminal atoms: index of the ring carbon they are bonded to. */
  parent?: number;
}

export interface Bond {
  a: number;
  b: number;
}

export type Orientation = 'principal' | 'none';

export interface BuildParams {
  /** Aromatic C–C bond length in Angstroms. */
  ccBond: number;
  /** C–H bond length in Angstroms. */
  chBond: number;
  /** 'principal': centre on the centroid and put the long axis along +x (dataset convention). */
  orient: Orientation;
  /**
   * Optional terminal-atom substitutions keyed by site key ("X,Y"). Any perimeter carbon
   * not listed carries a hydrogen. This is the extension point for substituents; the UI
   * does not expose it yet.
   */
  terminal?: Readonly<Record<string, ElementSymbol>>;
}

export interface Molecule {
  cells: Cell[];
  atoms: Atom[];
  bonds: Bond[];
  /** Sorted integer carbon sites; atoms[i].site === carbonSites[i] for i < nCarbon. */
  carbonSites: Site[];
  params: BuildParams;
  nCarbon: number;
  nHydrogen: number;
  /** Counts per element symbol, e.g. { C: 24, H: 12 }. */
  counts: Partial<Record<ElementSymbol, number>>;
  /** Hill-style formula, e.g. "C24H12". */
  formula: string;
  /** Bounding box of all atoms after orientation, in Angstroms. */
  extent: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
    maxRadius: number;
  };
}

export type Severity = 'error' | 'warning' | 'info';

export type FixAction =
  | { kind: 'add-cells'; cells: Cell[] }
  | { kind: 'remove-cells'; cells: Cell[] }
  | { kind: 'keep-cells'; cells: Cell[] };

export interface ValidationIssue {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  /** Cells to highlight on the canvas. */
  cells?: Cell[];
  /** Atom indices to highlight on the canvas. */
  atoms?: number[];
  fix?: { label: string; action: FixAction };
}

export interface ModelLimits {
  /** Largest training molecule (atoms); above this the prediction is extrapolating. */
  trainingMaxAtoms: number;
  /** Hard padding limit of the prediction model. */
  hardMaxAtoms: number;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  /** True when there are no errors (the molecule can be exported). */
  ok: boolean;
}
