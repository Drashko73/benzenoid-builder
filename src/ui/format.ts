/** Subscript digits for a formula: C24H12 -> C₂₄H₁₂ */
export function prettyFormula(formula: string): string {
  return formula.replace(/\d+/g, (d) => d.replace(/\d/g, (c) => '₀₁₂₃₄₅₆₇₈₉'[Number(c)]));
}
