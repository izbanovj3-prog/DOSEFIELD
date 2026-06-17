/**
 * Phase-4 validation: model vs measured MSL/RAD cruise dose-equivalent.
 *
 * We run the (primary-only) shielded-dose model at the cruise solar modulation and the
 * representative Al-equivalent shielding, set INDEPENDENTLY of the RAD measurement, and report
 * the model value, the measured value, and the ratio. The dominant expected discrepancy is the
 * absence of nuclear fragmentation / secondary production (Phase 5), which in reality lowers
 * ⟨Q⟩ (breaking HZE ions into lighter fragments + adding low-Q protons/neutrons).
 */

import { computeShieldedDose } from './shieldedDose.js';
import { W_CRUISE_2012, W_CRUISE_LOW, W_CRUISE_HIGH } from '../../data/gcr/matthia2013.js';
import { RAD_CRUISE } from '../../data/rad/zeitlin2013.js';

export interface RadComparison {
  measured: { D: number; H: number; Q: number };
  model: { D: number; H: number; Q: number; W: number; shielding: number };
  /** model dose-equivalent range over the W/shielding brackets (mSv/day) */
  H_lo: number;
  H_hi: number;
  D_lo: number;
  D_hi: number;
  ratioH: number;
  ratioD: number;
  ratioQ: number;
}

export function computeRadComparison(): RadComparison {
  // central case: representative shielding & cruise modulation
  const central = computeShieldedDose('aluminum', RAD_CRUISE.shielding_gcm2, W_CRUISE_2012);

  // bracket over modulation × shielding (independent of the measurement)
  let H_lo = Infinity;
  let H_hi = -Infinity;
  let D_lo = Infinity;
  let D_hi = -Infinity;
  for (const W of [W_CRUISE_LOW, W_CRUISE_2012, W_CRUISE_HIGH]) {
    for (const t of [RAD_CRUISE.shielding_low, RAD_CRUISE.shielding_gcm2, RAD_CRUISE.shielding_high]) {
      const r = computeShieldedDose('aluminum', t, W);
      H_lo = Math.min(H_lo, r.doseEquivalent_mSv_day);
      H_hi = Math.max(H_hi, r.doseEquivalent_mSv_day);
      D_lo = Math.min(D_lo, r.absorbedDose_mGy_day);
      D_hi = Math.max(D_hi, r.absorbedDose_mGy_day);
    }
  }

  return {
    measured: { D: RAD_CRUISE.doseRate_mGy_day, H: RAD_CRUISE.doseEquivalent_mSv_day, Q: RAD_CRUISE.meanQ },
    model: {
      D: central.absorbedDose_mGy_day,
      H: central.doseEquivalent_mSv_day,
      Q: central.meanQ,
      W: W_CRUISE_2012,
      shielding: RAD_CRUISE.shielding_gcm2,
    },
    H_lo,
    H_hi,
    D_lo,
    D_hi,
    ratioH: central.doseEquivalent_mSv_day / RAD_CRUISE.doseEquivalent_mSv_day,
    ratioD: central.absorbedDose_mGy_day / RAD_CRUISE.doseRate_mGy_day,
    ratioQ: central.meanQ / RAD_CRUISE.meanQ,
  };
}
