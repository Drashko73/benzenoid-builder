/**
 * Builder state: the selected cells, build parameters, view options and an
 * undo/redo history of the selection. The selection is also mirrored into the
 * URL hash so any state can be shared as a link.
 */
import { useCallback, useEffect, useMemo, useReducer } from 'react';
import {
  CC_BOND,
  CH_BOND,
  DEFAULT_MODEL_LIMITS,
  buildMolecule,
  cellKey,
  decodeState,
  encodeState,
  parseCellKey,
  validateCells,
  type Cell,
  type FixAction,
  type ModelLimits,
  type Orientation,
} from '../../core';

export interface ViewOptions {
  showGrid: boolean;
  showLabels: boolean;
  showHydrogens: boolean;
  showRingNumbers: boolean;
}

export interface BuilderState {
  cells: ReadonlySet<string>;
  ccBond: number;
  chBond: number;
  orient: Orientation;
  name: string;
  comment: string;
  limits: ModelLimits;
  allowOversize: boolean;
  view: ViewOptions;
  past: ReadonlySet<string>[];
  future: ReadonlySet<string>[];
}

export type PaintMode = 'add' | 'remove';

export type BuilderAction =
  | { type: 'toggle'; cell: Cell }
  | { type: 'paint'; cells: Cell[]; mode: PaintMode; newStroke: boolean }
  | { type: 'add'; cells: Cell[] }
  | { type: 'remove'; cells: Cell[] }
  | { type: 'set'; cells: Cell[]; name?: string }
  | { type: 'clear' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'applyFix'; fix: FixAction }
  | { type: 'setParams'; ccBond?: number; chBond?: number; orient?: Orientation }
  | { type: 'setName'; name: string }
  | { type: 'setComment'; comment: string }
  | { type: 'setLimits'; limits: ModelLimits }
  | { type: 'setAllowOversize'; value: boolean }
  | { type: 'setView'; view: Partial<ViewOptions> };

const HISTORY_LIMIT = 200;

export const initialState: BuilderState = {
  cells: new Set(),
  ccBond: CC_BOND,
  chBond: CH_BOND,
  orient: 'principal',
  name: '',
  comment: '',
  limits: DEFAULT_MODEL_LIMITS,
  allowOversize: false,
  view: { showGrid: true, showLabels: false, showHydrogens: true, showRingNumbers: false },
  past: [],
  future: [],
};

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const k of a) if (!b.has(k)) return false;
  return true;
}

/** Replace the selection, recording the previous one for undo (unless `record` is false). */
function withCells(state: BuilderState, cells: ReadonlySet<string>, record = true): BuilderState {
  if (sameSet(state.cells, cells)) return state;
  if (!record) return { ...state, cells };
  return {
    ...state,
    cells,
    past: [...state.past.slice(-HISTORY_LIMIT + 1), state.cells],
    future: [],
  };
}

export function reducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case 'toggle': {
      const next = new Set(state.cells);
      const key = cellKey(action.cell);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return withCells(state, next);
    }
    case 'paint': {
      const next = new Set(state.cells);
      for (const cell of action.cells) {
        const key = cellKey(cell);
        if (action.mode === 'add') next.add(key);
        else next.delete(key);
      }
      // A drag stroke is one undo step: only its first paint records history.
      return withCells(state, next, action.newStroke);
    }
    case 'add': {
      const next = new Set(state.cells);
      for (const cell of action.cells) next.add(cellKey(cell));
      return withCells(state, next);
    }
    case 'remove': {
      const next = new Set(state.cells);
      for (const cell of action.cells) next.delete(cellKey(cell));
      return withCells(state, next);
    }
    case 'set': {
      const next = withCells(state, new Set(action.cells.map((c) => cellKey(c))));
      return action.name !== undefined ? { ...next, name: action.name } : next;
    }
    case 'clear':
      return withCells(state, new Set());
    case 'undo': {
      if (!state.past.length) return state;
      const previous = state.past[state.past.length - 1];
      return {
        ...state,
        cells: previous,
        past: state.past.slice(0, -1),
        future: [state.cells, ...state.future],
      };
    }
    case 'redo': {
      if (!state.future.length) return state;
      const [next, ...rest] = state.future;
      return { ...state, cells: next, past: [...state.past, state.cells], future: rest };
    }
    case 'applyFix': {
      const fix = action.fix;
      if (fix.kind === 'add-cells') return reducer(state, { type: 'add', cells: fix.cells });
      if (fix.kind === 'remove-cells') return reducer(state, { type: 'remove', cells: fix.cells });
      return reducer(state, { type: 'set', cells: fix.cells });
    }
    case 'setParams':
      return {
        ...state,
        ccBond: action.ccBond ?? state.ccBond,
        chBond: action.chBond ?? state.chBond,
        orient: action.orient ?? state.orient,
      };
    case 'setName':
      return { ...state, name: action.name };
    case 'setComment':
      return { ...state, comment: action.comment };
    case 'setLimits':
      return { ...state, limits: action.limits };
    case 'setAllowOversize':
      return { ...state, allowOversize: action.value };
    case 'setView':
      return { ...state, view: { ...state.view, ...action.view } };
    default:
      return state;
  }
}

