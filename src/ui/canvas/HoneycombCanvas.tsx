/**
 * The honeycomb editor: an SVG in Angstrom units, y pointing up (so the screen
 * matches the exported x/y frame), with only the cells inside the viewport
 * rendered. Pointer events are handled on the SVG itself and mapped back to a
 * cell with cartesianToCell, so the cells themselves are inert `<use>` elements.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  cartesianToCell,
  cellCenter,
  cellKey,
  cellPolygon,
  type Cell,
  type Molecule,
} from '../../core';
import type { Builder, PaintMode } from '../state/useBuilder';
import { MoleculeLayer } from './MoleculeLayer';

export interface Camera {
  /** Chemistry-space point shown at the centre of the viewport, in Angstroms. */
  cx: number;
  cy: number;
  /** Pixels per Angstrom. */
  scale: number;
}

export interface CanvasHandle {
  fitToMolecule: () => void;
  zoomBy: (factor: number) => void;
  resetView: () => void;
  /** The SVG element, for image export. */
  svg: () => SVGSVGElement | null;
}

export type CellHighlight = 'error' | 'warning';

interface Props {
  builder: Builder;
  highlightCells: ReadonlyMap<string, CellHighlight>;
  highlightAtoms: ReadonlySet<number>;
  onHoverCell?: (cell: Cell | null) => void;
}

const MIN_SCALE = 6;
const MAX_SCALE = 160;
const DEFAULT_SCALE = 42;

const SQRT3 = Math.sqrt(3);

function fitCamera(molecule: Molecule, width: number, height: number, cc: number): Camera | null {
  if (!molecule.atoms.length || !width || !height) return null;
  const { minX, maxX, minY, maxY } = molecule.extent;
  const pad = 2 * cc;
  const w = maxX - minX + 2 * pad;
  const h = maxY - minY + 2 * pad;
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(width / w, height / h)));
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, scale };
}

