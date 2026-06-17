/**
 * Ion CSDA range tables in a shield material, with range ↔ energy inversion — the core of
 * the Phase-3 slab transport.
 *
 * Range of an ion (Z, A) as a function of kinetic energy per nucleon E_n [MeV/n]:
 *
 *   R(E_n) = ∫_{E_FLOOR}^{E_n}  A / S_ion(E_n')  dE_n'        [g/cm²]
 *
 * where S_ion is the electronic mass stopping power [MeV·cm²/g] (z_eff² scaled, Phase 2),
 * and A·dE_n = dT_total so A/S_ion = dR/dE_n. Tabulated on a log grid and inverted by
 * interpolation so the transport can ask "what energy has residual range R?".
 *
 * APPROXIMATION (labeled): range below E_FLOOR = 1 MeV/n is not modeled (Bethe invalid
 * there); its contribution (≲1e-3 g/cm² even for protons) is negligible vs g/cm²-scale
 * shields. CSDA = straight-ahead, no range straggling, no nuclear interactions.
 */

import type { Material } from './materials.js';
import { ionMassStoppingPower } from './ionStopping.js';

const E_FLOOR = 1; // MeV/n
const E_CEIL = 1e5; // MeV/n
const PTS_PER_DECADE = 160;

export class IonRangeTable {
  readonly Z: number;
  readonly A: number;
  readonly materialKey: string;
  private readonly E: number[] = []; // energy/nucleon grid (MeV/n), ascending
  private readonly R: number[] = []; // cumulative range above E_FLOOR (g/cm²), ascending

  constructor(Z: number, A: number, material: Material) {
    this.Z = Z;
    this.A = A;
    this.materialKey = material.key;

    const uLo = Math.log(E_FLOOR);
    const uHi = Math.log(E_CEIL);
    const n = Math.ceil((PTS_PER_DECADE * (uHi - uLo)) / Math.LN10);
    const h = (uHi - uLo) / n;

    let prevE = E_FLOOR;
    let prevInv = A / ionMassStoppingPower(prevE, Z, A, material); // dR/dE_n = A/S
    this.E.push(prevE);
    this.R.push(0);
    let cum = 0;
    for (let i = 1; i <= n; i++) {
      const E = Math.exp(uLo + i * h);
      const inv = A / ionMassStoppingPower(E, Z, A, material);
      cum += 0.5 * (prevInv + inv) * (E - prevE); // trapezoid in E
      this.E.push(E);
      this.R.push(cum);
      prevE = E;
      prevInv = inv;
    }
  }

  /** Minimum / maximum tabulated energy per nucleon (MeV/n). */
  get minEnergy(): number {
    return this.E[0]!;
  }
  get maxEnergy(): number {
    return this.E[this.E.length - 1]!;
  }
  /** Total tabulated range at E_CEIL (g/cm²). */
  get maxRange(): number {
    return this.R[this.R.length - 1]!;
  }

  /** CSDA range [g/cm²] at energy per nucleon E_n [MeV/n]. */
  rangeAtEnergy(E_n: number): number {
    const E = this.E;
    const R = this.R;
    const n = E.length;
    if (E_n <= E[0]!) return R[0]! + (R[1]! * (E_n - E[0]!)) / (E[1]! - E[0]!); // linear toward 0
    if (E_n >= E[n - 1]!) return R[n - 1]!;
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (E[mid]! <= E_n) lo = mid;
      else hi = mid;
    }
    // first interval has R[lo]=0 → interpolate linearly in E; otherwise log-log
    if (R[lo]! <= 0) return (R[hi]! * (E_n - E[lo]!)) / (E[hi]! - E[lo]!);
    const t = (Math.log(E_n) - Math.log(E[lo]!)) / (Math.log(E[hi]!) - Math.log(E[lo]!));
    return Math.exp(Math.log(R[lo]!) + t * (Math.log(R[hi]!) - Math.log(R[lo]!)));
  }

  /** Inverse: energy per nucleon [MeV/n] whose CSDA range equals R_g [g/cm²]. */
  energyAtRange(R_g: number): number {
    const E = this.E;
    const R = this.R;
    const n = R.length;
    if (R_g <= 0) return E[0]!;
    if (R_g <= R[1]!) return E[0]! + ((E[1]! - E[0]!) * R_g) / R[1]!; // linear near 0
    if (R_g >= R[n - 1]!) return E[n - 1]!;
    let lo = 1;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (R[mid]! <= R_g) lo = mid;
      else hi = mid;
    }
    const t = (Math.log(R_g) - Math.log(R[lo]!)) / (Math.log(R[hi]!) - Math.log(R[lo]!));
    return Math.exp(Math.log(E[lo]!) + t * (Math.log(E[hi]!) - Math.log(E[lo]!)));
  }
}

// Cache: building a table integrates the Bethe engine ~600 times, so reuse per (material, ion).
const cache = new Map<string, IonRangeTable>();

export function getRangeTable(Z: number, A: number, material: Material): IonRangeTable {
  const key = `${material.key}:${Z}`;
  let t = cache.get(key);
  if (!t) {
    t = new IonRangeTable(Z, A, material);
    cache.set(key, t);
  }
  return t;
}
