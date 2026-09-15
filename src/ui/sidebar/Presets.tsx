import { useState } from 'react';
import { FAMILIES, PRESETS, type Cell } from '../../core';
import { prettyFormula } from '../format';

interface Props {
  onLoad: (cells: Cell[], name: string) => void;
}

export function Presets({ onLoad }: Props) {
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [familyId, setFamilyId] = useState(FAMILIES[0].id);
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      FAMILIES.flatMap((f) => f.params.map((p) => [`${f.id}.${p.key}`, p.default])),
    ),
  );
  const preset = PRESETS.find((p) => p.id === presetId)!;
  const family = FAMILIES.find((f) => f.id === familyId)!;

  const loadFamily = () => {
    const args = Object.fromEntries(
      family.params.map((p) => [p.key, values[`${family.id}.${p.key}`]]),
    );
    const label = `${family.id}_${family.params.map((p) => args[p.key]).join('x')}`;
    onLoad(family.build(args), label);
  };

  return (
    <section className="panel presets" aria-label="Presets">
      <div className="field-row">
        <label htmlFor="preset-select">Named molecule</label>
        <select id="preset-select" value={presetId} onChange={(e) => setPresetId(e.target.value)}>
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {prettyFormula(p.formula)}
            </option>
          ))}
        </select>
        <button type="button" className="btn" onClick={() => onLoad(preset.cells, preset.id)}>
          Load
        </button>
      </div>
      <p className="hint">{preset.description}</p>

      <div className="field-row">
        <label htmlFor="family-select">Family</label>
        <select
          id="family-select"
          value={familyId}
          onChange={(e) => setFamilyId(e.target.value as typeof familyId)}
        >
          {FAMILIES.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <button type="button" className="btn" onClick={loadFamily}>
          Load
        </button>
      </div>
      <div className="field-row params">
        {family.params.map((p) => {
          const key = `${family.id}.${p.key}`;
          return (
            <label key={key} className="inline">
              {p.label}
              <input
                type="number"
                min={p.min}
                max={p.max}
                step={1}
                value={values[key]}
                onChange={(e) => {
                  const v = Math.min(
                    p.max,
                    Math.max(p.min, Math.round(Number(e.target.value) || p.min)),
                  );
                  setValues((prev) => ({ ...prev, [key]: v }));
                }}
              />
            </label>
          );
        })}
      </div>
      <p className="hint">{family.description}</p>
    </section>
  );
}
