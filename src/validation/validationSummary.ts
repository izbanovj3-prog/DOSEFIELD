import { computeShieldedDose } from '../dose/shieldedDose.js';
import { computeRadComparison, type RadComparison } from '../dose/radComparison.js';
import { electronicMassStoppingPower } from '../physics/stoppingPower.js';
import { MATERIALS } from '../physics/materials.js';
import { PSTAR_DATASETS } from '../../data/pstar/index.js';
import { RAD_CRUISE } from '../../data/rad/zeitlin2013.js';
import { W_SOLAR_MIN, W_CRUISE_2012 } from '../../data/gcr/matthia2013.js';

export const NIST_SOLID_REGION_MEV = 10;

export interface NistStoppingSummary {
  maxAllPct: number;
  maxSolidPct: number;
}

/** Shields ordered best→worst (lowest dose-equivalent first), i.e. by hydrogen content / <Z/A>. */
export const SHIELD_RANK = ['hydrogen', 'methane', 'polyethylene', 'water', 'aluminum'] as const;

export interface ShieldingTrendSummary {
  /** dose-equivalent is strictly increasing along SHIELD_RANK at every tested thickness */
  ok: boolean;
  /** best→worst shield order (hydrogen-richest first) */
  rank: readonly string[];
  /** max % the best shield (hydrogen) beats the worst (aluminium) at equal areal density */
  maxBestBenefitPct: number;
  /** max % polyethylene beats aluminium — retained from the original Phase-3 claim */
  maxPolyBenefitPct: number;
}

export interface ValidationSummary {
  nist: NistStoppingSummary;
  trend: ShieldingTrendSummary;
  rad: RadComparison;
  radSigma: { D: number; H: number; Q: number };
  cruiseW: number;
  cruiseShield: number;
  phiLo: number;
  phiHi: number;
}

export function computeNistStoppingSummary(): NistStoppingSummary {
  let maxAllPct = 0;
  let maxSolidPct = 0;
  for (const key of Object.keys(PSTAR_DATASETS) as (keyof typeof PSTAR_DATASETS)[]) {
    const mat = MATERIALS[key]!;
    for (const p of PSTAR_DATASETS[key].points) {
      const errPct = Math.abs((electronicMassStoppingPower(p.T_MeV, mat) - p.electronic) / p.electronic) * 100;
      maxAllPct = Math.max(maxAllPct, errPct);
      if (p.T_MeV >= NIST_SOLID_REGION_MEV) maxSolidPct = Math.max(maxSolidPct, errPct);
    }
  }
  return { maxAllPct, maxSolidPct };
}

export function computeShieldingTrendSummary(): ShieldingTrendSummary {
  let ok = true;
  let maxBestBenefitPct = 0;
  let maxPolyBenefitPct = 0;
  const polyI = SHIELD_RANK.indexOf('polyethylene');
  const alI = SHIELD_RANK.indexOf('aluminum');
  for (const t of [5, 10, 20, 30, 40]) {
    const H = SHIELD_RANK.map((m) => computeShieldedDose(m, t, W_SOLAR_MIN).doseEquivalent_mSv_day);
    // strictly increasing dose-equivalent along the rank = shielding ranks exactly by <Z/A>
    for (let i = 1; i < H.length; i++) if (!(H[i]! > H[i - 1]!)) ok = false;
    maxBestBenefitPct = Math.max(maxBestBenefitPct, (1 - H[0]! / H[H.length - 1]!) * 100);
    maxPolyBenefitPct = Math.max(maxPolyBenefitPct, (1 - H[polyI]! / H[alI]!) * 100);
  }
  return { ok, rank: SHIELD_RANK, maxBestBenefitPct, maxPolyBenefitPct };
}

export function computeValidationSummary(): ValidationSummary {
  return {
    nist: computeNistStoppingSummary(),
    trend: computeShieldingTrendSummary(),
    rad: computeRadComparison(),
    radSigma: { D: RAD_CRUISE.doseRate_sigma, H: RAD_CRUISE.doseEquivalent_sigma, Q: RAD_CRUISE.meanQ_sigma },
    cruiseW: W_CRUISE_2012,
    cruiseShield: RAD_CRUISE.shielding_gcm2,
    phiLo: RAD_CRUISE.phi_MV_low,
    phiHi: RAD_CRUISE.phi_MV_high,
  };
}
