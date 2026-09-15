/**
 * Shareable-link codec: the selection and the non-default parameters go into
 * the URL hash, e.g.
 *
 *     #c=0:0..2;1:-1..1&cc=1.40&o=none&n=phenanthrene
 *
 * Cells are grouped by row `r`, each row listing its `q` values as ranges
 * (`r:q1..q2,q3`), so a dense flake costs one short entry per row instead of
 * one per ring. The older per-cell form (`0,0;1,0;…`) is still decoded.
 *
 * The fragment is never sent to a server, so the only limits are the browser's
 * and whatever the link is pasted into (email clients truncate at a few
 * thousand characters). MAX_SHARE_HASH_LENGTH is the point past which the app
 * stops writing the state into the URL; the cells JSON export is the sharing
 * route for anything bigger.
 */
import { CC_BOND, CH_BOND } from './lattice';
import type { Cell, Orientation } from './types';

/** Longest hash the app will put into the address bar / a share link. */
export const MAX_SHARE_HASH_LENGTH = 8000;

export interface SharedState {
  cells: Cell[];
  ccBond?: number;
  chBond?: number;
  orient?: Orientation;
  name?: string;
}

/** Row-range encoding of a cell set. */
export function encodeCells(cells: readonly Cell[]): string {
  const rows = new Map<number, number[]>();
  for (const [q, r] of cells) {
    const row = rows.get(r);
    if (row) row.push(q);
    else rows.set(r, [q]);
  }
  const parts: string[] = [];
  for (const r of [...rows.keys()].sort((a, b) => a - b)) {
    const qs = [...new Set(rows.get(r)!)].sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = qs[0];
    let prev = qs[0];
    for (let i = 1; i <= qs.length; i++) {
      const q = qs[i];
      if (q === prev + 1) {
        prev = q;
        continue;
      }
      ranges.push(start === prev ? `${start}` : `${start}..${prev}`);
      start = q;
      prev = q;
    }
    parts.push(`${r}:${ranges.join(',')}`);
  }
  return parts.join(';');
}

/** Decode either the row-range form or the legacy `q,r;q,r` form. Returns null if malformed. */
export function decodeCells(text: string): Cell[] | null {
  const cells: Cell[] = [];
  if (!text) return cells;
  const int = /^-?\d+$/;
  if (!text.includes(':')) {
    for (const pair of text.split(';').filter(Boolean)) {
      const [q, r] = pair.split(',');
      if (!int.test(q ?? '') || !int.test(r ?? '')) return null;
      cells.push([Number(q), Number(r)]);
    }
    return cells;
  }
  for (const rowText of text.split(';').filter(Boolean)) {
    const colon = rowText.indexOf(':');
    if (colon < 0) return null;
    const rText = rowText.slice(0, colon);
    if (!int.test(rText)) return null;
    const r = Number(rText);
    for (const range of rowText.slice(colon + 1).split(',')) {
      const [a, b] = range.split('..');
      if (!int.test(a ?? '') || (b !== undefined && !int.test(b))) return null;
      const from = Number(a);
      const to = b === undefined ? from : Number(b);
      if (to < from || to - from > 100000) return null;
      for (let q = from; q <= to; q++) cells.push([q, r]);
    }
  }
  return cells;
}

export function encodeState(state: SharedState): string {
  const params = new URLSearchParams();
  params.set('c', encodeCells(state.cells));
  if (state.ccBond !== undefined && state.ccBond !== CC_BOND)
    params.set('cc', String(state.ccBond));
  if (state.chBond !== undefined && state.chBond !== CH_BOND)
    params.set('ch', String(state.chBond));
  if (state.orient && state.orient !== 'principal') params.set('o', state.orient);
  if (state.name) params.set('n', state.name);
  // URLSearchParams escapes ",", ";" and ":" — undo that for readability; all are safe in a fragment.
  return params.toString().replace(/%2C/gi, ',').replace(/%3B/gi, ';').replace(/%3A/gi, ':');
}

export function decodeState(hash: string): SharedState | null {
  const text = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!text) return null;
  const params = new URLSearchParams(text);
  const c = params.get('c');
  if (c === null) return null;
  const cells = decodeCells(c);
  if (!cells) return null;
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
