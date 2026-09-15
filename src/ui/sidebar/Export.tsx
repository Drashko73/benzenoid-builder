import { useMemo, useState, type RefObject } from 'react';
import { cellsToJson, parseCellsJson, toXyz, validateCells } from '../../core';
import { copyText, downloadText, svgToPngBlob, svgToStandalone, downloadBlob } from '../download';
import { fileStem, type Builder } from '../state/useBuilder';

interface Props {
  builder: Builder;
  previewRef: RefObject<SVGSVGElement | null>;
  notify: (message: string) => void;
}

export function Export({ builder, previewRef, notify }: Props) {
  const { state, molecule, validation, canExport, cells, dispatch, shareUrl, shareable } = builder;
  const xyz = useMemo(
    () => toXyz(molecule, { comment: state.comment, symbols: state.symbols }),
    [molecule, state.comment, state.symbols],
  );
  const stem = fileStem(state.name, molecule.formula);
  const [importText, setImportText] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const blockedReason = canExport
    ? null
    : (validation.errors[0]?.title ?? 'The selection is not a valid molecule.');

  const downloadXyz = () => {
    downloadText(xyz, `${stem}.xyz`, 'chemical/x-xyz');
    notify(`Downloaded ${stem}.xyz`);
  };

  const copy = async (text: string, what: string) => {
    notify((await copyText(text)) ? `${what} copied to clipboard` : `Could not copy ${what}`);
  };

  const exportImage = async (kind: 'svg' | 'png') => {
    const svg = previewRef.current;
    if (!svg) return;
    const background = getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#fff';
    const text = svgToStandalone(svg, background);
    if (kind === 'svg') {
      downloadText(text, `${stem}.svg`, 'image/svg+xml');
      notify(`Downloaded ${stem}.svg`);
      return;
    }
    try {
      const box = svg.viewBox.baseVal;
      const width = 1600;
      const height = Math.round((width * box.height) / box.width);
      const blob = await svgToPngBlob(text, width, height);
      downloadBlob(blob, `${stem}.png`);
      notify(`Downloaded ${stem}.png`);
    } catch (err) {
      notify(`PNG export failed: ${(err as Error).message}`);
    }
  };

  const doImport = () => {
    try {
      const parsed = parseCellsJson(importText);
      const check = validateCells(parsed);
      dispatch({ type: 'set', cells: parsed });
      setImportError(null);
      setImportOpen(false);
      setImportText('');
      notify(
        check.ok
          ? `Imported ${parsed.length} ring${parsed.length === 1 ? '' : 's'}`
          : `Imported ${parsed.length} rings — see validation`,
      );
    } catch (err) {
      setImportError((err as Error).message);
    }
  };

  return (
    <section className="panel export" aria-label="Export">
      <div className="button-row">
        <button
          type="button"
          className="btn primary"
          onClick={downloadXyz}
          disabled={!canExport}
          title={blockedReason ?? `Download ${stem}.xyz`}
        >
          ⬇ Download .xyz
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => copy(xyz, '.xyz text')}
          disabled={!canExport}
          title={blockedReason ?? 'Copy the .xyz text'}
        >
          Copy
        </button>
      </div>
      {blockedReason && <p className="hint blocked">Export blocked: {blockedReason}</p>}

      <pre className="xyz-preview" aria-label=".xyz preview" tabIndex={0}>
        {molecule.atoms.length ? xyz : 'No atoms yet.'}
      </pre>

      <div className="button-row wrap">
        <button
          type="button"
          className="btn small"
          onClick={() => copy(cellsToJson(cells), 'cells JSON')}
          disabled={!cells.length}
          title="Ring coordinates as compact JSON, for scripts or for re-importing"
        >
          Copy cells JSON
        </button>
        <button type="button" className="btn small" onClick={() => setImportOpen((v) => !v)}>
          {importOpen ? 'Cancel import' : 'Import cells'}
        </button>
        <button
          type="button"
          className="btn small"
          onClick={() => copy(shareUrl(), 'Link')}
          disabled={!cells.length || !shareable}
          title={
            shareable
              ? 'A link that reopens this exact molecule and settings'
              : 'This selection is too large for a link — use Copy cells JSON'
          }
        >
          Copy share link
        </button>
        <button
          type="button"
          className="btn small"
          onClick={() => exportImage('svg')}
          disabled={!molecule.atoms.length}
        >
          Image (SVG)
        </button>
        <button
          type="button"
          className="btn small"
          onClick={() => exportImage('png')}
          disabled={!molecule.atoms.length}
        >
          Image (PNG)
        </button>
      </div>

      {!shareable && (
        <p className="hint">
          This molecule is too large to fit in a share link (
          {builder.shareHashLength.toLocaleString()} characters); the address bar is left unchanged.
          Share it as cells JSON or as the .xyz file instead.
        </p>
      )}

      {importOpen && (
        <div className="import">
          <textarea
            rows={3}
            placeholder='{"cells": [[0,0],[1,0],[1,1]]}  or  0,0 1,0 1,1'
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            aria-label="Cells to import"
          />
          {importError && <p className="hint blocked">{importError}</p>}
          <button
            type="button"
            className="btn small primary"
            onClick={doImport}
            disabled={!importText.trim()}
          >
            Replace selection
          </button>
        </div>
      )}
    </section>
  );
}
