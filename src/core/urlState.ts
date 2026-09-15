/**
 * Shareable-link codec: the selection and the non-default parameters go into
 * the URL hash, e.g.
 *
 *     #c=0,0;1,0;1,1&cc=1.40&o=none&n=phenanthrene
 *
 * Human-readable on purpose, so a link in an email or a lab notebook still
 * says what it contains.
 */
import { CC_BOND, CH_BOND } from './lattice';
import type { Cell, Orientation } from './types';

export interface SharedState {
  cells: Cell[];
  ccBond?: number;
  chBond?: number;
  orient?: Orientation;
  name?: string;
}

export function encodeState(state: SharedState): string {
  const params = new URLSearchParams();
  const sorted = [...state.cells].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  params.set('c', sorted.map(([q, r]) => `${q},${r}`).join(';'));
  if (state.ccBond !== undefined && state.ccBond !== CC_BOND)
    params.set('cc', String(state.ccBond));
  if (state.chBond !== undefined && state.chBond !== CH_BOND)
    params.set('ch', String(state.chBond));
  if (state.orient && state.orient !== 'principal') params.set('o', state.orient);
  if (state.name) params.set('n', state.name);
  // URLSearchParams escapes "," and ";" — undo that for readability; both are safe in a fragment.
  return params.toString().replace(/%2C/gi, ',').replace(/%3B/gi, ';');
}

export function decodeState(hash: string): SharedState | null {
  const text = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!text) return null;
  const params = new URLSearchParams(text);
  const c = params.get('c');
  if (c === null) return null;
  const cells: Cell[] = [];
  for (const pair of c.split(';').filter(Boolean)) {
    const [q, r] = pair.split(',').map(Number);
    if (!Number.isInteger(q) || !Number.isInteger(r)) return null;
    cells.push([q, r]);
  }
  const state: SharedState = { cells };
  const cc = params.get('cc');
  const ch = params.get('ch');
  const o = params.get('o');
  const n = params.get('n');
  if (cc !== null && Number.isFinite(Number(cc)) && Number(cc) > 0) state.ccBond = Number(cc);
  if (ch !== null && Number.isFinite(Number(ch)) && Number(ch) > 0) state.chBond = Number(ch);
  if (o === 'principal' || o === 'none') state.orient = o;
  if (n) state.name = n.slice(0, 80);
  return state;
}
