import { useState } from 'react';
import { CC_BOND, CH_BOND, DEFAULT_MODEL_LIMITS } from '../../core';
import type { Builder } from '../state/useBuilder';

interface Props {
  builder: Builder;
}

function NumberField({
  id,
  label,
  value,
  onCommit,
  step = 0.01,
  min = 0.5,
  max = 3,
  unit = 'Å',
}: {
  id: string;
  label: string;
  value: number;
  onCommit: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
}) {
  const [text, setText] = useState(String(value));
  const [last, setLast] = useState(value);
  if (last !== value) {
    setLast(value);
    setText(String(value));
  }
  const commit = () => {
    const v = Number(text);
    if (Number.isFinite(v) && v >= min && v <= max) onCommit(v);
    else setText(String(value));
  };
  return (
    <label htmlFor={id} className="field">
      <span>{label}</span>
      <span className="with-unit">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
        <span className="unit">{unit}</span>
      </span>
    </label>
  );
}

export function Parameters({ builder }: Props) {
  const { state, dispatch } = builder;
  const [advanced, setAdvanced] = useState(false);

  return (
    <section className="panel parameters" aria-label="Parameters">
      <NumberField
        id="cc-bond"
        label="C–C bond"
        value={state.ccBond}
        onCommit={(ccBond) => dispatch({ type: 'setParams', ccBond })}
      />
      <NumberField
        id="ch-bond"
        label="C–H bond"
        value={state.chBond}
        onCommit={(chBond) => dispatch({ type: 'setParams', chBond })}
      />
      <p className="hint">
        Defaults {CC_BOND} / {CH_BOND} Å were fitted to DFT geometries of the current-density
        dataset.{' '}
        {(state.ccBond !== CC_BOND || state.chBond !== CH_BOND) && (
          <button
            type="button"
            className="link"
            onClick={() => dispatch({ type: 'setParams', ccBond: CC_BOND, chBond: CH_BOND })}
          >
            Reset
          </button>
        )}
      </p>

      <fieldset className="field radio-group">
        <legend>Orientation</legend>
        <label className="inline">
          <input
            type="radio"
            name="orient"
            checked={state.orient === 'principal'}
            onChange={() => dispatch({ type: 'setParams', orient: 'principal' })}
          />
          long axis along x
        </label>
        <label className="inline">
          <input
            type="radio"
            name="orient"
            checked={state.orient === 'none'}
            onChange={() => dispatch({ type: 'setParams', orient: 'none' })}
          />
          as drawn
        </label>
      </fieldset>
      <p className="hint">
        Both centre the molecule on its centroid in the z = 0 plane. “Long axis along x” is the
        dataset convention (heavier end to +x; round molecules keep the grid orientation).
      </p>

      <label htmlFor="mol-name" className="field">
        <span>File name</span>
        <input
          id="mol-name"
          type="text"
          placeholder={builder.molecule.formula || 'molecule'}
          value={state.name}
          onChange={(e) => dispatch({ type: 'setName', name: e.target.value })}
          maxLength={80}
        />
      </label>
      <label htmlFor="mol-comment" className="field">
        <span>Comment line</span>
        <input
          id="mol-comment"
          type="text"
          placeholder="(blank, like the dataset files)"
          value={state.comment}
          onChange={(e) => dispatch({ type: 'setComment', comment: e.target.value })}
          maxLength={200}
        />
      </label>

      <label className="inline symbols-toggle">
        <input
          type="checkbox"
          checked={state.symbols}
          onChange={(e) => dispatch({ type: 'setSymbols', value: e.target.checked })}
        />
        Write element symbols (C, H) instead of atomic numbers
      </label>
      <p className="hint">
        The dataset files use atomic numbers (6, 1). Some viewers only accept symbols.
      </p>

      <button type="button" className="link disclosure" onClick={() => setAdvanced((v) => !v)}>
        {advanced ? '▾' : '▸'} Model limits
      </button>
      {advanced && (
        <div className="advanced">
          <p className="hint">
            Size checks refer to the current-density prediction model: its largest training molecule
            and the fixed number of atoms it pads to. Adjust them if you retrain.
          </p>
          <NumberField
            id="limit-training"
            label="Training max atoms"
            value={state.limits.trainingMaxAtoms}
            step={1}
            min={1}
            max={100000}
            unit=""
            onCommit={(v) =>
              dispatch({
                type: 'setLimits',
                limits: { ...state.limits, trainingMaxAtoms: Math.round(v) },
              })
            }
          />
          <NumberField
            id="limit-hard"
            label="Hard max atoms"
            value={state.limits.hardMaxAtoms}
            step={1}
            min={1}
            max={100000}
            unit=""
            onCommit={(v) =>
              dispatch({
                type: 'setLimits',
                limits: { ...state.limits, hardMaxAtoms: Math.round(v) },
              })
            }
          />
          <label className="inline">
            <input
              type="checkbox"
              checked={state.allowOversize}
              onChange={(e) => dispatch({ type: 'setAllowOversize', value: e.target.checked })}
            />
            Allow export beyond the hard limit
          </label>
          {(state.limits.trainingMaxAtoms !== DEFAULT_MODEL_LIMITS.trainingMaxAtoms ||
            state.limits.hardMaxAtoms !== DEFAULT_MODEL_LIMITS.hardMaxAtoms) && (
            <button
              type="button"
              className="link"
              onClick={() => dispatch({ type: 'setLimits', limits: DEFAULT_MODEL_LIMITS })}
            >
              Reset limits
            </button>
          )}
        </div>
      )}
    </section>
  );
}
