/**
 * Element registry. Only C and H are used by the builder today; the others are
 * pre-registered so that terminal-atom substitutions (see BuildParams.terminal)
 * can be added without touching the writer or the renderer.
 *
 * Colours follow the CPK convention (carbon darkened for visibility on light
 * backgrounds). Bond lengths are typical aromatic C–X single-bond values.
 */
import type { ElementInfo, ElementSymbol } from './types';

export const ELEMENTS: Readonly<Record<ElementSymbol, ElementInfo>> = {
  H: {
    symbol: 'H',
    name: 'Hydrogen',
    Z: 1,
    color: '#e8e8e8',
    covalentRadius: 0.31,
    bondToCarbon: 1.09,
  },
  C: {
    symbol: 'C',
    name: 'Carbon',
    Z: 6,
    color: '#3a3a3a',
    covalentRadius: 0.76,
    bondToCarbon: 1.42,
  },
  N: {
    symbol: 'N',
    name: 'Nitrogen',
    Z: 7,
    color: '#3050f8',
    covalentRadius: 0.71,
    bondToCarbon: 1.4,
  },
  O: {
    symbol: 'O',
    name: 'Oxygen',
    Z: 8,
    color: '#ff0d0d',
    covalentRadius: 0.66,
    bondToCarbon: 1.36,
  },
  F: {
    symbol: 'F',
    name: 'Fluorine',
    Z: 9,
    color: '#90e050',
    covalentRadius: 0.57,
    bondToCarbon: 1.35,
  },
  S: {
    symbol: 'S',
    name: 'Sulfur',
    Z: 16,
    color: '#ffff30',
    covalentRadius: 1.05,
    bondToCarbon: 1.77,
  },
  Cl: {
    symbol: 'Cl',
    name: 'Chlorine',
    Z: 17,
    color: '#1ff01f',
    covalentRadius: 1.02,
    bondToCarbon: 1.74,
  },
  B: {
    symbol: 'B',
    name: 'Boron',
    Z: 5,
    color: '#ffb5b5',
    covalentRadius: 0.84,
    bondToCarbon: 1.56,
  },
};

export function element(symbol: ElementSymbol): ElementInfo {
  const info = ELEMENTS[symbol];
  if (!info) throw new Error(`unknown element ${String(symbol)}`);
  return info;
}

export function atomicNumber(symbol: ElementSymbol): number {
  return element(symbol).Z;
}

/** Hill-system order: C first, H second, then alphabetical. */
export function hillOrder(symbols: ElementSymbol[]): ElementSymbol[] {
  const rest = symbols.filter((s) => s !== 'C' && s !== 'H').sort();
  const out: ElementSymbol[] = [];
  if (symbols.includes('C')) out.push('C');
  if (symbols.includes('H')) out.push('H');
  return [...out, ...rest];
}

export function formatFormula(counts: Partial<Record<ElementSymbol, number>>): string {
  const symbols = Object.keys(counts) as ElementSymbol[];
  return hillOrder(symbols)
    .filter((s) => (counts[s] ?? 0) > 0)
    .map((s) => (counts[s] === 1 ? s : `${s}${counts[s]}`))
    .join('');
}
