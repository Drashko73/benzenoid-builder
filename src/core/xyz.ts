/**
 * .xyz serialisation matching the files of the current-density dataset.
 *
 * Those files use atomic numbers rather than symbols, a blank comment line, and
 * fixed column widths:
 *
 *         12
 *       <- two spaces
 *          6             -1.030328   -0.934616    0.000001
 *
 * which is "%6d%22.6f%12.6f%12.6f" per atom. Readers split on whitespace, so
 * the widths are cosmetic — but matching them keeps generated files visually
 * indistinguishable from the DFT ones. Do not change this format.
 */
import { atomicNumber } from './elements';
import type { Cell, Molecule } from './types';

/** Python-compatible "%.{digits}f": keeps the sign of negative zero. */
export function formatFixed(value: number, digits: number): string {
  const s = value.toFixed(digits);
  return Object.is(value, -0) && !s.startsWith('-') ? `-${s}` : s;
}

function pad(text: string, width: number): string {
  return text.padStart(width, ' ');
}

export interface XyzOptions {
  /** Comment line (written after two leading spaces). Blank in the dataset. */
  comment?: string;
  /**
   * Write element symbols (C, H) instead of atomic numbers. Off by default to
   * match the dataset; on for viewers that only accept symbols.
   */
  symbols?: boolean;
}

/** Serialise a molecule to .xyz text, ring carbons first then terminal atoms. */
export function toXyz(molecule: Molecule, options: XyzOptions = {}): string {
  const comment = (options.comment ?? '').replace(/[\r\n]+/g, ' ');
  const lines = [pad(String(molecule.atoms.length), 6), `  ${comment}`];
  for (const atom of molecule.atoms) {
    const label = options.symbols ? atom.element : String(atomicNumber(atom.element));
    lines.push(
      pad(label, 6) +
        pad(formatFixed(atom.x, 6), 22) +
        pad(formatFixed(atom.y, 6), 12) +
        pad(formatFixed(atom.z, 6), 12),
    );
  }
  return lines.join('\n') + '\n';
}

export interface XyzAtomRow {
  Z: number;
  x: number;
  y: number;
  z: number;
}

/** Parse .xyz text (symbols or atomic numbers). Used by tests and by future import. */
export function parseXyz(text: string): { comment: string; atoms: XyzAtomRow[] } {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const n = parseInt(lines[0].trim(), 10);
  if (!Number.isFinite(n)) throw new Error('bad .xyz: first line must be the atom count');
  const symbolToZ: Record<string, number> = { H: 1, B: 5, C: 6, N: 7, O: 8, F: 9, S: 16, Cl: 17 };
  const atoms: XyzAtomRow[] = [];
  for (let i = 2; i < 2 + n; i++) {
    const parts = (lines[i] ?? '').trim().split(/\s+/);
    if (parts.length < 4) throw new Error(`bad .xyz: atom line ${i + 1} is incomplete`);
    const Z = /^\d+$/.test(parts[0]) ? parseInt(parts[0], 10) : symbolToZ[parts[0]];
    if (!Z) throw new Error(`bad .xyz: unknown element '${parts[0]}' on line ${i + 1}`);
    atoms.push({ Z, x: Number(parts[1]), y: Number(parts[2]), z: Number(parts[3]) });
  }
  return { comment: (lines[1] ?? '').trim(), atoms };
}

/** Cells as the JSON body accepted by the current-density molgen API. */
export function cellsToJson(cells: readonly Cell[]): string {
  const sorted = [...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return JSON.stringify({ cells: sorted.map(([q, r]) => [q, r]) });
}

/** Accepts `{"cells": [[q,r],...]}`, a bare `[[q,r],...]`, or "q,r q,r ..." text. */
export function parseCellsJson(text: string): Cell[] {
  const trimmed = text.trim();
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    const pairs = trimmed.split(/[\s;]+/).filter(Boolean);
    raw = pairs.map((p) => p.split(',').map(Number));
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'cells' in raw) {
    raw = (raw as { cells: unknown }).cells;
  }
  if (!Array.isArray(raw)) throw new Error('expected a list of [q, r] pairs');
  return raw.map((entry, i) => {
    if (!Array.isArray(entry) || entry.length !== 2)
      throw new Error(`entry ${i} is not a [q, r] pair`);
    const [q, r] = entry.map(Number);
    if (!Number.isInteger(q) || !Number.isInteger(r))
      throw new Error(`entry ${i} is not an integer pair`);
    return [q, r] as const;
  });
}
