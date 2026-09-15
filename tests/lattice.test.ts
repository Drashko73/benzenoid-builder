import { describe, expect, it } from 'vitest';
import {
  CC_BOND,
  CH_BOND,
  buildMolecule,
  buildSkeleton,
  cartesianToCell,
  cellCenter,
  cellPolygon,
  cellSites,
  siteToCartesian,
  sublattice,
} from '../src/core';
import { acene, hexFlake } from '../src/core';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe('integer honeycomb lattice', () => {
  it('places cell corners at radius d from the cell centre', () => {
    for (const cell of [
      [0, 0],
      [3, -2],
      [-4, 5],
    ] as const) {
      const [cx, cy] = cellCenter(cell);
      for (const [x, y] of cellPolygon(cell)) {
        expect(Math.hypot(x - cx, y - cy)).toBeCloseTo(CC_BOND, 9);
      }
    }
  });

  it('starts the corner list at the top vertex (pointy-top orientation)', () => {
    const [cx, cy] = cellCenter([0, 0]);
    const [tx, ty] = cellPolygon([0, 0])[0];
    expect(tx).toBeCloseTo(cx, 9);
    expect(ty - cy).toBeCloseTo(CC_BOND, 9);
  });

  it('never produces a site with Y divisible by 3', () => {
    for (const cell of hexFlake(3)) {
      for (const [, Y] of cellSites(cell)) expect([1, 2]).toContain(sublattice(Y));
    }
  });

  it('shares exactly two sites between edge-adjacent cells', () => {
    const a = new Set(cellSites([0, 0]).map(String));
    const shared = cellSites([1, 0]).filter((s) => a.has(String(s)));
    expect(shared).toHaveLength(2);
  });

  it('inverts cellCenter with cartesianToCell', () => {
    for (const cell of hexFlake(4)) {
      const [x, y] = cellCenter(cell);
      expect(cartesianToCell(x + 0.3, y - 0.4)).toEqual(cell);
    }
  });

  it('dedups sites and finds three neighbours for interior carbons', () => {
    const { sites, neighbours } = buildSkeleton(hexFlake(1));
    expect(sites).toHaveLength(24);
    const counts = neighbours.map((n) => n.length);
    expect(counts.filter((c) => c === 3)).toHaveLength(12);
    expect(counts.filter((c) => c === 2)).toHaveLength(12);
  });

  it('scales sites with the bond length', () => {
    const [x, y] = siteToCartesian([2, 1], 2.0);
    expect(x).toBeCloseTo(Math.sqrt(3) * 2, 9);
    expect(y).toBeCloseTo(1, 9);
  });
});

describe('buildMolecule', () => {
  it('builds benzene as C6H6 with ideal bond lengths and angles', () => {
    const m = buildMolecule(acene(1));
    expect(m.formula).toBe('C6H6');
    expect(m.nCarbon).toBe(6);
    expect(m.nHydrogen).toBe(6);
    expect(m.atoms.every((a) => a.z === 0)).toBe(true);

    for (const { a, b } of m.bonds) {
      const expected = m.atoms[b].element === 'H' ? CH_BOND : CC_BOND;
      expect(dist(m.atoms[a], m.atoms[b])).toBeCloseTo(expected, 9);
    }
    // every C–C–C angle is 120 degrees
    const carbons = m.atoms.filter((a) => a.element === 'C');
    for (const c of carbons) {
      const nb = m.bonds
        .filter(
          (bd) =>
            (bd.a === c.index || bd.b === c.index) &&
            m.atoms[bd.a].element === 'C' &&
            m.atoms[bd.b].element === 'C',
        )
        .map((bd) => (bd.a === c.index ? m.atoms[bd.b] : m.atoms[bd.a]));
      expect(nb).toHaveLength(2);
      const v1 = [nb[0].x - c.x, nb[0].y - c.y];
      const v2 = [nb[1].x - c.x, nb[1].y - c.y];
      const cos = (v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2));
      expect((Math.acos(cos) * 180) / Math.PI).toBeCloseTo(120, 6);
    }
  });

  it('orders atoms carbons-first, hydrogens in parent order', () => {
    const m = buildMolecule(hexFlake(1));
    expect(m.atoms.slice(0, m.nCarbon).every((a) => a.element === 'C')).toBe(true);
    const parents = m.atoms.slice(m.nCarbon).map((a) => a.parent!);
    expect([...parents].sort((a, b) => a - b)).toEqual(parents);
  });

  it('centres the all-atom centroid on the origin', () => {
    const m = buildMolecule([
      [0, 0],
      [1, 0],
      [1, 1],
    ]);
    const n = m.atoms.length;
    expect(m.atoms.reduce((s, a) => s + a.x, 0) / n).toBeCloseTo(0, 9);
    expect(m.atoms.reduce((s, a) => s + a.y, 0) / n).toBeCloseTo(0, 9);
  });

  it('puts the long axis of an acene along x', () => {
    const m = buildMolecule(acene(4));
    expect(m.extent.width).toBeGreaterThan(m.extent.height * 2);
    const lattice = buildMolecule(acene(4), { orient: 'none' });
    // an acene along q is already along x, so both frames agree
    expect(lattice.extent.width).toBeCloseTo(m.extent.width, 6);
  });

  it('keeps the lattice orientation for round molecules', () => {
    const a = buildMolecule(hexFlake(1));
    const b = buildMolecule(hexFlake(1), { orient: 'none' });
    a.atoms.forEach((atom, i) => {
      expect(atom.x).toBeCloseTo(b.atoms[i].x, 9);
      expect(atom.y).toBeCloseTo(b.atoms[i].y, 9);
    });
  });

  it('honours custom bond lengths', () => {
    const m = buildMolecule(acene(2), { ccBond: 1.4, chBond: 1.08 });
    for (const { a, b } of m.bonds) {
      const expected = m.atoms[b].element === 'H' ? 1.08 : 1.4;
      expect(dist(m.atoms[a], m.atoms[b])).toBeCloseTo(expected, 9);
    }
  });

  it('supports terminal-atom substitution through the params', () => {
    const benzene = buildMolecule(acene(1));
    const site = benzene.atoms[0].site!;
    const m = buildMolecule(acene(1), { terminal: { [`${site[0]},${site[1]}`]: 'F' } });
    expect(m.formula).toBe('C6H5F');
    const f = m.atoms.find((a) => a.element === 'F')!;
    expect(dist(f, m.atoms[f.parent!])).toBeCloseTo(1.35, 9);
  });

  it('returns an empty molecule for no cells', () => {
    const m = buildMolecule([]);
    expect(m.atoms).toHaveLength(0);
    expect(m.formula).toBe('');
  });
});
