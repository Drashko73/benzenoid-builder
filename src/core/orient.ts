/**
 * Export orientation convention: the molecule is centred on its all-atom centroid
 * and its long axis is aligned with +x. Deterministic on purpose, so the same
 * molecule always comes out in the same frame.
 */

/** 2x2 rotation matrix, row-major. */
export type Rotation = readonly [readonly [number, number], readonly [number, number]];

export function rotation(theta: number): Rotation {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [
    [c, -s],
    [s, c],
  ];
}

function multiply(a: Rotation, b: Rotation): Rotation {
  return [
    [a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1]],
    [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1]],
  ];
}

/**
 * Rotation aligning the carbon skeleton's long axis with +x, or null when the
 * two principal moments are within `degenerateRatio` of each other (a round
 * molecule such as benzene, coronene or triphenylene, where the lattice's own
 * orientation is kept rather than rotating on numerical noise).
 *
 * An eigenvector fixes the axis but not its direction, so the +x/-x choice is
 * settled by the skew of the carbon distribution: the heavier end points to +x.
 * When the skew vanishes (a molecule symmetric under x -> -x) the eigenvector is
 * taken with a non-negative x component (and non-negative y when x = 0). Generic
 * symmetric eigensolvers make no such promise, so the reference fixtures may differ
 * by a 180 degree rotation in that one case: a physically identical structure.
 */
export function principalRotation(
  carbons: readonly (readonly [number, number])[],
  degenerateRatio = 0.98,
): Rotation | null {
  const n = carbons.length;
  if (n < 2) return null;
  const mx = carbons.reduce((s, p) => s + p[0], 0) / n;
  const my = carbons.reduce((s, p) => s + p[1], 0) / n;
  const centred = carbons.map(([x, y]) => [x - mx, y - my] as const);

  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const [x, y] of centred) {
    sxx += x * x;
    sxy += x * y;
    syy += y * y;
  }
  const half = (sxx + syy) / 2;
  const disc = Math.sqrt(((sxx - syy) / 2) ** 2 + sxy * sxy);
  const lambdaMax = half + disc;
  const lambdaMin = half - disc;
  if (lambdaMax <= 0 || lambdaMin / lambdaMax > degenerateRatio) return null;

  let ax: number;
  let ay: number;
  if (Math.abs(sxy) > 1e-12) {
    ax = lambdaMax - syy;
    ay = sxy;
  } else if (sxx >= syy) {
    ax = 1;
    ay = 0;
  } else {
    ax = 0;
    ay = 1;
  }
  if (ax < 0 || (ax === 0 && ay < 0)) {
    ax = -ax;
    ay = -ay;
  }

  let rot = rotation(-Math.atan2(ay, ax));
  let skew = 0;
  for (const [x, y] of centred) {
    const px = rot[0][0] * x + rot[0][1] * y;
    skew += px * px * px;
  }
  if (skew < -1e-9) rot = multiply(rotation(Math.PI), rot); // heavier end was at -x: flip it round
  return rot;
}
