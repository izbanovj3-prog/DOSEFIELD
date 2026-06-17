/**
 * Dose compute worker — runs the (heavy) species×energy integrations off the UI thread.
 * Computes dose-equivalent vs shield thickness for Al/poly/water, and the live validation suite.
 */
import { computeShieldedDose } from '../dose/shieldedDose.js';
import { electronicMassStoppingPower } from '../physics/stoppingPower.js';
import { MATERIALS } from '../physics/materials.js';
import { PSTAR_DATASETS } from '../../data/pstar/index.js';
import { W_SOLAR_MIN, W_SOLAR_MAX } from '../../data/gcr/matthia2013.js';

const MATERIAL_KEYS = ['aluminum', 'polyethylene', 'water'] as const;
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

function computeCurves(solar: string): CurveSeries {
  const W = wFor(solar);
  const series: CurveSeries = {};
  for (const m of MATERIAL_KEYS) {
    const pts: CurvePoint[] = [];
    for (let t = 0; t <= T_MAX + 1e-9; t += T_STEP) {
      const r = computeShieldedDose(m, t, W, CURVE_PERDECADE);
      pts.push({ t, H: r.doseEquivalent_mSv_day, D: r.absorbedDose_mGy_day, Q: r.meanQ });
    }
    series[m] = pts;
  }
  return series;
}

interface ValRow {
  status: 'pass' | 'fail' | 'pending';
  label: string;
  detail: string;
}

function runValidation(): ValRow[] {
  const rows: ValRow[] = [];

  // 1. NIST PSTAR stopping power (max % error over all embedded points)
  let maxErr = 0;
  for (const key of Object.keys(PSTAR_DATASETS) as (keyof typeof PSTAR_DATASETS)[]) {
    const ds = PSTAR_DATASETS[key];
    const mat = MATERIALS[key]!;
    for (const p of ds.points) {
      const model = electronicMassStoppingPower(p.T_MeV, mat);
      maxErr = Math.max(maxErr, Math.abs((model - p.electronic) / p.electronic) * 100);
    }
  }
  rows.push({
    status: maxErr <= 5 ? 'pass' : 'fail',
    label: 'Stopping power vs NIST PSTAR (Al / water / poly, protons)',
    detail: `max err ${maxErr.toFixed(2)}%`,
  });

  // 2. Shielding trend: polyethylene < aluminium at equal areal density
  const W = W_SOLAR_MIN;
  let trendOk = true;
  let worst = 0;
  for (const t of [10, 20, 30]) {
    const al = computeShieldedDose('aluminum', t, W, CURVE_PERDECADE).doseEquivalent_mSv_day;
    const poly = computeShieldedDose('polyethylene', t, W, CURVE_PERDECADE).doseEquivalent_mSv_day;
    if (!(poly < al)) trendOk = false;
    worst = Math.max(worst, (1 - poly / al) * 100);
  }
  rows.push({
    status: trendOk ? 'pass' : 'fail',
    label: 'Shielding trend: polyethylene < aluminium (equal g/cm²)',
    detail: `poly better by up to ${worst.toFixed(1)}%`,
  });

  // 3. RAD cruise dose — Phase 4
  rows.push({
    status: 'pending',
    label: 'MSL/RAD cruise dose comparison',
    detail: 'Phase 4',
  });

  return rows;
}

// Cast away the Window-typed global so we don't need the WebWorker lib (which conflicts with DOM).
const ctx = self as unknown as {
  postMessage(message: unknown): void;
  onmessage: ((e: MessageEvent) => void) | null;
};

ctx.onmessage = (e: MessageEvent) => {
  const msg = e.data as { type: string; solar?: string };
  if (msg.type === 'curves') {
    const solar = msg.solar ?? 'min';
    const series = computeCurves(solar);
    const thicknesses = series.aluminum!.map((p) => p.t);
    ctx.postMessage({ type: 'curves', solar, thicknesses, series });
  } else if (msg.type === 'validate') {
    ctx.postMessage({ type: 'validate', rows: runValidation() });
  }
};
