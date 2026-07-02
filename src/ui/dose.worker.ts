/**
 * Dose compute worker — runs the (heavy) species×energy integrations off the UI thread.
 * Computes dose-equivalent vs shield thickness for Al/poly/water, and the live validation suite.
 */
import { computeShieldedDose } from '../dose/shieldedDose.js';
import { computeFragmentedDose } from '../dose/fragmentedDose.js';
import { computeValidationSummary } from '../validation/validationSummary.js';
import { computeMultiLayerDose, computeMultiLayerFragmentedDose, type ShieldLayer } from '../dose/multiLayerDose.js';
import { W_SOLAR_MIN, W_SOLAR_MAX } from '../../data/gcr/matthia2013.js';

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

// The validation panel is fed by computeValidationSummary() — the SAME single source
// `npm run report` (generateReport.ts) uses. Nothing is computed inline, nothing hardcoded.

// Cast away the Window-typed global so we don't need the WebWorker lib (which conflicts with DOM).
const ctx = self as unknown as {
  postMessage(message: unknown): void;
  onmessage: ((e: MessageEvent) => void) | null;
};

ctx.onmessage = (e: MessageEvent) => {
  const msg = e.data as { type: string; solar?: string; mode?: string; layers?: ShieldLayer[] };
  if (msg.type === 'curves') {
    const solar = msg.solar ?? 'min';
    const mode = msg.mode ?? 'primaries';
    const series = computeCurves(solar, mode);
    const thicknesses = series.aluminum!.map((p) => p.t);
    ctx.postMessage({ type: 'curves', solar, mode, thicknesses, series });
  } else if (msg.type === 'multiLayer') {
    // current two-layer stack dose (Feature 1) — same CSDA engine, off the UI thread.
    const W = wFor(msg.solar ?? 'min');
    const fn = (msg.mode ?? 'primaries') === 'fragmentation' ? computeMultiLayerFragmentedDose : computeMultiLayerDose;
    const r = fn(msg.layers ?? [], W, CURVE_PERDECADE);
    ctx.postMessage({ type: 'multiLayer', H: r.doseEquivalent_mSv_day, D: r.absorbedDose_mGy_day, Q: r.meanQ });
  } else if (msg.type === 'validate') {
    ctx.postMessage({ type: 'validate', data: computeValidationSummary() });
  }
};
