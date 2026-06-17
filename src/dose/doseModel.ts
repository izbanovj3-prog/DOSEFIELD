/**
 * Free-space GCR dose & dose-equivalent in a thin tissue (water) target — Phase 2.
 *
 * Pipeline (all first-principles, labeled approximations):
 *   GCR differential flux J_Z(E)           [Matthiä 2013]    /(cm²·s·sr·(MeV/n))
 *   → omnidirectional fluence rate Φ = 4π·J  (isotropic field)
 *   → energy deposited per unit mass:  ∫ Φ_Z(E)·S_water(Z,E) dE   [MeV/(g·s)]
 *   → absorbed dose D  (× MeV/g → Gy)
 *   → LET = S_water·ρ·0.1 [keV/µm] → ICRP-60 Q(LET) → dose-equivalent H = ∫ Φ·S·Q dE
 *
 * APPROXIMATIONS: primaries only (no nuclear fragmentation / secondaries — Phase 5),
 * thin target (no self-shielding), CSDA/Bethe stopping, z_eff² heavy-ion scaling.
 *
 * Integration: composite Simpson in log-energy from E_LO to E_HI MeV/n, per species.
 */

import { WATER } from '../physics/materials.js';
import { ionStopping } from '../physics/ionStopping.js';
import { qualityFactorICRP60, letFromMassStopping } from '../physics/qualityFactor.js';
import { GCR_SPECIES, differentialFluxMatthia } from '../../data/gcr/matthia2013.js';

/** MeV/g → Gray (J/kg):  1 MeV = 1.602176634e-13 J, 1/g = 1000/kg. */
const MEV_PER_G_TO_GY = 1.602176634e-10;
const SECONDS_PER_DAY = 86400;
const FOUR_PI = 4 * Math.PI;

/** Lower / upper bounds of the energy-per-nucleon integration (MeV/n). */
export const E_LO_MEV = 10; // model validity floor
export const E_HI_MEV = 1e5; // 100 GeV/n; flux above contributes < 0.1% to dose

export interface SpeciesDose {
  Z: number;
  symbol: string;
  /** omnidirectional integral flux > E_LO, /(cm²·s) */
  flux: number;
  /** absorbed dose rate, mGy/day */
  dose_mGy_day: number;
  /** dose-equivalent rate, mSv/day */
  doseEq_mSv_day: number;
  /** fraction of total dose-equivalent */
  doseEqFraction: number;
}

export interface DoseResult {
  W: number;
  absorbedDose_mGy_day: number;
  doseEquivalent_mSv_day: number;
  /** mean quality factor = H / D */
  meanQ: number;
  /** omnidirectional integral flux (all species, > E_LO), /(cm²·s) */
  integralFlux: number;
  perSpecies: SpeciesDose[];
}

interface SpeciesIntegral {
  flux: number; // /(cm²·s)
  dose: number; // MeV/(g·s)
  doseEq: number; // MeV/(g·s), Q-weighted
}

/** Integrate one species over log-energy with composite Simpson. */
function integrateSpecies(Z: number, A: number, W: number, perDecade: number): SpeciesIntegral {
  const uLo = Math.log(E_LO_MEV);
  const uHi = Math.log(E_HI_MEV);
  const decades = (uHi - uLo) / Math.LN10;
  let n = Math.max(2, Math.ceil(perDecade * decades));
  if (n % 2 === 1) n += 1;
  const h = (uHi - uLo) / n;

  // integrand contributions at energy-per-nucleon E (in log space: multiply by E since dE = E du)
  const terms = (E: number): SpeciesIntegral => {
    const J = differentialFluxMatthia(Z, E, W); // /(cm²·s·sr·(MeV/n))
    const phi = FOUR_PI * J; // omnidirectional /(cm²·s·(MeV/n))
    const { massStopping } = ionStopping(E, Z, A, WATER); // MeV·cm²/g
    const LET = letFromMassStopping(massStopping, WATER.density); // keV/µm
    const Q = qualityFactorICRP60(LET);
    return { flux: phi * E, dose: phi * massStopping * E, doseEq: phi * massStopping * Q * E };
  };

  const acc: SpeciesIntegral = { flux: 0, dose: 0, doseEq: 0 };
  for (let i = 0; i <= n; i++) {
    const w = i === 0 || i === n ? 1 : i % 2 === 1 ? 4 : 2;
    const t = terms(Math.exp(uLo + i * h));
    acc.flux += w * t.flux;
    acc.dose += w * t.dose;
    acc.doseEq += w * t.doseEq;
  }
  const k = h / 3;
  return { flux: acc.flux * k, dose: acc.dose * k, doseEq: acc.doseEq * k };
}

/**
 * Compute free-space GCR dose & dose-equivalent in a thin water target at modulation W.
 */
export function computeFreeSpaceDose(W: number, perDecade = 120): DoseResult {
  const per: SpeciesDose[] = [];
  let totDose = 0;
  let totDoseEq = 0;
  let totFlux = 0;

  const raw = GCR_SPECIES.map((sp) => {
    const integ = integrateSpecies(sp.Z, sp.A, W, perDecade);
    totDose += integ.dose;
    totDoseEq += integ.doseEq;
    totFlux += integ.flux;
    return { sp, integ };
  });

  for (const { sp, integ } of raw) {
    per.push({
      Z: sp.Z,
      symbol: sp.symbol,
      flux: integ.flux,
      dose_mGy_day: integ.dose * MEV_PER_G_TO_GY * SECONDS_PER_DAY * 1000,
      doseEq_mSv_day: integ.doseEq * MEV_PER_G_TO_GY * SECONDS_PER_DAY * 1000,
      doseEqFraction: 0, // filled below
    });
  }
  const totDoseEq_mSv = totDoseEq * MEV_PER_G_TO_GY * SECONDS_PER_DAY * 1000;
  for (const p of per) p.doseEqFraction = totDoseEq_mSv > 0 ? p.doseEq_mSv_day / totDoseEq_mSv : 0;

  return {
    W,
    absorbedDose_mGy_day: totDose * MEV_PER_G_TO_GY * SECONDS_PER_DAY * 1000,
    doseEquivalent_mSv_day: totDoseEq_mSv,
    meanQ: totDose > 0 ? totDoseEq / totDose : 0,
    integralFlux: totFlux,
    perSpecies: per,
  };
}
