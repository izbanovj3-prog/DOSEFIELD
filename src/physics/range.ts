/**
 * CSDA (continuous-slowing-down approximation) range via integration of the
 * inverse stopping power:
 *
 *   R(T) = ∫₀ᵀ dE / [ −(1/ρ) dE/dx (E) ]      [g/cm²]
 *
 * IMPORTANT (Phase 1 honesty): the Bethe formula is not valid below ~1 MeV for protons,
 * so we cannot integrate down to E = 0. We therefore expose a *range increment*
 *
 *   ΔR(E_lo → E_hi) = ∫_{E_lo}^{E_hi} dE / S(E)
 *
 * and validate it against the corresponding PSTAR difference R_PSTAR(E_hi) − R_PSTAR(E_lo).
 * This tests exactly the physics we implement (the 1/S integral) without smuggling in a
 * sub-MeV low-energy model. The absolute CSDA range from rest additionally needs the
 * 0 → E_lo contribution, which we quote from PSTAR rather than compute.
 *
 * The integral is evaluated in log-energy (u = ln E, dE = E·du) with composite Simpson's
 * rule; S(E) is smooth there so this converges quickly and deterministically.
 */

import type { Material } from './materials.js';
import { electronicMassStoppingPower } from './stoppingPower.js';

export interface RangeOptions {
  /** projectile charge number (default proton) */
  z?: number;
  /** projectile rest energy in MeV (default proton) */
  restMass_MeV?: number;
  /** integration nodes per decade of energy (default 400) */
  pointsPerDecade?: number;
}

/**
 * Range increment ΔR = ∫_{E_lo}^{E_hi} dE / S(E) in g/cm², for E_hi > E_lo > 0.
 */
export function csdaRangeIncrement(
  E_lo_MeV: number,
  E_hi_MeV: number,
  mat: Material,
  opts: RangeOptions = {},
): number {
  if (!(E_hi_MeV > E_lo_MeV && E_lo_MeV > 0)) {
    throw new Error(`csdaRangeIncrement requires 0 < E_lo < E_hi (got ${E_lo_MeV}, ${E_hi_MeV})`);
  }
  const z = opts.z ?? 1;
  const restMass = opts.restMass_MeV ?? 938.27208816;
  const perDecade = opts.pointsPerDecade ?? 400;

  const uLo = Math.log(E_lo_MeV);
  const uHi = Math.log(E_hi_MeV);
  const decades = (uHi - uLo) / Math.LN10;

  // even number of intervals for Simpson
  let n = Math.max(2, Math.ceil(perDecade * decades));
  if (n % 2 === 1) n += 1;

  const h = (uHi - uLo) / n;
  // integrand in u: dE/S = (E/S) du, since dE = E·du
  const f = (u: number): number => {
    const E = Math.exp(u);
    return E / electronicMassStoppingPower(E, mat, z, restMass);
  };

  let sum = f(uLo) + f(uHi);
  for (let i = 1; i < n; i++) {
    sum += (i % 2 === 1 ? 4 : 2) * f(uLo + i * h);
  }
  return (sum * h) / 3;
}
