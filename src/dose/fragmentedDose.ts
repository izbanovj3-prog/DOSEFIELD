/**
 * Phase-5 shielded dose WITH simplified projectile fragmentation.
 *
 * Single-collision model: a primary (Z_p, A_p) survives the slab with probability
 * P_surv = exp(−t/λ_p); the complementary fraction breaks into lighter fragments (same
 * velocity / energy-per-nucleon) which then deposit in the tissue target with their own
 * (lower) LET and quality factor. At t=0, P_surv=1 and there are no fragments, so this
 * reduces EXACTLY to the primary-only shielded dose.
 *
 * APPROXIMATIONS (labeled): single charge-changing collision (no multi-generation cascade);
 * fragments inherit the parent's residual energy/nucleon; energy-independent Bradt–Peters σ;
 * crude charge+(A/Z)-conserving fragment spectrum; NEUTRONS / target fragments not produced
 * (so the chargeless secondary *dose buildup* RAD sees is not captured — the honest gap).
 *
 * Integration is in residual-energy (E_out) space, as in shieldedDose (smooth integrand).
 */

import { WATER, MATERIALS } from '../physics/materials.js';
import { kinematics, electronicMassStoppingPower } from '../physics/stoppingPower.js';
import { ionStopping } from '../physics/ionStopping.js';
import { effectiveCharge } from '../physics/effectiveCharge.js';
import { qualityFactorICRP60, letFromMassStopping } from '../physics/qualityFactor.js';
import { interactionMFP, fragmentYield } from '../physics/fragmentation.js';
import { GCR_SPECIES, differentialFluxMatthia } from '../../data/gcr/matthia2013.js';
import { getRangeTable } from '../physics/ionRange.js';
import { M_U_C2 } from '../physics/constants.js';
import type { DoseResult, SpeciesDose } from './doseModel.js';

const MEV_PER_G_TO_GY = 1.602176634e-10;
const SECONDS_PER_DAY = 86400;
const FOUR_PI = 4 * Math.PI;
const E_HI_MEV = 1e5;
const SPECTRUM_FLOOR = 10;

interface Acc {
  flux: number;
  dose: number;
  doseEq: number;
}

/** energy/charge contribution helper: dose & dose-equivalent rate per unit (z_eff²·S_unit). */
function letDoseQ(zEff: number, S_unit: number): { S: number; Q: number } {
  const S = zEff * zEff * S_unit;
  return { S, Q: qualityFactorICRP60(letFromMassStopping(S, WATER.density)) };
}

function integrateSpecies(
  Z_p: number,
  A_p: number,
  shieldKey: string,
  t: number,
  W: number,
  perDecade: number,
): Acc {
  const shield = MATERIALS[shieldKey]!;
  const table = getRangeTable(Z_p, A_p, shield);
  const lambda = interactionMFP(A_p, shield);
  const pSurv = t > 0 ? Math.exp(-t / lambda) : 1;
  const frags = t > 0 ? fragmentYield(Z_p, A_p) : [];

  const E_OUT_LO = 1;
  const uLo = Math.log(E_OUT_LO);
  const uHi = Math.log(E_HI_MEV);
  let n = Math.max(2, Math.ceil((perDecade * (uHi - uLo)) / Math.LN10));
  if (n % 2 === 1) n += 1;
  const h = (uHi - uLo) / n;

  const terms = (E_out: number): Acc => {
    const E_in = t <= 0 ? E_out : table.energyAtRange(table.rangeAtEnergy(E_out) + t);
    if (E_in < SPECTRUM_FLOOR || E_in > E_HI_MEV) return { flux: 0, dose: 0, doseEq: 0 };
    const J = differentialFluxMatthia(Z_p, E_in, W);
    const phi = FOUR_PI * J;
    const jac =
      t <= 0
        ? 1
        : ionStopping(E_in, Z_p, A_p, shield).massStopping /
          ionStopping(E_out, Z_p, A_p, shield).massStopping;

    // shared per-node kinematics: stopping unit for a single charge (z=1) at this velocity
    const beta = Math.sqrt(kinematics(E_out, M_U_C2).beta2);
    const S_unit = electronicMassStoppingPower(E_out, WATER, 1, M_U_C2);

    // surviving primary
    const p = letDoseQ(effectiveCharge(Z_p, beta), S_unit);
    let flux = pSurv;
    let dose = pSurv * p.S;
    let doseEq = pSurv * p.S * p.Q;

    // fragment buildup
    const fragW = 1 - pSurv;
    if (fragW > 0) {
      for (const fr of frags) {
        const d = letDoseQ(effectiveCharge(fr.Z, beta), S_unit);
        const w = fragW * fr.multiplicity;
        flux += w;
        dose += w * d.S;
        doseEq += w * d.S * d.Q;
      }
    }

    const base = phi * jac * E_out; // ×E_out for log integration
    return { flux: base * flux, dose: base * dose, doseEq: base * doseEq };
  };

  const acc: Acc = { flux: 0, dose: 0, doseEq: 0 };
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
 * Dose & dose-equivalent behind `t` g/cm² of shield WITH projectile fragmentation.
 * `t = 0` reduces exactly to the primary-only free-space result.
 */
export function computeFragmentedDose(shieldKey: string, t: number, W: number, perDecade = 60): DoseResult {
  let totDose = 0;
  let totDoseEq = 0;
  let totFlux = 0;
  const raw = GCR_SPECIES.map((sp) => {
    const integ = integrateSpecies(sp.Z, sp.A, shieldKey, t, W, perDecade);
    totDose += integ.dose;
    totDoseEq += integ.doseEq;
    totFlux += integ.flux;
    return { sp, integ };
  });
  const totDoseEq_mSv = totDoseEq * MEV_PER_G_TO_GY * SECONDS_PER_DAY * 1000;
  const per: SpeciesDose[] = raw.map(({ sp, integ }) => {
    const h = integ.doseEq * MEV_PER_G_TO_GY * SECONDS_PER_DAY * 1000;
    return {
      Z: sp.Z,
      symbol: sp.symbol,
      flux: integ.flux,
      dose_mGy_day: integ.dose * MEV_PER_G_TO_GY * SECONDS_PER_DAY * 1000,
      doseEq_mSv_day: h,
      doseEqFraction: totDoseEq_mSv > 0 ? h / totDoseEq_mSv : 0,
    };
  });
  return {
    W,
    absorbedDose_mGy_day: totDose * MEV_PER_G_TO_GY * SECONDS_PER_DAY * 1000,
    doseEquivalent_mSv_day: totDoseEq_mSv,
    meanQ: totDose > 0 ? totDoseEq / totDose : 0,
    integralFlux: totFlux,
    perSpecies: per,
  };
}
