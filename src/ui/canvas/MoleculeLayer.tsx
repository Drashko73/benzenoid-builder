/**
 * Ball-and-stick rendering of a molecule in Angstrom units, y up. Used both on
 * the editor canvas (lattice frame) and in the export preview (export frame).
 */
import { ELEMENTS, cellCenter, type Molecule } from '../../core';
import type { ViewOptions } from '../state/useBuilder';

interface Props {
  molecule: Molecule;
  view: Pick<ViewOptions, 'showLabels' | 'showHydrogens' | 'showRingNumbers'>;
  highlightAtoms?: ReadonlySet<number>;
  /** Pixels per Angstrom; used to keep labels legible when zoomed out. */
  scale: number;
}

const RING_RADIUS = 0.2;
const TERMINAL_RADIUS = 0.13;

export function MoleculeLayer({ molecule, view, highlightAtoms, scale }: Props) {
  const { atoms, bonds } = molecule;
  if (!atoms.length) return null;
  const labelsVisible = view.showLabels && scale >= 18;
  const ringsVisible = view.showRingNumbers && scale >= 14;

  return (
    <g className="molecule">
      <g className="bonds">
        {bonds.map(({ a, b }) => {
          const A = atoms[a];
          const B = atoms[b];
          const terminal = A.kind === 'terminal' || B.kind === 'terminal';
          if (terminal && !view.showHydrogens) return null;
          return (
            <line
              key={`${a}-${b}`}
              x1={A.x}
              y1={A.y}
              x2={B.x}
              y2={B.y}
              className={terminal ? 'bond terminal' : 'bond ring'}
            />
          );
        })}
      </g>
      <g className="atoms">
        {atoms.map((atom) => {
          if (atom.kind === 'terminal' && !view.showHydrogens) return null;
          const r = atom.kind === 'ring' ? RING_RADIUS : TERMINAL_RADIUS;
          const hot = highlightAtoms?.has(atom.index);
          return (
            <circle
              key={atom.index}
              cx={atom.x}
              cy={atom.y}
              r={hot ? r * 1.6 : r}
              className={`atom ${atom.kind} el-${atom.element}${hot ? ' clash' : ''}`}
              style={{ fill: ELEMENTS[atom.element].color }}
            >
              <title>
                {atom.element}
                {atom.index + 1} ({atom.x.toFixed(3)}, {atom.y.toFixed(3)})
              </title>
            </circle>
          );
        })}
      </g>
      {labelsVisible && (
        <g className="labels">
          {atoms.map((atom) => {
            if (atom.kind === 'terminal' && !view.showHydrogens) return null;
            return (
              <text
                key={atom.index}
                transform={`translate(${atom.x} ${atom.y}) scale(1 -1)`}
                className={`label ${atom.kind}`}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {atom.index + 1}
              </text>
            );
          })}
        </g>
      )}
      {ringsVisible && (
        <g className="ring-numbers">
          {molecule.cells.map((cell, i) => {
            const [x, y] = cellCenter(cell, molecule.params.ccBond);
            return (
              <text
                key={`${cell[0]},${cell[1]}`}
                transform={`translate(${x} ${y}) scale(1 -1)`}
                className="ring-number"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {i + 1}
              </text>
            );
          })}
        </g>
      )}
    </g>
  );
}
