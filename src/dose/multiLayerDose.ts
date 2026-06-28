/**
 * Multi-layer shielded dose (Feature 1, v2.0) — sequential CSDA transport through a stack.
 *
 * A GCR ion crosses the layers OUTERMOST→INNERMOST: it loses energy in layer 0, enters layer 1
 * with the residual energy, and so on, before depositing in the thin water target. Integration is
 * in residual-energy (E_out) space exactly as the single-slab `shieldedDose`, but the incident
 * energy E_in and the Jacobian dE_in/dE_out are chained layer-by-layer in ONE innermost→outermost
 * pass (this is the part the earlier parked version got wrong for heterogeneous stacks).
 *
 * Reduces EXACTLY to computeShieldedDose / computeFragmentedDose for a single-layer stack, so
 * the single-layer path stays the validated one.
 *
 * VALIDATION NOTE (honest): the single slab is validated vs NIST PSTAR + NASA MSL/RAD. The layered
 * extension uses the same CSDA engine and reduces to that validated single layer, but there is NO
 * NASA layered measurement to check it against — so a multi-layer result is UNVALIDATED beyond the
 * single-layer limit. Labeled, not hidden.
 *
 * APPROXIMATIONS (labeled): straight-ahead CSDA, sharp interfaces (no interface scattering), no
 * range straggling; fragmentation = the same single-collision Bradt–Peters model as Phase 5, with
 * survival ∏ᵢ exp(−tᵢ/λᵢ) across the stack (no multi-generation cascade, no neutrons/target frags).
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
import { computeFreeSpaceDose, type DoseResult, type SpeciesDose } from './doseModel.js';

const MEV_PER_G_TO_GY = 1.602176634e-10;
const SECONDS_PER_DAY = 86400;
const FOUR_PI = 4 * Math.PI;
const E_HI_MEV = 1e5;
const SPECTRUM_FLOOR = 10;

/** One slab in the stack. `layers[0]` is the OUTERMOST (first met by the GCR). */
export interface ShieldLayer {
  /** material key present in MATERIALS */
  material: string;
  /** areal density, g/cm² */
  thickness: number;
}

interface Acc {
  flux: number;
  dose: number;
  doseEq: number;
}

/** dose & Q for a charge z_eff at this velocity, given the single-charge stopping unit. */
function letDoseQ(zEff: number, S_unit: number): { S: number; Q: number } {
  const S = zEff * zEff * S_unit;
  return { S, Q: qualityFactorICRP60(letFromMassStopping(S, WATER.density)) };
}

function integrateSpecies(
  Z_p: number,
  A_p: number,
  active: ShieldLayer[],
  W: number,
  perDecade: number,
  fragment: boolean,
): Acc {
  const tables = active.map((l) => getRangeTable(Z_p, A_p, MATERIALS[l.material]!));
  // Survival across the whole stack. Bradt–Peters σ is energy-independent → pSurv is constant in E_out.
  const pSurv = fragment
    ? active.reduce((p, l) => p * Math.exp(-l.thickness / interactionMFP(A_p, MATERIALS[l.material]!)), 1)
    : 1;
  const frags = fragment && pSurv < 1 ? fragmentYield(Z_p, A_p) : [];

  const uLo = Math.log(1); // E_OUT_LO = 1 MeV/n
  const uHi = Math.log(E_HI_MEV);
  let n = Math.max(2, Math.ceil((perDecade * (uHi - uLo)) / Math.LN10));
  if (n % 2 === 1) n += 1;
  const h = (uHi - uLo) / n;

  const terms = (E_out: number): Acc => {
    // Chain back innermost→outermost: residual energy at the tissue → incident energy, accumulating
    // the Jacobian dE_in/dE_out = ∏ S_i(E_enter)/S_i(E_exit) in the SAME (correct) order.
    let E = E_out;
    let jac = 1;
    for (let i = active.length - 1; i >= 0; i--) {
      const mat = MATERIALS[active[i]!.material]!;
      const tbl = tables[i]!;
      const E_exit = E;
      const E_enter = tbl.energyAtRange(tbl.rangeAtEnergy(E) + active[i]!.thickness);
      jac *= ionStopping(E_enter, Z_p, A_p, mat).massStopping / ionStopping(E_exit, Z_p, A_p, mat).massStopping;
      E = E_enter;
    }
    const E_in = E;
    if (E_in < SPECTRUM_FLOOR || E_in > E_HI_MEV) return { flux: 0, dose: 0, doseEq: 0 };
    const phi = FOUR_PI * differentialFluxMatthia(Z_p, E_in, W);

    // tissue deposit at the residual velocity (single-charge stopping unit, shared across fragments)
    const beta = Math.sqrt(kinematics(E_out, M_U_C2).beta2);
    const S_unit = electronicMassStoppingPower(E_out, WATER, 1, M_U_C2);

    const p = letDoseQ(effectiveCharge(Z_p, beta), S_unit);
    let flux = pSurv;
    let dose = pSurv * p.S;
    let doseEq = pSurv * p.S * p.Q;

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

    const base = phi * jac * E_out; // ×E_out for log-space Simpson
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

function aggregate(layers: ShieldLayer[], W: number, perDecade: number, fragment: boolean): DoseResult {
  const active = layers.filter((l) => l.thickness > 0);
  if (active.length === 0) return computeFreeSpaceDose(W); // empty stack → free space

  let totDose = 0;
  let totDoseEq = 0;
  let totFlux = 0;
  const raw = GCR_SPECIES.map((sp) => {
    const integ = integrateSpecies(sp.Z, sp.A, active, W, perDecade, fragment);
    totDose += integ.dose;
    totDoseEq += integ.doseEq;
    totFlux += integ.flux;
    return { sp, integ };
  });

  const totDoseEq_mSv = totDoseEq * MEV_PER_G_TO_GY * SECONDS_PER_DAY * 1000;
  const per: SpeciesDose[] = raw.map(({ sp, integ }) => {
    const hH = integ.doseEq * MEV_PER_G_TO_GY * SECONDS_PER_DAY * 1000;
    return {
      Z: sp.Z,
      symbol: sp.symbol,
      flux: integ.flux,
      dose_mGy_day: integ.dose * MEV_PER_G_TO_GY * SECONDS_PER_DAY * 1000,
      doseEq_mSv_day: hH,
      doseEqFraction: totDoseEq_mSv > 0 ? hH / totDoseEq_mSv : 0,
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

/** Primaries-only dose behind a stack of layers (outermost first). Single layer ≡ computeShieldedDose. */
export function computeMultiLayerDose(layers: ShieldLayer[], W: number, perDecade = 100): DoseResult {
  return aggregate(layers, W, perDecade, false);
}

/** Same with simplified Bradt–Peters fragmentation. Single layer ≡ computeFragmentedDose. */
export function computeMultiLayerFragmentedDose(layers: ShieldLayer[], W: number, perDecade = 60): DoseResult {
  return aggregate(layers, W, perDecade, true);
}
