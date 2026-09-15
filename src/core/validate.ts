/**
 * Validation of a cell selection, in two tiers:
 *
 *   errors   — the selection does not describe a single planar benzenoid;
 *   warnings — the molecule is fine but the planar idealisation is
 *              questionable (crowded hydrogens).
 *
 * Every issue carries the cells/atoms to highlight and, where possible, a
 * one-click fix.
 */
import {
  buildMolecule,
  cellKey,
  cellSites,
  neighbourCells,
  parseCellKey,
  siteKey,
} from './lattice';
import type { BuildParams, Cell, Molecule, ValidationIssue, ValidationResult } from './types';

/** Below this H–H distance the planar model is physically wrong (fjord regions: 0.57 Å). */
export const HH_CLASH_ERROR = 1.0;
/** Below this the hydrogens are crowded; an ordinary bay region sits at 1.75 Å. */
export const HH_CLASH_WARNING = 1.5;

export interface ValidateOptions {
  params?: Partial<BuildParams>;
}

/** Edge-connected components of a cell set, largest first. */
export function connectedComponents(cells: readonly Cell[]): Cell[][] {
  const remaining = new Set(cells.map((c) => cellKey(c)));
  const components: Cell[][] = [];
  while (remaining.size) {
    const start = remaining.values().next().value as string;
    remaining.delete(start);
    const component: Cell[] = [parseCellKey(start)];
    const stack = [parseCellKey(start)];
    while (stack.length) {
      const cell = stack.pop()!;
      for (const nb of neighbourCells(cell)) {
        const key = cellKey(nb);
        if (remaining.has(key)) {
          remaining.delete(key);
          component.push(nb);
          stack.push(nb);
        }
      }
    }
    components.push(component);
  }
  return components.sort((a, b) => b.length - a.length);
}

/**
 * Unselected cells whose six corners are all carbons of the selection. Such a
 * cell is a ring in everything but name: its six edges are C–C bonds already,
 * so the geometry is that of the filled molecule while the ring count is off by
 * one — or, with five neighbours present, two carbons 1.42 Å apart would each
 * carry a hydrogen pointing at the other. A planar benzenoid cannot have it.
 */
export function implicitRings(cells: readonly Cell[]): Cell[] {
  const selected = new Set(cells.map((c) => cellKey(c)));
  const sites = new Set<string>();
  for (const cell of cells) for (const s of cellSites(cell)) sites.add(siteKey(s));

  const candidates = new Map<string, Cell>();
  for (const cell of cells) {
    for (const nb of neighbourCells(cell)) {
      const key = cellKey(nb);
      if (!selected.has(key)) candidates.set(key, nb);
    }
  }
  const found: Cell[] = [];
  for (const cell of candidates.values()) {
    if (cellSites(cell).every((s) => sites.has(siteKey(s)))) found.push(cell);
  }
  return found.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/** Pairs of terminal atoms closer than `threshold` Angstroms, nearest first. */
export function terminalClashes(
  molecule: Molecule,
  threshold: number,
): { a: number; b: number; distance: number }[] {
  const terminals = molecule.atoms.filter((a) => a.kind === 'terminal');
  const out: { a: number; b: number; distance: number }[] = [];
  for (let i = 0; i < terminals.length; i++) {
    for (let j = i + 1; j < terminals.length; j++) {
      const d = Math.hypot(terminals[i].x - terminals[j].x, terminals[i].y - terminals[j].y);
      if (d < threshold) out.push({ a: terminals[i].index, b: terminals[j].index, distance: d });
    }
  }
  return out.sort((p, q) => p.distance - q.distance);
}

function summarise(result: ValidationIssue[]): ValidationResult {
  const errors = result.filter((i) => i.severity === 'error');
  const warnings = result.filter((i) => i.severity !== 'error');
  return { issues: result, errors, warnings, ok: errors.length === 0 };
}

/**
 * Validate a selection. Geometry-dependent checks (clashes) are skipped
 * while structural errors (disconnected, implicit rings) are present, because
 * the geometry of such a selection is not meaningful.
 */
export function validateCells(
  cells: readonly Cell[],
  options: ValidateOptions = {},
): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (cells.length === 0) {
    issues.push({
      id: 'empty',
      severity: 'error',
      title: 'No rings selected',
      detail: 'Click hexagons on the grid to add rings, or load a preset.',
    });
    return summarise(issues);
  }

  const components = connectedComponents(cells);
  if (components.length > 1) {
    const largest = components[0];
    const others = components.slice(1).flat();
    issues.push({
      id: 'disconnected',
      severity: 'error',
      title: `${components.length} separate fragments`,
      detail:
        'Rings must share an edge to be part of the same molecule; touching at a corner is not enough. ' +
        `The largest fragment has ${largest.length} ring${largest.length === 1 ? '' : 's'}.`,
      cells: others,
      fix: { label: 'Keep largest fragment', action: { kind: 'keep-cells', cells: largest } },
    });
  }

  const implicit = implicitRings(cells);
  if (implicit.length) {
    issues.push({
      id: 'implicit-ring',
      severity: 'error',
      title: `${implicit.length} enclosed ring${implicit.length === 1 ? '' : 's'} not selected`,
      detail:
        'All six corners of the highlighted hexagon are already carbons, so it is a ring of the ' +
        'molecule whether or not it is selected. A planar benzenoid cannot have this cavity — fill it, ' +
        'or remove some of the rings around it.',
      cells: implicit,
      fix: { label: 'Fill enclosed rings', action: { kind: 'add-cells', cells: implicit } },
    });
  }

  if (issues.length) return summarise(issues);

  const molecule = buildMolecule(cells, options.params);

  const clashes = terminalClashes(molecule, HH_CLASH_WARNING);
  const severe = clashes.filter((c) => c.distance < HH_CLASH_ERROR);
  if (severe.length) {
    issues.push({
      id: 'hh-clash',
      severity: 'error',
      title: `Hydrogens overlap (${severe[0].distance.toFixed(2)} Å apart)`,
      detail:
        'In a fjord region the planar model puts two hydrogens on top of each other. The real ' +
        'molecule (a helicene) twists out of the plane, which this 2D builder cannot represent.',
      atoms: severe.flatMap((c) => [c.a, c.b]),
    });
  } else if (clashes.length) {
    issues.push({
      id: 'hh-crowded',
      severity: 'warning',
      title: `Crowded hydrogens (${clashes[0].distance.toFixed(2)} Å apart)`,
      detail:
        'Two hydrogens are closer than in an ordinary bay region (1.75 Å). The real molecule ' +
        'probably distorts slightly; the ideal-lattice geometry is still exported as is.',
      atoms: clashes.flatMap((c) => [c.a, c.b]),
    });
  }

  return summarise(issues);
}
