import type { Molecule, ModelLimits, ValidationResult } from '../../core';
import { prettyFormula } from '../format';

interface Props {
  molecule: Molecule;
  validation: ValidationResult;
  limits: ModelLimits;
  ringCount: number;
}

export function Summary({ molecule, validation, limits, ringCount }: Props) {
  const nAtoms = molecule.atoms.length;
  const domain =
    nAtoms === 0
      ? null
      : nAtoms > limits.hardMaxAtoms
        ? { cls: 'bad', text: `exceeds model limit (${limits.hardMaxAtoms})` }
        : nAtoms > limits.trainingMaxAtoms
          ? { cls: 'warn', text: `outside training range (≤ ${limits.trainingMaxAtoms})` }
          : { cls: 'good', text: 'inside training range' };

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
      {domain && (
        <p
          className={`domain ${domain.cls}`}
          title="Relative to the current-density prediction model"
        >
          Model domain: {domain.text}
        </p>
      )}
    </section>
  );
}
