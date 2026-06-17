/**
 * Heavy-ion electronic mass stopping power via effective-charge (z_eff²) scaling of the
 * Phase-1 Bethe engine.
 *
 * Physics (project spec): at EQUAL energy-per-nucleon all ions share the same velocity β,
 * and the Bethe stopping number L(β) is charge-independent in our approximation, so
 *
 *   S_ion(E/n) = z_eff(Z, β)² · S_proton(E/n)          [MeV·cm²/g]
 *
 * This is exactly the Bethe formula evaluated with z = z_eff at the ion's β, which is how
 * we compute it (reusing the validated `electronicMassStoppingPower`).
 *
 * APPROXIMATIONS (labeled): omits Barkas (z³) and Bloch (z⁴) corrections and any nuclear
 * charge-changing (fragmentation) — primaries only. Effective charge from Barkas (1963).
 */

import { kinematics, electronicMassStoppingPower } from './stoppingPower.js';
import { effectiveCharge } from './effectiveCharge.js';
import { M_P_C2, M_U_C2 } from './constants.js';
import type { Material } from './materials.js';

export interface IonStoppingResult {
  /** velocity β = v/c */
  beta: number;
  /** Barkas effective charge */
  zEff: number;
  /** electronic mass stopping power, MeV·cm²/g */
  massStopping: number;
}

/** β = v/c for an ion at kinetic energy per nucleon E_n [MeV/n]. */
export function betaFromEnergyPerNucleon(E_n_MeV: number, Z: number, A: number): number {
  const restMass = Z === 1 ? M_P_C2 : A * M_U_C2;
  const { beta2 } = kinematics(E_n_MeV * A, restMass);
  return Math.sqrt(beta2);
}

/**
 * Electronic mass stopping power [MeV·cm²/g] of ion (Z, A) at energy/nucleon E_n in `mat`.
 */
export function ionStopping(E_n_MeV: number, Z: number, A: number, mat: Material): IonStoppingResult {
  const restMass = Z === 1 ? M_P_C2 : A * M_U_C2;
  const T_total = E_n_MeV * A;
  const { beta2 } = kinematics(T_total, restMass);
  const beta = Math.sqrt(beta2);
  const zEff = effectiveCharge(Z, beta);
  const massStopping = electronicMassStoppingPower(T_total, mat, zEff, restMass);
  return { beta, zEff, massStopping };
}

/** Convenience: just the mass stopping power [MeV·cm²/g]. */
export function ionMassStoppingPower(E_n_MeV: number, Z: number, A: number, mat: Material): number {
  return ionStopping(E_n_MeV, Z, A, mat).massStopping;
}
