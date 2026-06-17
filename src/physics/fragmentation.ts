/**
 * SIMPLIFIED nuclear projectile-fragmentation model (Phase 5, optional / post-MVP).
 *
 * This is deliberately NOT a substitute for HZETRN. It captures the dominant, well-understood
 * effects of nuclear charge-changing reactions in a shield:
 *   (1) heavy (HZE) primaries are ATTENUATED with depth — mean free path λ;
 *   (2) they break into LIGHTER fragments that continue at ~the same velocity (energy/nucleon).
 *
 * Charge-changing cross-section — Bradt–Peters geometric form:
 *   σ_cc = π·r0²·(A_p^{1/3} + A_t^{1/3} − b)²
 * (Bradt & Peters, Phys. Rev. 77, 54 (1950); r0, b are the standard semi-empirical overlap
 * parameters). Energy dependence is neglected (σ is ~flat above ~200 MeV/n) — labeled.
 *
 * Mean free path in areal density:  λ[g/cm²] = A_t / (N_A · σ_cc)   (per target element;
 * compounds combine by mass-weighted macroscopic cross-section).
 *
 * APPROXIMATIONS (labeled): geometric cross-section only; single energy-independent σ;
 * a crude charge+(A/Z)-conserving fragment charge distribution; NEUTRONS and target
 * fragments are NOT produced (the chargeless secondaries that dominate the *absorbed-dose*
 * buildup behind shielding — the main reason this stays short of HZETRN).
 */

import { N_A } from './constants.js';
import type { Material } from './materials.js';

const R0_FM = 1.35; // fm
const B_OVERLAP = 0.83;
const FM2_TO_CM2 = 1e-26; // 1 fm² = 1e-26 cm²

/** Bradt–Peters charge-changing cross-section [cm²] for projectile A_p on target A_t. */
export function chargeChangingCrossSection(A_p: number, A_t: number): number {
  const r = Math.cbrt(A_p) + Math.cbrt(A_t) - B_OVERLAP;
  return Math.PI * R0_FM * R0_FM * r * r * FM2_TO_CM2;
}

/**
 * Nuclear interaction mean free path λ [g/cm²] for projectile (A_p) in `material`,
 * combining elements by mass-weighted macroscopic cross-section:
 *   1/λ = Σ_e (w_e · N_A / A_e) · σ(A_p, A_e)
 */
export function interactionMFP(A_p: number, material: Material): number {
  let invLambda = 0;
  for (const el of material.composition) {
    invLambda += ((el.massFraction * N_A) / el.A) * chargeChangingCrossSection(A_p, el.A);
  }
  return 1 / invLambda;
}

export interface Fragment {
  Z: number;
  A: number;
  /** expected number of this fragment per charge-changing interaction */
  multiplicity: number;
}

/**
 * Simplified fragment yield for a parent (Z_p, A_p): a flat charge distribution over
 * Z_f = 1 .. Z_p−1 with n(Z_f) = 2/(Z_p−1) (so Σ Z_f·n = Z_p, charge-conserving), and
 * A_f = A_p·Z_f/Z_p (so Σ A_f·n = A_p, mass-conserving into charged fragments — i.e. no
 * explicit neutrons). Crude but parameter-free; labeled as such.
 */
export function fragmentYield(Z_p: number, A_p: number): Fragment[] {
  if (Z_p <= 1) return [];
  const n = 2 / (Z_p - 1);
  const out: Fragment[] = [];
  for (let Zf = 1; Zf <= Z_p - 1; Zf++) {
    out.push({ Z: Zf, A: (A_p * Zf) / Z_p, multiplicity: n });
  }
  return out;
}
