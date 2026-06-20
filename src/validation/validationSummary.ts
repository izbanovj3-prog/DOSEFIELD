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

export interface ShieldingTrendSummary {
  ok: boolean;
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
  let maxPolyBenefitPct = 0;
  for (const t of [10, 20, 30]) {
    const al = computeShieldedDose('aluminum', t, W_SOLAR_MIN).doseEquivalent_mSv_day;
    const poly = computeShieldedDose('polyethylene', t, W_SOLAR_MIN).doseEquivalent_mSv_day;
    if (!(poly < al)) ok = false;
    maxPolyBenefitPct = Math.max(maxPolyBenefitPct, (1 - poly / al) * 100);
  }
  return { ok, maxPolyBenefitPct };
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
