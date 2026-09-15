import { describe, expect, it } from 'vitest';
import {
  FAMILIES,
  PRESETS,
  acene,
  buildMolecule,
  cellKey,
  hexFlake,
  presetById,
  rectFlake,
  validateCells,
  zigzag,
} from '../src/core';
import type { Cell } from '../src/core';

/** Canonical string of a cell set under translation, the six rotations and mirroring. */
function canonical(cells: readonly Cell[]): string {
  const normalise = (cs: Cell[]) => {
    const minQ = Math.min(...cs.map((c) => c[0]));
    const minR = Math.min(...cs.map((c) => c[1]));
    return cs
      .map((c) => cellKey(c[0] - minQ, c[1] - minR))
      .sort()
      .join(' ');
  };
  const rotate = (cs: Cell[]): Cell[] => cs.map(([q, r]) => [-r, q + r]);
  const mirror = (cs: Cell[]): Cell[] => cs.map(([q, r]) => [r, q]);
  const forms: string[] = [];
  for (const start of [cells.slice(), mirror(cells.slice())]) {
    let cs = start;
    for (let k = 0; k < 6; k++) {
      forms.push(normalise(cs));
      cs = rotate(cs);
    }
  }
  return forms.sort()[0];
}

/** Two cell sets describe the same molecule if they coincide up to a lattice symmetry. */
function sameShape(a: readonly Cell[], b: readonly Cell[]): boolean {
  return a.length === b.length && canonical(a) === canonical(b);
}

describe('families reproduce the named molecules (mirrors test_known_family_identities)', () => {
  it('acene(1) is benzene, acene(2) naphthalene, acene(3) anthracene, acene(4) tetracene', () => {
    expect(sameShape(acene(1), presetById('benzene')!.cells)).toBe(true);
    expect(sameShape(acene(2), presetById('naphthalene')!.cells)).toBe(true);
    expect(sameShape(acene(3), presetById('anthracene')!.cells)).toBe(true);
    expect(sameShape(acene(4), presetById('tetracene')!.cells)).toBe(true);
  });

  it('zigzag(3) is phenanthrene and zigzag(4) is chrysene', () => {
    expect(buildMolecule(zigzag(3)).formula).toBe('C14H10');
    expect(buildMolecule(zigzag(4)).formula).toBe('C18H12');
    expect(sameShape(zigzag(4), presetById('chrysene')!.cells)).toBe(true);
  });

  it('hexFlake(0) is benzene and hexFlake(1) is coronene', () => {
    expect(hexFlake(0)).toEqual([[0, 0]]);
    expect(sameShape(hexFlake(1), presetById('coronene')!.cells)).toBe(true);
    expect(buildMolecule(hexFlake(2)).formula).toBe('C54H18');
  });

  it('rectFlake(1, n) is an acene and rectFlake(2, 2) is pyrene', () => {
    expect(sameShape(rectFlake(1, 5), acene(5))).toBe(true);
    expect(sameShape(rectFlake(2, 2), presetById('pyrene')!.cells)).toBe(true);
  });

  it('rejects out-of-range parameters', () => {
    expect(() => acene(0)).toThrow();
    expect(() => hexFlake(-1)).toThrow();
    expect(() => rectFlake(0, 2)).toThrow();
  });

  it('every family default builds a valid molecule', () => {
    for (const family of FAMILIES) {
      const values = Object.fromEntries(family.params.map((p) => [p.key, p.default]));
      expect(validateCells(family.build(values)).ok).toBe(true);
    }
  });
});

describe('presets', () => {
  it('all have the formula they claim and validate cleanly', () => {
    for (const preset of PRESETS) {
      expect(buildMolecule(preset.cells).formula, preset.id).toBe(preset.formula);
      expect(validateCells(preset.cells).ok, preset.id).toBe(true);
    }
  });

  it('have unique ids', () => {
    const ids = PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
