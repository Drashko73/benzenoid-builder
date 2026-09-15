import { describe, expect, it } from 'vitest';
import {
  MAX_SHARE_HASH_LENGTH,
  acene,
  buildMolecule,
  cellsToJson,
  decodeCells,
  decodeState,
  encodeCells,
  encodeState,
  formatFixed,
  hexFlake,
  parseCellsJson,
  parseXyz,
  toXyz,
} from '../src/core';
import type { Cell } from '../src/core';

describe('toXyz', () => {
  const text = toXyz(buildMolecule(acene(1)));
  const lines = text.split('\n');

  it('writes the atom count right-aligned in six columns', () => {
    expect(lines[0]).toBe('    12');
  });

  it('writes a two-space blank comment line by default', () => {
    expect(lines[1]).toBe('  ');
    expect(toXyz(buildMolecule(acene(1)), { comment: 'C6H6 benzene' }).split('\n')[1]).toBe(
      '  C6H6 benzene',
    );
  });

  it('uses atomic numbers and fixed column widths (%6d%22.6f%12.6f%12.6f)', () => {
    const row = /^ {5}[16] {5,}-?\d+\.\d{6} {3,}-?\d+\.\d{6} {3,}-?\d+\.\d{6}$/;
    for (const line of lines.slice(2, 14)) {
      expect(line).toMatch(row);
      expect(line.length).toBe(6 + 22 + 12 + 12);
    }
    expect(lines.slice(2, 8).every((l) => l.startsWith('     6'))).toBe(true);
    expect(lines.slice(8, 14).every((l) => l.startsWith('     1'))).toBe(true);
  });

  it('ends with a single trailing newline and uses LF only', () => {
    expect(text.endsWith('\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
    expect(text).not.toContain('\r');
  });

  it('can write element symbols instead of atomic numbers', () => {
    const symbolic = toXyz(buildMolecule(acene(1)), { symbols: true }).split('\n');
    expect(symbolic[2].startsWith('     C')).toBe(true);
    expect(symbolic[8].startsWith('     H')).toBe(true);
    expect(symbolic[2].length).toBe(52);
  });

  it('strips newlines from the comment', () => {
    expect(toXyz(buildMolecule(acene(1)), { comment: 'a\nb' }).split('\n')[1]).toBe('  a b');
  });

  it('round-trips through parseXyz', () => {
    const parsed = parseXyz(text);
    expect(parsed.atoms).toHaveLength(12);
    expect(parsed.atoms[0].Z).toBe(6);
    expect(parsed.atoms[11].Z).toBe(1);
  });
});

describe('formatFixed', () => {
  it('matches Python "%.6f" including negative zero', () => {
    expect(formatFixed(1.5, 6)).toBe('1.500000');
    expect(formatFixed(-0, 6)).toBe('-0.000000');
    expect(formatFixed(-4e-7, 6)).toBe('-0.000000');
    expect(formatFixed(0, 6)).toBe('0.000000');
  });
});

describe('cells JSON', () => {
  it('serialises sorted cells in the {"cells": [...]} form', () => {
    expect(
      cellsToJson([
        [1, 0],
        [0, 0],
      ]),
    ).toBe('{"cells":[[0,0],[1,0]]}');
  });

  it('parses the object form, the bare list, and loose text', () => {
    expect(parseCellsJson('{"cells": [[0,0],[1,0]]}')).toEqual([
      [0, 0],
      [1, 0],
    ]);
    expect(parseCellsJson('[[0, 0], [1, -1]]')).toEqual([
      [0, 0],
      [1, -1],
    ]);
    expect(parseCellsJson('0,0 1,0; 2,-1')).toEqual([
      [0, 0],
      [1, 0],
      [2, -1],
    ]);
  });

  it('rejects malformed input', () => {
    expect(() => parseCellsJson('{"cells": [[0]]}')).toThrow();
    expect(() => parseCellsJson('[[0.5, 1]]')).toThrow();
    expect(() => parseCellsJson('nonsense')).toThrow();
  });
});

describe('URL state', () => {
  it('round-trips cells and non-default parameters', () => {
    const hash = encodeState({
      cells: [
        [1, 0],
        [0, 0],
      ],
      ccBond: 1.4,
      chBond: 1.09,
      orient: 'none',
      name: 'naph',
    });
    expect(hash).toBe('c=0:0..1&cc=1.4&o=none&n=naph');
    expect(decodeState('#' + hash)).toEqual({
      cells: [
        [0, 0],
        [1, 0],
      ],
      ccBond: 1.4,
      orient: 'none',
      name: 'naph',
    });
  });

  it('encodes rows as ranges, including negative coordinates and gaps', () => {
    const cells: Cell[] = [
      [-2, -1],
      [-1, -1],
      [3, -1],
      [0, 2],
    ];
    const text = encodeCells(cells);
    expect(text).toBe('-1:-2..-1,3;2:0');
    expect(decodeCells(text)).toEqual(cells);
  });

  it('still decodes the legacy per-cell form', () => {
    expect(decodeState('#c=0,0;1,-1')).toEqual({
      cells: [
        [0, 0],
        [1, -1],
      ],
    });
  });

  it('keeps dense flakes far below the share-link limit', () => {
    const big = hexFlake(40); // 4921 rings
    const text = encodeCells(big);
    expect(text.length).toBeLessThan(1500);
    expect(text.length).toBeLessThan(MAX_SHARE_HASH_LENGTH);
    expect(decodeCells(text)).toHaveLength(big.length);
  });

  it('omits default parameters and tolerates an empty selection', () => {
    expect(encodeState({ cells: [], ccBond: 1.42, orient: 'principal' })).toBe('c=');
    expect(decodeState('#c=')).toEqual({ cells: [] });
  });

  it('returns null for unrelated or malformed hashes', () => {
    expect(decodeState('')).toBeNull();
    expect(decodeState('#foo=bar')).toBeNull();
    expect(decodeState('#c=1,x')).toBeNull();
    expect(decodeState('#c=1:x')).toBeNull();
    expect(decodeState('#c=1:5..2')).toBeNull();
    expect(decodeCells('0:0..999999')).toBeNull(); // refuses absurd ranges
  });
});
