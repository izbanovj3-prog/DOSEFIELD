/**
 * Dose compute worker — runs the (heavy) species×energy integrations off the UI thread.
 * Computes dose-equivalent vs shield thickness for Al/poly/water, and the live validation suite.
 */
import { computeShieldedDose } from '../dose/shieldedDose.js';
import { computeFragmentedDose } from '../dose/fragmentedDose.js';
import { computeRadComparison } from '../dose/radComparison.js';
import type { RadComparison } from '../dose/radComparison.js';
import { electronicMassStoppingPower } from '../physics/stoppingPower.js';
import { MATERIALS } from '../physics/materials.js';
import { PSTAR_DATASETS } from '../../data/pstar/index.js';
import { RAD_CRUISE } from '../../data/rad/zeitlin2013.js';
import { W_SOLAR_MIN, W_SOLAR_MAX, W_CRUISE_2012 } from '../../data/gcr/matthia2013.js';

const MATERIAL_KEYS = ['aluminum', 'polyethylene', 'water', 'hydrogen', 'methane'] as const;
const T_MAX = 40;
const T_STEP = 1;
const CURVE_PERDECADE = 50;

export interface CurvePoint {
  t: number;
  H: number; // dose-equivalent mSv/day
  D: number; // absorbed dose mGy/day
  Q: number; // mean quality factor
}
export type CurveSeries = Record<string, CurvePoint[]>;

function wFor(solar: string): number {
  return solar === 'max' ? W_SOLAR_MAX : W_SOLAR_MIN;
}

function computeCurves(solar: string, mode: string): CurveSeries {
  const W = wFor(solar);
  // mode 'fragmentation' wires in the EXISTING Bradt–Peters fragmentation physics;
  // 'primaries' is the primary-only transport. No new physics, no fudge.
  const dose = mode === 'fragmentation' ? computeFragmentedDose : computeShieldedDose;
  const series: CurveSeries = {};
  for (const m of MATERIAL_KEYS) {
    const pts: CurvePoint[] = [];
    for (let t = 0; t <= T_MAX + 1e-9; t += T_STEP) {
      const r = dose(m, t, W, CURVE_PERDECADE);
      pts.push({ t, H: r.doseEquivalent_mSv_day, D: r.absorbedDose_mGy_day, Q: r.meanQ });
    }
    series[m] = pts;
  }
  return series;
}

export interface ValidationData {
  /** NIST PSTAR max % error in the ≥10 MeV Bethe-valid region (the headline 1.55%) */
  nistMaxSolid: number;
  /** NIST PSTAR max % error over all energies (1–1000 MeV) */
  nistMaxAll: number;
  trendOk: boolean;
  trendWorst: number;
  /** MSL/RAD comparison — the SAME function `npm run report` uses */
  rad: RadComparison;
  radSigma: { D: number; H: number; Q: number };
  cruiseW: number;
  cruiseShield: number;
  phiLo: number;
  phiHi: number;
}

// Every number below comes from the same code paths as `npm run report` (generateReport.ts),
// so the in-UI validation matches the generated report exactly. Nothing is hardcoded.
function runValidation(): ValidationData {
  // 1. NIST PSTAR — max % error, all energies and the ≥10 MeV region (Bethe valid).
  let nistMaxAll = 0;
  let nistMaxSolid = 0;
  for (const key of Object.keys(PSTAR_DATASETS) as (keyof typeof PSTAR_DATASETS)[]) {
    const ds = PSTAR_DATASETS[key];
    const mat = MATERIALS[key]!;
    for (const p of ds.points) {
      const e = Math.abs((electronicMassStoppingPower(p.T_MeV, mat) - p.electronic) / p.electronic) * 100;
      nistMaxAll = Math.max(nistMaxAll, e);
      if (p.T_MeV >= 10) nistMaxSolid = Math.max(nistMaxSolid, e);
    }
  }

  // 2. Shielding trend: polyethylene < aluminium at equal areal density.
  let trendOk = true;
  let trendWorst = 0;
  for (const t of [10, 20, 30]) {
    const al = computeShieldedDose('aluminum', t, W_SOLAR_MIN).doseEquivalent_mSv_day;
    const poly = computeShieldedDose('polyethylene', t, W_SOLAR_MIN).doseEquivalent_mSv_day;
    if (!(poly < al)) trendOk = false;
    trendWorst = Math.max(trendWorst, (1 - poly / al) * 100);
  }

  // 3. MSL/RAD cruise comparison (model vs measured, with ratios).
  const rad = computeRadComparison();

  return {
    nistMaxSolid,
    nistMaxAll,
    trendOk,
    trendWorst,
    rad,
    radSigma: { D: RAD_CRUISE.doseRate_sigma, H: RAD_CRUISE.doseEquivalent_sigma, Q: RAD_CRUISE.meanQ_sigma },
    cruiseW: W_CRUISE_2012,
    cruiseShield: RAD_CRUISE.shielding_gcm2,
    phiLo: RAD_CRUISE.phi_MV_low,
    phiHi: RAD_CRUISE.phi_MV_high,
  };
}

// Cast away the Window-typed global so we don't need the WebWorker lib (which conflicts with DOM).
const ctx = self as unknown as {
  postMessage(message: unknown): void;
  onmessage: ((e: MessageEvent) => void) | null;
};

ctx.onmessage = (e: MessageEvent) => {
  const msg = e.data as { type: string; solar?: string; mode?: string };
  if (msg.type === 'curves') {
    const solar = msg.solar ?? 'min';
    const mode = msg.mode ?? 'primaries';
    const series = computeCurves(solar, mode);
    const thicknesses = series.aluminum!.map((p) => p.t);
    ctx.postMessage({ type: 'curves', solar, mode, thicknesses, series });
  } else if (msg.type === 'validate') {
    ctx.postMessage({ type: 'validate', data: runValidation() });
  }
};
