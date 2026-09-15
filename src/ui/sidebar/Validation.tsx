import type { FixAction, ValidationResult } from '../../core';

interface Props {
  validation: ValidationResult;
  onFix: (fix: FixAction) => void;
}

export function Validation({ validation, onFix }: Props) {
  if (!validation.issues.length) {
    return (
      <section className="panel validation" aria-label="Validation">
        <p className="ok-line">✓ Single connected benzenoid, no steric problems.</p>
      </section>
    );
  }
  return (
    <section className="panel validation" aria-label="Validation">
      <ul className="issues">
        {validation.issues.map((issue) => (
          <li key={issue.id} className={`issue ${issue.severity}`}>
            <div className="issue-title">
              <span className="issue-icon" aria-hidden="true">
                {issue.severity === 'error' ? '✕' : issue.severity === 'warning' ? '!' : 'i'}
              </span>
              <span>{issue.title}</span>
            </div>
            <p className="issue-detail">{issue.detail}</p>
            {issue.fix && (
              <button type="button" className="btn small" onClick={() => onFix(issue.fix!.action)}>
                {issue.fix.label}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
