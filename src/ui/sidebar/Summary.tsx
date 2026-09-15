import type { Molecule, ValidationResult } from '../../core';
import { prettyFormula } from '../format';

interface Props {
  molecule: Molecule;
  validation: ValidationResult;
  ringCount: number;
}

export function Summary({ molecule, validation, ringCount }: Props) {
  const nAtoms = molecule.atoms.length;
  const status = !nAtoms
    ? { cls: 'muted', text: 'empty' }
    : validation.ok
      ? validation.warnings.length
        ? { cls: 'warn', text: 'valid, with warnings' }
        : { cls: 'good', text: 'valid benzenoid' }
      : { cls: 'bad', text: 'not exportable' };

  return (
    <section className="panel summary" aria-label="Molecule summary">
      <div className="formula-row">
        <span className="formula" title={molecule.formula || 'no atoms'}>
          {molecule.formula ? prettyFormula(molecule.formula) : '—'}
        </span>
        <span className={`badge ${status.cls}`}>{status.text}</span>
      </div>
      <dl className="stats">
        <div>
          <dt>Rings</dt>
          <dd>{ringCount}</dd>
        </div>
        <div>
          <dt>Atoms</dt>
          <dd>{nAtoms}</dd>
        </div>
        <div>
          <dt>C / H</dt>
          <dd>
            {molecule.nCarbon} / {molecule.nHydrogen}
          </dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd>
            {nAtoms
              ? `${molecule.extent.width.toFixed(1)} × ${molecule.extent.height.toFixed(1)} Å`
              : '—'}
          </dd>
        </div>
      </dl>
    </section>
  );
}