/** Initial state from the URL hash, falling back to an empty grid. */
export function stateFromLocation(hash: string): BuilderState {
  const shared = decodeState(hash);
  if (!shared) return initialState;
  return {
    ...initialState,
    cells: new Set(shared.cells.map((c) => cellKey(c))),
    ccBond: shared.ccBond ?? initialState.ccBond,
    chBond: shared.chBond ?? initialState.chBond,
    orient: shared.orient ?? initialState.orient,
    name: shared.name ?? '',
  };
}

export function cellsOf(state: Pick<BuilderState, 'cells'>): Cell[] {
  return [...state.cells].map(parseCellKey);
}

/** A safe default file name: the user's name, else the formula. */
export function fileStem(name: string, formula: string): string {
  const stem = (name.trim() || formula || 'molecule').replace(/[^A-Za-z0-9_.-]+/g, '_');
  return stem.replace(/^_+|_+$/g, '') || 'molecule';
}

export function useBuilder() {
  const [state, dispatch] = useReducer(
    reducer,
    typeof window === 'undefined' ? '' : window.location.hash,
    stateFromLocation,
  );

  const cells = useMemo(() => [...state.cells].map(parseCellKey), [state.cells]);
  const params = useMemo(
    () => ({ ccBond: state.ccBond, chBond: state.chBond, orient: state.orient }),
    [state.ccBond, state.chBond, state.orient],
  );

  /** Molecule in the export frame (centred, oriented as requested). */
  const molecule = useMemo(() => buildMolecule(cells, params), [cells, params]);
  /** The same molecule in raw lattice coordinates, for drawing on the grid. */
  const latticeMolecule = useMemo(
    () => buildMolecule(cells, { ...params, orient: 'none', centre: false }),
    [cells, params],
  );
  const validation = useMemo(
    () => validateCells(cells, { params, limits: state.limits }),
    [cells, params, state.limits],
  );

  const shareHash = useMemo(
    () =>
      encodeState({
        cells,
        ccBond: state.ccBond,
        chBond: state.chBond,
        orient: state.orient,
        name: state.name || undefined,
      }),
    [cells, state.ccBond, state.chBond, state.orient, state.name],
  );

  // Mirror the state into the URL (replaceState keeps the back button usable).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.pathname}${window.location.search}#${shareHash}`;
    if (window.location.hash !== `#${shareHash}`) window.history.replaceState(null, '', url);
  }, [shareHash]);

  // A link pasted into the same tab (hash change from outside) loads that molecule.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHashChange = () => {
      if (window.location.hash === `#${shareHash}`) return;
      const shared = decodeState(window.location.hash);
      if (!shared) return;
      dispatch({ type: 'set', cells: shared.cells, name: shared.name ?? '' });
      dispatch({
        type: 'setParams',
        ccBond: shared.ccBond ?? CC_BOND,
        chBond: shared.chBond ?? CH_BOND,
        orient: shared.orient ?? 'principal',
      });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [shareHash]);

  const canExport =
    validation.ok ||
    (state.allowOversize && validation.errors.every((issue) => issue.id === 'too-large'));

  const shareUrl = useCallback(() => {
    const { origin, pathname, search } = window.location;
    return `${origin}${pathname}${search}#${shareHash}`;
  }, [shareHash]);

  return {
    state,
    dispatch,
    cells,
    params,
    molecule,
    latticeMolecule,
    validation,
    canExport,
    shareUrl,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}

export type Builder = ReturnType<typeof useBuilder>;
