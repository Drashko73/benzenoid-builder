import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toXyz, type Cell } from '../core';
import { HoneycombCanvas, type CanvasHandle, type CellHighlight } from './canvas/HoneycombCanvas';
import { cellKey } from '../core';
import { downloadText } from './download';
import { HelpDialog } from './HelpDialog';
import { ExportPreview } from './preview/ExportPreview';
import { Export } from './sidebar/Export';
import { Parameters } from './sidebar/Parameters';
import { Presets } from './sidebar/Presets';
import { Summary } from './sidebar/Summary';
import { Validation } from './sidebar/Validation';
import { fileStem, useBuilder } from './state/useBuilder';
import { useTheme } from './theme';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
}

export function App() {
  const builder = useBuilder();
  const { state, dispatch, molecule, validation, cells } = builder;
  const canvasRef = useRef<CanvasHandle>(null);
  const previewRef = useRef<SVGSVGElement>(null);
  const [hoverCell, setHoverCell] = useState<Cell | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const { theme, toggleTheme } = useTheme();

  const notify = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2500);
  }, []);

  // Cells and atoms that validation wants highlighted on the canvas.
  const highlightCells = useMemo(() => {
    const map = new Map<string, CellHighlight>();
    for (const issue of validation.issues) {
      for (const cell of issue.cells ?? []) {
        map.set(cellKey(cell), issue.severity === 'error' ? 'error' : 'warning');
      }
    }
    return map;
  }, [validation]);
  const highlightAtoms = useMemo(
    () => new Set(validation.issues.flatMap((issue) => issue.atoms ?? [])),
    [validation],
  );

  const downloadXyz = useCallback(() => {
    if (!builder.canExport) {
      notify(`Export blocked: ${validation.errors[0]?.title ?? 'invalid selection'}`);
      return;
    }
    const stem = fileStem(state.name, molecule.formula);
    downloadText(
      toXyz(molecule, { comment: state.comment, symbols: state.symbols }),
      `${stem}.xyz`,
      'chemical/x-xyz',
    );
    notify(`Downloaded ${stem}.xyz`);
  }, [
    builder.canExport,
    molecule,
    state.comment,
    state.symbols,
    state.name,
    validation.errors,
    notify,
  ]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        dispatch({ type: 'redo' });
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        downloadXyz();
      } else if (!mod && !e.altKey) {
        switch (e.key) {
          case 'f':
          case 'F':
            canvasRef.current?.fitToMolecule();
            break;
          case '0':
            canvasRef.current?.resetView();
            break;
          case 'g':
          case 'G':
            dispatch({ type: 'setView', view: { showGrid: !state.view.showGrid } });
            break;
          case 'h':
          case 'H':
            dispatch({ type: 'setView', view: { showHydrogens: !state.view.showHydrogens } });
            break;
          case 'l':
          case 'L':
            dispatch({ type: 'setView', view: { showLabels: !state.view.showLabels } });
            break;
          case 'r':
          case 'R':
            dispatch({ type: 'setView', view: { showRingNumbers: !state.view.showRingNumbers } });
            break;
          case '?':
            setHelpOpen(true);
            break;
          default:
            return;
        }
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch, downloadXyz, state.view]);

  const loadPreset = (presetCells: Cell[], name: string) => {
    dispatch({ type: 'set', cells: presetCells, name });
    // Let the new molecule render, then frame it.
    window.requestAnimationFrame(() => canvasRef.current?.fitToMolecule());
  };

  const clear = () => {
    if (!cells.length) return;
    dispatch({ type: 'clear' });
    notify(`Removed ${cells.length} ring${cells.length === 1 ? '' : 's'} — Ctrl+Z to undo`);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img
            src={`${import.meta.env.BASE_URL}favicon.svg`}
            width={28}
            height={28}
            alt=""
            className="logo"
          />
          <h1>Benzenoid Builder</h1>
          <span className="tagline">design fused-ring C/H molecules, export .xyz</span>
        </div>
        <div className="toolbar" role="toolbar" aria-label="Editing">
          <button
            type="button"
            className="btn icon"
            onClick={() => dispatch({ type: 'undo' })}
            disabled={!builder.canUndo}
            title="Undo (Ctrl+Z)"
          >
            ↶
          </button>
          <button
            type="button"
            className="btn icon"
            onClick={() => dispatch({ type: 'redo' })}
            disabled={!builder.canRedo}
            title="Redo (Ctrl+Shift+Z)"
          >
            ↷
          </button>
          <button
            type="button"
            className="btn"
            onClick={clear}
            disabled={!cells.length}
            title="Remove all rings"
          >
            Clear
          </button>
          <span className="sep" />
          <button
            type="button"
            className="btn"
            onClick={() => canvasRef.current?.fitToMolecule()}
            disabled={!cells.length}
            title="Fit view to molecule (F)"
          >
            Fit
          </button>
          <button
            type="button"
            className="btn icon"
            onClick={() => canvasRef.current?.zoomBy(1.25)}
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className="btn icon"
            onClick={() => canvasRef.current?.zoomBy(0.8)}
            title="Zoom out"
          >
            −
          </button>
          <span className="sep" />
          <label className="toggle" title="Show the empty grid (G)">
            <input
              type="checkbox"
              checked={state.view.showGrid}
              onChange={(e) => dispatch({ type: 'setView', view: { showGrid: e.target.checked } })}
            />
            Grid
          </label>
          <label className="toggle" title="Show hydrogens (H)">
            <input
              type="checkbox"
              checked={state.view.showHydrogens}
              onChange={(e) =>
                dispatch({ type: 'setView', view: { showHydrogens: e.target.checked } })
              }
            />
            H atoms
          </label>
          <label className="toggle" title="Number atoms as in the .xyz file (L)">
            <input
              type="checkbox"
              checked={state.view.showLabels}
              onChange={(e) =>
                dispatch({ type: 'setView', view: { showLabels: e.target.checked } })
              }
            />
            Atom №
          </label>
          <label className="toggle" title="Number rings (R)">
            <input
              type="checkbox"
              checked={state.view.showRingNumbers}
              onChange={(e) =>
                dispatch({ type: 'setView', view: { showRingNumbers: e.target.checked } })
              }
            />
            Ring №
          </label>
          <span className="sep" />
          <button
            type="button"
            className="btn icon"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <button
            type="button"
            className="btn icon"
            onClick={() => setHelpOpen(true)}
            title="Help (?)"
          >
            ?
          </button>
        </div>
      </header>

      <main className="workspace">
        <div className="canvas-wrap">
          <HoneycombCanvas
            ref={canvasRef}
            builder={builder}
            highlightCells={highlightCells}
            highlightAtoms={highlightAtoms}
            onHoverCell={setHoverCell}
          />
          <div className="canvas-status" aria-live="polite">
            {hoverCell ? (
              <span>
                ring ({hoverCell[0]}, {hoverCell[1]})
                {state.cells.has(cellKey(hoverCell)) ? ' · selected' : ''}
              </span>
            ) : (
              <span>click to add a ring · drag to paint · scroll to zoom · right-drag to pan</span>
            )}
          </div>
          {!cells.length && (
            <div className="canvas-empty">
              <p>Click any hexagon to start a molecule, or load a preset on the right.</p>
            </div>
          )}
        </div>

        <aside className="sidebar">
          <Summary molecule={molecule} validation={validation} ringCount={cells.length} />
          <Validation
            validation={validation}
            onFix={(fix) => dispatch({ type: 'applyFix', fix })}
          />
          <h2 className="panel-title">Export preview</h2>
          <ExportPreview
            ref={previewRef}
            molecule={molecule}
            showHydrogens={state.view.showHydrogens}
            showLabels={state.view.showLabels}
          />
          <h2 className="panel-title">Export</h2>
          <Export builder={builder} previewRef={previewRef} notify={notify} />
          <h2 className="panel-title">Presets</h2>
          <Presets onLoad={loadPreset} />
          <h2 className="panel-title">Parameters</h2>
          <Parameters builder={builder} />
          <footer className="sidebar-footer">
            <a
              href="https://github.com/Drashko73/benzenoid-builder"
              target="_blank"
              rel="noreferrer"
            >
              Source on GitHub
            </a>
            {' · '}
            <button type="button" className="link" onClick={() => setHelpOpen(true)}>
              Help
            </button>
          </footer>
        </aside>
      </main>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
