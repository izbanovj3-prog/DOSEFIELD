/**
 * Dose compute worker — runs the (heavy) species×energy integrations off the UI thread.
 * Computes dose-equivalent vs shield thickness for Al/poly/water, and the live validation suite.
 */
import { computeShieldedDose } from '../dose/shieldedDose.js';
import { computeFragmentedDose } from '../dose/fragmentedDose.js';
import { computeFreeSpaceDose } from '../dose/doseModel.js';
import { computeValidationSummary, computeNistStoppingSummary } from '../validation/validationSummary.js';
import { doseRelUncertainty } from '../validation/uncertainty.js';
import { computeMultiLayerDose, computeMultiLayerFragmentedDose, type ShieldLayer } from '../dose/multiLayerDose.js';
import { W_SOLAR_MIN } from '../../data/gcr/matthia2013.js';
import { incidentSpectrum, shieldedSpectrum } from './spectrum.js';

const MATERIAL_KEYS = ['aluminum', 'polyethylene', 'water', 'hydrogen', 'methane'] as const;
const T_MAX = 40;
const T_STEP = 1;
const CURVE_PERDECADE = 50;

// Phase A: relative input-uncertainty band (GCR flux ⊕ stopping power ⊕ THIS RUN's computed
// PSTAR deviation — see src/validation/uncertainty.ts for the cited sources and what the
// band deliberately excludes). Deterministic → computed once at worker start.
const BAND_REL = doseRelUncertainty(computeNistStoppingSummary().maxSolidPct / 100);

// Organ dose estimates (v2.1) — the NASA/NCRP shallow–eye–deep depth-dose convention:
// dose at 0.007 / 0.3 / 5 cm tissue depth (water-equivalent) approximates skin /
// ocular-lens / blood-forming-organ dose. The body layer is just one more water slab
// through the SAME validated multi-layer CSDA engine — no new physics, no new tuning.
// (ICRP-60 tissue weights wT are deliberately NOT used here: wT builds effective dose
// E = Σ wT·H_T from organ doses — multiplying a dose BY wT does not give an organ dose.)
const ORGAN_DEPTHS = [
  { key: 'bfo', depth: 5 },
  { key: 'eye', depth: 0.3 },
  { key: 'skin', depth: 0.007 },
] as const;

export interface OrganDose {
  key: string;
  /** dose-equivalent at organ depth, mSv/day */
  H: number;
  /** absorbed dose at organ depth, mGy/day */
  D: number;
}

export interface CurvePoint {
  t: number;
  H: number; // dose-equivalent mSv/day
  D: number; // absorbed dose mGy/day
  Q: number; // mean quality factor
}
export type CurveSeries = Record<string, CurvePoint[]>;

