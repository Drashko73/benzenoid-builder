/**
 * The molecule exactly as it will be written: centred on its centroid and,
 * with principal orientation, long axis along +x. Axes, a scale bar and the
 * bounding box make the effect of the orientation setting visible.
 */
import { forwardRef } from 'react';
import type { Molecule } from '../../core';
import { MoleculeLayer } from '../canvas/MoleculeLayer';

interface Props {
  molecule: Molecule;
  showHydrogens: boolean;
  showLabels: boolean;
}

export const ExportPreview = forwardRef<SVGSVGElement, Props>(function ExportPreview(
  { molecule, showHydrogens, showLabels },
  ref,
) {
  const { extent } = molecule;
  if (!molecule.atoms.length) {
    return (
      <div className="preview empty" aria-label="Export preview">
        <p>The exported molecule will be shown here.</p>
      </div>
    );
  }

  const pad = 1.6;
  const minX = Math.min(extent.minX, 0) - pad;
  const maxX = Math.max(extent.maxX, 0) + pad;
  const minY = Math.min(extent.minY, 0) - pad;
  const maxY = Math.max(extent.maxY, 0) + pad;
  const w = maxX - minX;
  const h = maxY - minY;
  // Screen y is down: draw everything inside a flipped group.
  const viewBox = `${minX} ${-maxY} ${w} ${h}`;
  const bar = w > 24 ? 5 : w > 12 ? 2 : 1;
  const font = Math.max(0.45, w / 30);

  return (
    <svg
      ref={ref}
      className="preview"
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Export preview of ${molecule.formula}`}
    >
      <rect x={minX} y={-maxY} width={w} height={h} className="preview-bg" />
      <g transform="scale(1 -1)">
        <line x1={minX} y1={0} x2={maxX} y2={0} className="axis" />
        <line x1={0} y1={minY} x2={0} y2={maxY} className="axis" />
        <rect
          x={extent.minX}
          y={extent.minY}
          width={extent.width}
          height={extent.height}
          className="bbox"
        />
        <MoleculeLayer
          molecule={molecule}
          view={{ showHydrogens, showLabels, showRingNumbers: false }}
          scale={showLabels ? 40 : 0}
        />
        {/* scale bar */}
        <line
          x1={maxX - pad - bar}
          y1={minY + pad * 0.5}
          x2={maxX - pad}
          y2={minY + pad * 0.5}
          className="scale-bar"
        />
        <text
          transform={`translate(${maxX - pad - bar / 2} ${minY + pad * 0.5 + font * 0.9}) scale(1 -1)`}
          textAnchor="middle"
          className="preview-text"
          style={{ fontSize: font }}
        >
          {bar} Å
        </text>
        <text
          transform={`translate(${maxX - 0.15} ${font * 0.4}) scale(1 -1)`}
          textAnchor="end"
          className="preview-text axis-label"
          style={{ fontSize: font }}
        >
          x
        </text>
        <text
          transform={`translate(${font * 0.5} ${maxY - font}) scale(1 -1)`}
          textAnchor="start"
          className="preview-text axis-label"
          style={{ fontSize: font }}
        >
          y
        </text>
        <text
          transform={`translate(${minX + 0.2} ${maxY - font}) scale(1 -1)`}
          textAnchor="start"
          className="preview-text"
          style={{ fontSize: font }}
        >
          {extent.width.toFixed(2)} × {extent.height.toFixed(2)} Å
        </text>
      </g>
    </svg>
  );
});
