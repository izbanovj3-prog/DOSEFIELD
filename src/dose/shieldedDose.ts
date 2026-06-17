/**
 * Phase-3 shielded dose: transport the GCR spectrum through a slab of shield material
 * (areal density t [g/cm²]) via CSDA, then deposit in a thin tissue (water) target behind it.
 *
 * Transport (primaries only, straight-ahead CSDA):
 *   An ion entering the shield with energy/nucleon E_in has range R_shield(E_in).
 *     R_shield(E_in) ≤ t  → STOPS in the shield (no target dose).
 *     R_shield(E_in) > t  → EXITS with residual range R_res = R_shield(E_in) − t,
 *                            i.e. residual energy E_out = R_shield⁻¹(R_res).
 *   Number-fluence is conserved for survivors (1D, no nuclear loss), so the dose behind
 *   the shield is integrated over the INCIDENT spectrum using the residual-energy LET:
 *
 *     D(t) = κ · Σ_Z ∫_{R_shield(E_in)>t} 4π·J_Z(E_in) · S_water(Z, E_out) dE_in
 *     H(t) = κ · Σ_Z ∫ ... · Q(LET_water(Z, E_out)) dE_in,     κ = 1.602e-10 (MeV/g→Gy)
 *
 * At t = 0 this reduces exactly to the Phase-2 free-space result.
 *
 * APPROXIMATIONS (labeled): no nuclear fragmentation / secondary production (Phase 5),
 * no range straggling, no lateral scattering, thin target (no self-shielding).
 */

import { WATER, MATERIALS } from '../physics/materials.js';
import { ionStopping } from '../physics/ionStopping.js';
import { qualityFactorICRP60, letFromMassStopping } from '../physics/qualityFactor.js';
import { GCR_SPECIES, differentialFluxMatthia } from '../../data/gcr/matthia2013.js';
import { getRangeTable } from '../physics/ionRange.js';
import type { DoseResult, SpeciesDose } from './doseModel.js';

const MEV_PER_G_TO_GY = 1.602176634e-10;
const SECONDS_PER_DAY = 86400;
const FOUR_PI = 4 * Math.PI;
const E_HI_MEV = 1e5; // 100 GeV/n integration ceiling
const SPECTRUM_FLOOR = 10; // Matthiä validity floor (MeV/n)

interface SpeciesIntegral {
  flux: number;
  dose: number;
  doseEq: number;
}

/**
 * Integrate one species behind areal density t [g/cm²] of shield, in RESIDUAL-energy space.
 *
 * We integrate over E_out (energy at the target) rather than E_in (incident energy): for each
 * E_out the incident energy is E_in = R_shield⁻¹(R_shield(E_out) + t), with Jacobian
 *   dE_in/dE_out = S_shield(E_in) / S_shield(E_out).
 * Doing it this way cancels the S_water(E_out) blow-up of slow exiting particles against the
 * 1/S_shield(E_out) in the Jacobian, leaving a smooth integrand (no moving cusp → no jitter).
 *
 *   flux  = ∫ 4π·J(E_in) · (dE_in/dE_out) dE_out
 *   dose  = ∫ 4π·J(E_in) · S_water(E_out) · (dE_in/dE_out) dE_out
 *   doseEq= ∫ 4π·J(E_in) · S_water(E_out) · Q(LET(E_out)) · (dE_in/dE_out) dE_out
 */
function integrateSpecies(
  Z: number,
  A: number,
  shieldKey: string,
  t_gcm2: number,
  W: number,
  perDecade: number,
): SpeciesIntegral {
  const shield = MATERIALS[shieldKey]!;
  const table = getRangeTable(Z, A, shield);
  const E_OUT_LO = 1; // MeV/n (residual energies below this carry negligible energy)

  const uLo = Math.log(E_OUT_LO);
  const uHi = Math.log(E_HI_MEV);
  let n = Math.max(2, Math.ceil((perDecade * (uHi - uLo)) / Math.LN10));
  if (n % 2 === 1) n += 1;
  const h = (uHi - uLo) / n;

  const terms = (E_out: number): SpeciesIntegral => {
    const E_in = t_gcm2 <= 0 ? E_out : table.energyAtRange(table.rangeAtEnergy(E_out) + t_gcm2);
    if (E_in < SPECTRUM_FLOOR || E_in > E_HI_MEV) return { flux: 0, dose: 0, doseEq: 0 };
    const J = differentialFluxMatthia(Z, E_in, W); // /(cm²·s·sr·(MeV/n))
    const phi = FOUR_PI * J;
    const jac =
      t_gcm2 <= 0
        ? 1
        : ionStopping(E_in, Z, A, shield).massStopping /
          ionStopping(E_out, Z, A, shield).massStopping;
    const Sw = ionStopping(E_out, Z, A, WATER).massStopping; // tissue LET source
    const LET = letFromMassStopping(Sw, WATER.density);
    const Q = qualityFactorICRP60(LET);
    const base = phi * jac * E_out; // ×E_out for the log-space integration
    return { flux: base, dose: base * Sw, doseEq: base * Sw * Q };
  };

  const acc: SpeciesIntegral = { flux: 0, dose: 0, doseEq: 0 };
  for (let i = 0; i <= n; i++) {
    const w = i === 0 || i === n ? 1 : i % 2 === 1 ? 4 : 2;
    const tm = terms(Math.exp(uLo + i * h));
    acc.flux += w * tm.flux;
    acc.dose += w * tm.dose;
    acc.doseEq += w * tm.doseEq;
  }
  const k = h / 3;
  return { flux: acc.flux * k, dose: acc.dose * k, doseEq: acc.doseEq * k };
}

/**
 * Dose & dose-equivalent in a thin water target behind `t_gcm2` of shield material.
 * `shieldKey` ∈ {aluminum, polyethylene, water}. t_gcm2 = 0 → free space (Phase 2).
 */
export function computeShieldedDose(
  shieldKey: string,
  t_gcm2: number,
  W: number,
  perDecade = 100,
): DoseResult {
  let totDose = 0;
  let totDoseEq = 0;
  let totFlux = 0;
  const raw = GCR_SPECIES.map((sp) => {
    const integ = integrateSpecies(sp.Z, sp.A, shieldKey, t_gcm2, W, perDecade);
    totDose += integ.dose;
    totDoseEq += integ.doseEq;
    totFlux += integ.flux;
    return { sp, integ };
  });

  const totDoseEq_mSv = totDoseEq * MEV_PER_G_TO_GY * SECONDS_PER_DAY * 1000;
  const per: SpeciesDose[] = raw.map(({ sp, integ }) => ({
    Z: sp.Z,
    symbol: sp.symbol,
    flux: integ.flux,
    dose_mGy_day: integ.dose * MEV_PER_G_TO_GY * SECONDS_PER_DAY * 1000,
    doseEq_mSv_day: integ.doseEq * MEV_PER_G_TO_GY * SECONDS_PER_DAY * 1000,
    doseEqFraction: totDoseEq_mSv > 0 ? (integ.doseEq * MEV_PER_G_TO_GY * SECONDS_PER_DAY * 1000) / totDoseEq_mSv : 0,
  }));

  return {
    W,
    absorbedDose_mGy_day: totDose * MEV_PER_G_TO_GY * SECONDS_PER_DAY * 1000,
    doseEquivalent_mSv_day: totDoseEq_mSv,
    meanQ: totDose > 0 ? totDoseEq / totDose : 0,
    integralFlux: totFlux,
    perSpecies: per,
  };
}