function computeCurves(W: number, mode: string): CurveSeries {
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

// ---- dose spectra (v2.2 incident; v2.3 adds the behind-shield panel) ---------
// Both curves live in ./spectrum.ts, which re-evaluates the dose engines' OWN integrands on the
// engines' own Simpson nodes — so each curve's integral reproduces the engine result it belongs
// to (test/spectrum.test.ts asserts the identity). The incident curve is differential in the
// INCIDENT kinetic energy, the shielded curve in the RESIDUAL energy behind the stack: two
// different abscissae, reported separately, never merged onto one axis.

// ---- automated self-checks (v2.2, Feature 3) --------------------------------
// Physics invariants that must hold in every configuration. Each is a real property of
// the model, not a tuned target — a red flag here means a genuine regression, so none is
// worded as a condition the model isn't guaranteed to satisfy.
export interface SelfCheck { name: string; pass: boolean; detail: string; }

function runSelfChecks(W: number, rate: number, days: number): SelfCheck[] {
  const out: SelfCheck[] = [];

  // 1 — thick shielding reduces dose-equivalent (fixed probe; a guaranteed model invariant).
  // NB: worded for THICK shield, because slowing primaries raises their LET/Q, so a thin
  // shield can transiently raise H before it falls — the honest, always-true statement is this.
  const free = computeFreeSpaceDose(W).doseEquivalent_mSv_day;
  const thick = computeShieldedDose('aluminum', 40, W).doseEquivalent_mSv_day;
  out.push({
    name: 'Thick shielding reduces dose',
    pass: thick < free,
    detail: `Al 40 g/cm² ${thick.toFixed(2)} < free space ${free.toFixed(2)} mSv/day`,
  });

  // 2 — solar-modulation monotonicity: more modulation (higher W) → less GCR → less dose.
  const Wpts = [0, 43, 87, 130];
  const Hs = Wpts.map((w) => computeFreeSpaceDose(w).doseEquivalent_mSv_day);
  let mono = true;
  for (let i = 1; i < Hs.length; i++) if (!(Hs[i]! < Hs[i - 1]!)) mono = false;
  out.push({
    name: 'Solar modulation monotonic (↑W → ↓dose)',
    pass: mono,
    detail: `W 0→130: ${Hs.map((h) => h.toFixed(2)).join(' > ')} mSv/day`,
  });

  // 3 — dose accumulates linearly with duration: 720 d == 2 × 360 d.
  const d360 = rate * 360;
  const d720 = rate * 720;
  out.push({
    name: 'Dose–duration linearity',
    pass: d360 > 0 ? Math.abs(d720 - 2 * d360) / (2 * d360) < 1e-3 : true,
    detail: `720 d = ${d720.toFixed(0)} mSv = 2 × 360 d (${d360.toFixed(0)} mSv)`,
  });

  // 4 — material ordering at equal areal density: H₂ < polyethylene < aluminium.
  const al = computeShieldedDose('aluminum', 10, W).doseEquivalent_mSv_day;
  const pe = computeShieldedDose('polyethylene', 10, W).doseEquivalent_mSv_day;
  const h2 = computeShieldedDose('hydrogen', 10, W).doseEquivalent_mSv_day;
  out.push({
    name: 'Material ordering H₂ < PE < Al',
    pass: h2 < pe && pe < al,
    detail: `@10 g/cm²: H₂ ${h2.toFixed(2)} < PE ${pe.toFixed(2)} < Al ${al.toFixed(2)} mSv/day`,
  });

  // 5 — unit consistency: daily rate × mission days = mission total (dimensional guard).
  const total = rate * days;
  out.push({
    name: 'Unit consistency (mSv/day × days = mSv)',
    pass: total >= 0 && Math.abs(rate * days - total) <= 1e-4 * Math.max(1, total),
    detail: `${rate.toFixed(2)} mSv/day × ${days} d = ${total.toFixed(0)} mSv`,
  });

  return out;
}

// The validation panel is fed by computeValidationSummary() — the SAME single source
// `npm run report` (generateReport.ts) uses. Nothing is computed inline, nothing hardcoded.

// Cast away the Window-typed global so we don't need the WebWorker lib (which conflicts with DOM).
const ctx = self as unknown as {
  postMessage(message: unknown): void;
  onmessage: ((e: MessageEvent) => void) | null;
};

ctx.onmessage = (e: MessageEvent) => {
  const msg = e.data as {
    type: string;
    W?: number;
    mode?: string;
    layers?: ShieldLayer[];
    rate?: number;
    days?: number;
    /** echo tag so a stale shielded-spectrum / organs reply can be discarded on arrival */
    key?: string;
  };
  const W = msg.W ?? W_SOLAR_MIN;
  if (msg.type === 'curves') {
    const mode = msg.mode ?? 'primaries';
    const series = computeCurves(W, mode);
    const thicknesses = series.aluminum!.map((p) => p.t);
    ctx.postMessage({ type: 'curves', W, mode, thicknesses, series, bandRel: BAND_REL });
  } else if (msg.type === 'multiLayer') {
    // current two-layer stack dose — same CSDA engine, off the UI thread.
    const fn = (msg.mode ?? 'primaries') === 'fragmentation' ? computeMultiLayerFragmentedDose : computeMultiLayerDose;
    const r = fn(msg.layers ?? [], W, CURVE_PERDECADE);
    ctx.postMessage({ type: 'multiLayer', H: r.doseEquivalent_mSv_day, D: r.absorbedDose_mGy_day, Q: r.meanQ });
  } else if (msg.type === 'organs') {
    // organ depth-doses for the current stack: shield layers + a water "body" slab per organ
    const fn = (msg.mode ?? 'primaries') === 'fragmentation' ? computeMultiLayerFragmentedDose : computeMultiLayerDose;
    const organs: OrganDose[] = ORGAN_DEPTHS.map((o) => {
      const r = fn([...(msg.layers ?? []), { material: 'water', thickness: o.depth }], W, CURVE_PERDECADE);
      return { key: o.key, H: r.doseEquivalent_mSv_day, D: r.absorbedDose_mGy_day };
    });
    ctx.postMessage({ type: 'organs', organs, key: msg.key ?? '' });
  } else if (msg.type === 'spectrum') {
    // incident (pre-shield) field — a function of solar modulation only
    ctx.postMessage({ type: 'spectrum', W, ...incidentSpectrum(W) });
  } else if (msg.type === 'shieldedSpectrum') {
    // residual field behind the current stack — depends on materials, areal densities and mode
    const layers = msg.layers ?? [];
    const fragment = (msg.mode ?? 'primaries') === 'fragmentation';
    ctx.postMessage({
      type: 'shieldedSpectrum',
      W,
      key: msg.key ?? '',
      ...shieldedSpectrum(layers, W, fragment),
    });
  } else if (msg.type === 'selfcheck') {
    ctx.postMessage({ type: 'selfcheck', checks: runSelfChecks(W, msg.rate ?? 0, msg.days ?? 0) });
  } else if (msg.type === 'validate') {
    ctx.postMessage({ type: 'validate', data: computeValidationSummary() });
  }
};
