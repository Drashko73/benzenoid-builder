import { describe, expect, it } from 'vitest';
import {
  acene,
  buildMolecule,
  connectedComponents,
  hexFlake,
  implicitRings,
  terminalClashes,
  validateCells,
  zigzag,
} from '../src/core';
import type { Cell } from '../src/core';

// The six cells around (0, 0), in angular order.
const RING: Cell[] = [
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
  [1, -1],
];

const ids = (cells: Cell[]) => validateCells(cells).issues.map((i) => i.id);

describe('validateCells', () => {
  it('rejects an empty selection', () => {
    expect(ids([])).toEqual(['empty']);
  });

  it('accepts benzene, phenanthrene (bay region) and coronene without issues', () => {
    expect(ids(acene(1))).toEqual([]);
    expect(ids(zigzag(3))).toEqual([]);
    expect(ids(hexFlake(1))).toEqual([]);
  });

  it('rejects rings that touch only at a corner', () => {
    // (0,0) and (1,1) share one vertex but no edge
    const result = validateCells([
      [0, 0],
      [1, 1],
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors[0].id).toBe('disconnected');
    expect(result.errors[0].fix?.action).toEqual({ kind: 'keep-cells', cells: [[0, 0]] });
  });

  it('offers to keep the largest fragment', () => {
    const result = validateCells([...acene(3), [10, 10]]);
    const fix = result.errors[0].fix!.action;
    expect(fix.kind).toBe('keep-cells');
    expect(fix.cells).toHaveLength(3);
  });

  it('detects the enclosed ring when six rings surround an empty centre', () => {
    const result = validateCells(RING);
    expect(result.ok).toBe(false);
    expect(result.errors[0].id).toBe('implicit-ring');
    expect(result.errors[0].cells).toEqual([[0, 0]]);
    expect(result.errors[0].fix?.action).toEqual({ kind: 'add-cells', cells: [[0, 0]] });
  });

  it('detects the enclosed ring with five neighbours (benzo[ghi]perylene case)', () => {
    expect(implicitRings(RING.slice(0, 5))).toEqual([[0, 0]]);
  });

  it('does not flag a genuine cavity (four neighbours leave a corner free)', () => {
    expect(implicitRings(RING.slice(0, 4))).toEqual([]);
  });

  it('flags the fjord of [4]helicene as an H–H overlap error', () => {
    const result = validateCells(RING.slice(0, 4));
    expect(result.ok).toBe(false);
    expect(result.errors[0].id).toBe('hh-clash');
    expect(result.errors[0].atoms).toHaveLength(2);
    const clashes = terminalClashes(buildMolecule(RING.slice(0, 4)), 1.0);
    expect(clashes[0].distance).toBeCloseTo(0.572, 2);
  });

  it('does not flag an ordinary bay region', () => {
    expect(terminalClashes(buildMolecule(zigzag(3)), 1.5)).toEqual([]);
    expect(terminalClashes(buildMolecule(zigzag(3)), 1.8)[0].distance).toBeCloseTo(1.75, 2);
  });

  it('warns above the training-set size and errors above the hard limit', () => {
    const r2 = validateCells(hexFlake(2)); // C54H18 = 72 atoms
    expect(r2.ok).toBe(true);
    const r3 = validateCells(hexFlake(3)); // C96H24 = 120 atoms
    expect(r3.ok).toBe(true);
    const big = validateCells(hexFlake(4)); // C150H30 = 180 atoms
    expect(big.ok).toBe(false);
    expect(big.errors[0].id).toBe('too-large');

    const custom = validateCells(hexFlake(3), {
      limits: { trainingMaxAtoms: 100, hardMaxAtoms: 200 },
    });
    expect(custom.ok).toBe(true);
    expect(custom.warnings[0].id).toBe('outside-training');
  });

  it('skips geometry checks while structural errors are present', () => {
    const result = validateCells([...RING.slice(0, 4), [20, 20]]);
    expect(result.issues.map((i) => i.id)).toEqual(['disconnected']);
  });
});

describe('connectedComponents', () => {
  it('orders components largest first', () => {
    const comps = connectedComponents([[5, 5], ...acene(2), [9, 9], [10, 9], [11, 9]]);
    expect(comps.map((c) => c.length)).toEqual([3, 2, 1]);
  });
});