export const HoneycombCanvas = forwardRef<CanvasHandle, Props>(function HoneycombCanvas(
  { builder, highlightCells, highlightAtoms, onHoverCell },
  ref,
) {
  const { state, dispatch, latticeMolecule } = builder;
  const cc = state.ccBond;
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [camera, setCamera] = useState<Camera>({ cx: 0, cy: 0, scale: DEFAULT_SCALE });
  const [hover, setHover] = useState<Cell | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);

  // Interaction state lives in refs: it changes on every pointer move.
  const gesture = useRef<
    | { kind: 'paint'; mode: PaintMode; last: string }
    | { kind: 'pan'; startX: number; startY: number; cam: Camera }
    | { kind: 'pinch'; dist: number; cam: Camera; mid: { x: number; y: number } }
    | null
  >(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const fittedOnce = useRef(false);

  // Track the viewport size.
  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit once when a shared link opens with a molecule already selected.
  useEffect(() => {
    if (fittedOnce.current || !size.width) return;
    fittedOnce.current = true;
    const cam = fitCamera(latticeMolecule, size.width, size.height, cc);
    if (cam) setCamera(cam);
  }, [size, latticeMolecule, cc]);

  // Space bar switches the left button to panning.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTypingTarget(e.target)) {
        setSpaceHeld(true);
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const toChem = useCallback(
    (clientX: number, clientY: number, cam = camera) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      return {
        x: cam.cx + (px - size.width / 2) / cam.scale,
        y: cam.cy - (py - size.height / 2) / cam.scale,
      };
    },
    [camera, size],
  );

  const zoomAt = useCallback(
    (factor: number, clientX?: number, clientY?: number) => {
      setCamera((cam) => {
        const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, cam.scale * factor));
        if (scale === cam.scale) return cam;
        const rect = svgRef.current?.getBoundingClientRect();
        const px = clientX !== undefined && rect ? clientX - rect.left : size.width / 2;
        const py = clientY !== undefined && rect ? clientY - rect.top : size.height / 2;
        // Keep the chemistry point under the cursor fixed.
        const x = cam.cx + (px - size.width / 2) / cam.scale;
        const y = cam.cy - (py - size.height / 2) / cam.scale;
        return {
          cx: x - (px - size.width / 2) / scale,
          cy: y + (py - size.height / 2) / scale,
          scale,
        };
      });
    },
    [size],
  );

  // Wheel zoom needs a non-passive listener to prevent page scrolling.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
      zoomAt(factor, e.clientX, e.clientY);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  useImperativeHandle(
    ref,
    () => ({
      fitToMolecule: () => {
        const cam = fitCamera(latticeMolecule, size.width, size.height, cc);
        if (cam) setCamera(cam);
      },
      zoomBy: (factor) => zoomAt(factor),
      resetView: () => setCamera({ cx: 0, cy: 0, scale: DEFAULT_SCALE }),
      svg: () => svgRef.current,
    }),
    [latticeMolecule, size, cc, zoomAt],
  );

  const cellAt = useCallback(
    (clientX: number, clientY: number) => {
      const { x, y } = toChem(clientX, clientY);
      return cartesianToCell(x, y, cc);
    },
    [toChem, cc],
  );

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    svgRef.current?.setPointerCapture(e.pointerId);

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        kind: 'pinch',
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        cam: camera,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
      return;
    }

    const wantsPan = e.button === 1 || e.button === 2 || spaceHeld;
    if (wantsPan) {
      gesture.current = { kind: 'pan', startX: e.clientX, startY: e.clientY, cam: camera };
      return;
    }
    if (e.button !== 0) return;
    const cell = cellAt(e.clientX, e.clientY);
    const key = cellKey(cell);
    const mode: PaintMode = e.shiftKey || state.cells.has(key) ? 'remove' : 'add';
    gesture.current = { kind: 'paint', mode, last: key };
    dispatch({ type: 'paint', cells: [cell], mode, newStroke: true });
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    const g = gesture.current;
    if (g?.kind === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, (g.cam.scale * dist) / g.dist));
      setCamera({
        cx: g.cam.cx - (mid.x - g.mid.x) / scale,
        cy: g.cam.cy + (mid.y - g.mid.y) / scale,
        scale,
      });
      return;
    }
    if (g?.kind === 'pan') {
      setCamera({
        cx: g.cam.cx - (e.clientX - g.startX) / g.cam.scale,
        cy: g.cam.cy + (e.clientY - g.startY) / g.cam.scale,
        scale: g.cam.scale,
      });
      return;
    }
    const cell = cellAt(e.clientX, e.clientY);
    const key = cellKey(cell);
    if (!hover || cellKey(hover) !== key) {
      setHover(cell);
      onHoverCell?.(cell);
    }
    if (g?.kind === 'paint' && g.last !== key) {
      g.last = key;
      dispatch({ type: 'paint', cells: [cell], mode: g.mode, newStroke: false });
    }
  };

  const endPointer = (e: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (svgRef.current?.hasPointerCapture(e.pointerId)) {
      svgRef.current.releasePointerCapture(e.pointerId);
    }
    if (pointers.current.size === 0) gesture.current = null;
  };

  const onPointerLeave = () => {
    setHover(null);
    onHoverCell?.(null);
  };

  // --- geometry of the visible grid
  const hexPoints = useMemo(
    () =>
      cellPolygon([0, 0], cc)
        .map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`)
        .join(' '),
    [cc],
  );

  const visibleCells = useMemo(() => {
    if (!size.width) return [] as Cell[];
    if (!state.view.showGrid) {
      // Grid hidden: draw only the selection and anything validation wants to point at.
      const keys = new Set([...state.cells, ...highlightCells.keys()]);
      return [...keys].map((k) => k.split(',').map(Number) as unknown as Cell);
    }
    const halfW = size.width / 2 / camera.scale;
    const halfH = size.height / 2 / camera.scale;
    const rMin = Math.floor((camera.cy - halfH) / (1.5 * cc)) - 1;
    const rMax = Math.ceil((camera.cy + halfH) / (1.5 * cc)) + 1;
    const out: Cell[] = [];
    for (let r = rMin; r <= rMax; r++) {
      const qMin = Math.floor((camera.cx - halfW) / (SQRT3 * cc) - r / 2) - 1;
      const qMax = Math.ceil((camera.cx + halfW) / (SQRT3 * cc) - r / 2) + 1;
      for (let q = qMin; q <= qMax; q++) out.push([q, r]);
    }
    return out;
  }, [size, camera, cc, state.view.showGrid, state.cells, highlightCells]);

  const transform = `translate(${size.width / 2} ${size.height / 2}) scale(${camera.scale} ${-camera.scale}) translate(${-camera.cx} ${-camera.cy})`;
  const cursor = spaceHeld || gesture.current?.kind === 'pan' ? 'grabbing' : 'crosshair';

  return (
    <svg
      ref={svgRef}
      className="honeycomb"
      width={size.width}
      height={size.height}
      viewBox={`0 0 ${size.width} ${size.height}`}
      role="img"
      aria-label="Honeycomb grid. Click a hexagon to add or remove a ring."
      style={{ cursor, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onPointerLeave={onPointerLeave}
      onContextMenu={(e) => e.preventDefault()}
    >
      <defs>
        <polygon id="hex" points={hexPoints} />
        <pattern
          id="hatch"
          patternUnits="userSpaceOnUse"
          width={0.5}
          height={0.5}
          patternTransform="rotate(45)"
        >
          <rect width={0.5} height={0.25} className="hatch-stripe" />
        </pattern>
      </defs>
      <g transform={transform}>
        <g className="grid">
          {visibleCells.map((cell) => {
            const [x, y] = cellCenter(cell, cc);
            const key = cellKey(cell);
            const selected = state.cells.has(key);
            const mark = highlightCells.get(key);
            const cls = ['cell', selected && 'selected', mark && `mark-${mark}`]
              .filter(Boolean)
              .join(' ');
            return <use key={key} href="#hex" x={x} y={y} className={cls} />;
          })}
        </g>
        {hover && !gesture.current && (
          <use
            href="#hex"
            x={cellCenter(hover, cc)[0]}
            y={cellCenter(hover, cc)[1]}
            className="cell hover"
          />
        )}
        <MoleculeLayer
          molecule={latticeMolecule}
          view={state.view}
          highlightAtoms={highlightAtoms}
          scale={camera.scale}
        />
      </g>
    </svg>
  );
});

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}
