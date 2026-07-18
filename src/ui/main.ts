/**
 * DOSEFIELD dosimeter UI. Controls → worker computes dose-vs-thickness curves (Al/poly/water);
 * the slider readout interpolates the active curve (instant), and the canvas plots all three.
 */
import './styles.css';
import { renderProvenance } from './provenance.js';
import { renderVersion } from './version.js';
import type { CurvePoint, CurveSeries, SpectrumData, SelfCheck } from './dose.worker.js';
import type { ValidationSummary } from '../validation/validationSummary.js';

const NASA_CAREER_LIMIT_MSV = 600; // NASA-STD-3001 career effective-dose limit

const TRACE = { aluminum: '#ffb000', polyethylene: '#46e06a', water: '#38bdf8', hydrogen: '#ff79c6', methane: '#a78bfa' } as const;
// spectrum chart per-ion colours (H, He, C, O, Fe)
const SPEC_COLORS: Record<string, string> = { H: '#4da3ff', He: '#46e06a', C: '#ffb000', O: '#38bdf8', Fe: '#ff5a5a' };
const SPEC_ION_KEYS = ['H', 'He', 'C', 'O', 'Fe'] as const;

interface Layer {
  material: keyof typeof TRACE;
  thickness: number;
}
// Matthiä-2013 solar-modulation parameter W is the model's own control: W=0 is the
// least-modulated / worst-case-GCR solar minimum, W=130 a strong solar maximum. It is
// continuous, so the slider spans it directly — the old MIN/MAX toggle was just its endpoints.
const W_MIN = 0;
const W_MAX = 130;

interface State {
  material: keyof typeof TRACE; // Layer 1 (structural) material
  thickness: number; // Layer 1 areal density (g/cm²)
  layer2: Layer; // Layer 2 (inner lining)
  singleLayer: boolean;
  W: number; // solar modulation (Matthiä 2013), 0 = solar min … 130 = solar max
  mode: 'primaries' | 'fragmentation';
  duration: number;
  preset: string; // active mission preset, or 'custom'
}
const state: State = {
  material: 'aluminum',
  thickness: 10,
  layer2: { material: 'polyethylene', thickness: 5 },
  singleLayer: true,
  W: 0,
  mode: 'primaries',
  duration: 360,
  preset: 'custom',
};
// last two-layer readout from the worker (used when singleLayer = false)
let ml = { H: 0, D: 0, Q: 0 };
let mlTimer: number | undefined;
let applyingPreset = false; // guards the auto-→Custom fallback while a preset sets fields
// last organ depth-doses from the worker (v2.1) — null until the first compute lands
let organs: Record<string, { H: number; D: number }> | null = null;
let organTimer: number | undefined;
// last validation summary — reused by the exported report so it only prints computed numbers
let lastVal: ValidationSummary | null = null;
// incident dose spectrum dH/dT (v2.2) — depends on W only (pre-shield); null until first compute
let spectrum: SpectrumData | null = null;
let showIons = false; // spectrum chart: overlay individual H/He/C/O/Fe lines
let specTimer: number | undefined;
// automated self-checks (v2.2)
let selfChecks: SelfCheck[] | null = null;
let checkTimer: number | undefined;
let curveTimer: number | undefined;

// Phase A: relative input-uncertainty band (from the worker; see src/validation/uncertainty.ts)
let bandRel = 0;

// cache of computed curves per (modulation W, nuclear mode)
const curveCache = new Map<string, CurveSeries>();
const curveKey = (): string => `${state.W}:${state.mode}`;
let curves: CurveSeries | null = null;
let heroSet = false; // hero subhead is computed once, from the default-config curve

const worker = new Worker(new URL('./dose.worker.ts', import.meta.url), { type: 'module' });

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const statusLamp = $('statusLamp');
const statusText = $('statusText');

function setStatus(mode: 'busy' | 'ready', text: string): void {
  statusLamp.className = 'status-lamp ' + mode;
  statusText.textContent = text;
}

/** Linear interpolation of a curve (1 g/cm² grid) at arbitrary thickness. */
function interp(pts: CurvePoint[], t: number): CurvePoint {
  if (t <= pts[0]!.t) return pts[0]!;
  const last = pts[pts.length - 1]!;
  if (t >= last.t) return last;
  const i = Math.floor(t / (pts[1]!.t - pts[0]!.t));
  const a = pts[i]!;
  const b = pts[Math.min(i + 1, pts.length - 1)]!;
  const f = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
  return { t, H: a.H + (b.H - a.H) * f, D: a.D + (b.D - a.D) * f, Q: a.Q + (b.Q - a.Q) * f };
}

/** Fetch the dose-vs-thickness curves for the current (W, mode): instant if cached, else off-thread. */
function requestCurves(): void {
  const cached = curveCache.get(curveKey());
  if (cached) {
    curves = cached;
    render();
    return;
  }
  setStatus('busy', 'COMPUTING');
  worker.postMessage({ type: 'curves', W: state.W, mode: state.mode });
}

/** Debounced curve request — used while dragging the continuous W slider. */
function scheduleCurves(): void {
  const cached = curveCache.get(curveKey());
  if (cached) {
    curves = cached;
    render();
    return;
  }
  setStatus('busy', 'COMPUTING');
  clearTimeout(curveTimer);
  curveTimer = window.setTimeout(() => worker.postMessage({ type: 'curves', W: state.W, mode: state.mode }), 140);
}

/** Debounced incident-spectrum request (depends on W only, before shielding). */
function requestSpectrum(): void {
  clearTimeout(specTimer);
  specTimer = window.setTimeout(() => worker.postMessage({ type: 'spectrum', W: state.W }), 140);
}

/** Debounced self-check request — carries the live rate/duration for the arithmetic checks. */
function requestSelfChecks(): void {
  clearTimeout(checkTimer);
  checkTimer = window.setTimeout(() => {
    const r = readout();
    worker.postMessage({ type: 'selfcheck', W: state.W, rate: r.H, days: state.duration });
  }, 200);
}

worker.onmessage = (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === 'curves') {
    if (typeof msg.bandRel === 'number') bandRel = msg.bandRel;
    curveCache.set(`${msg.W}:${msg.mode}`, msg.series);
    if (!heroSet && msg.W === W_MIN && msg.mode === 'primaries') {
      setHeroSubhead(msg.series);
      heroSet = true;
    }
    if (msg.W === state.W && msg.mode === state.mode) {
      curves = msg.series;
      setStatus('ready', 'READY');
      render();
    }
  } else if (msg.type === 'multiLayer') {
    ml = { H: msg.H, D: msg.D, Q: msg.Q };
    setStatus('ready', 'READY');
    render();
  } else if (msg.type === 'organs') {
    organs = {};
    for (const o of msg.organs as { key: string; H: number; D: number }[]) organs[o.key] = { H: o.H, D: o.D };
    renderOrgans();
  } else if (msg.type === 'spectrum') {
    if (msg.W === state.W) { spectrum = msg as SpectrumData; drawSpectrum(); }
  } else if (msg.type === 'selfcheck') {
    selfChecks = msg.checks as SelfCheck[];
    renderSelfChecks();
  } else if (msg.type === 'validate') {
    lastVal = msg.data;
    renderValidation(msg.data);
    renderStrip(msg.data);
  }
};

// ---- rendering -------------------------------------------------------------
/** Active shield stack: [layer1] or [layer1, layer2] (outermost first). */
function layers(): { material: string; thickness: number }[] {
  const a = { material: state.material, thickness: state.thickness };
  return state.singleLayer ? [a] : [a, { material: state.layer2.material, thickness: state.layer2.thickness }];
}

/** Current dose readout: single-layer → instant curve interp; two-layer → last worker result. */
function readout(): { H: number; D: number; Q: number } {
  if (state.singleLayer) {
    if (!curves) return { H: 0, D: 0, Q: 0 };
    const c = interp(curves[state.material]!, state.thickness);
    return { H: c.H, D: c.D, Q: c.Q };
  }
  return ml;
}

/** Debounced off-thread organ depth-dose compute (rates change only with the physics config). */
function requestOrgans(): void {
  clearTimeout(organTimer);
  organTimer = window.setTimeout(
    () => worker.postMessage({ type: 'organs', layers: layers(), W: state.W, mode: state.mode }),
    120,
  );
}

/** Update the total-areal readout and (two-layer) kick a debounced off-thread compute, then render. */
function refreshReadout(): void {
  markCustom();
  $('totalArealVal').textContent = (state.thickness + (state.singleLayer ? 0 : state.layer2.thickness)).toFixed(1);
  if (!state.singleLayer) {
    setStatus('busy', 'COMPUTING');
    clearTimeout(mlTimer);
    mlTimer = window.setTimeout(
      () => worker.postMessage({ type: 'multiLayer', layers: layers(), W: state.W, mode: state.mode }),
      90,
    );
  }
  requestOrgans();
  syncURL();
  render();
}

function render(): void {
  if (!curves) return;
  const cur = readout();

  $('rateValue').textContent = cur.H.toFixed(2);
  $('absVal').textContent = cur.D.toFixed(3);
  $('qVal').textContent = cur.Q.toFixed(2);

  // Phase A: 1σ-style input band on the headline rate (GCR flux ⊕ stopping power ⊕ this
  // run's PSTAR deviation). Explicitly NOT model-form error — the 0.67× gap is separate.
  $('uncLine').textContent =
    bandRel > 0
      ? `± ${(cur.H * bandRel).toFixed(2)} mSv/day input uncertainty (±${(bandRel * 100).toFixed(1)}% — GCR flux ⊕ stopping power; excludes un-modeled secondaries)`
      : '';

  const totalSv = (cur.H * state.duration) / 1000;
  $('totalVal').textContent = totalSv.toFixed(2);

  const totalMsv = cur.H * state.duration;
  const pct = (totalMsv / NASA_CAREER_LIMIT_MSV) * 100;
  $('careerPct').textContent = pct.toFixed(0) + '%';
  // presentation only: nominal < 50% of the NASA-STD-3001 career limit ≤ caution ≤ 100% < exceed
  const band = totalMsv > NASA_CAREER_LIMIT_MSV ? 'exceed' : totalMsv >= NASA_CAREER_LIMIT_MSV / 2 ? 'caution' : 'nominal';
  $('totalVal').setAttribute('data-band', band);
  $('careerPct').setAttribute('data-band', band);
  const fill = $('careerFill');
  fill.style.width = Math.min(100, pct) + '%';
  fill.style.background = pct > 100 ? 'var(--warn)' : 'linear-gradient(90deg, var(--accent), var(--water))';
  const note = $('careerNote');
  if (pct > 100) {
    note.textContent = `⚠ exceeds NASA career limit by ${(pct - 100).toFixed(0)}% (${totalMsv.toFixed(0)} mSv)`;
    note.style.color = 'var(--warn)';
  } else {
    note.textContent = `${totalMsv.toFixed(0)} mSv of 600 mSv over ${state.duration} d`;
    note.style.color = 'var(--dim)';
  }
  const baseFoot =
    state.mode === 'fragmentation'
      ? 'Free space, with simplified nuclear fragmentation (Bradt–Peters; charged fragments only — no secondary neutrons, not HZETRN). GCR: Matthiä 2013. Q: ICRP-60. Tissue: water.'
      : 'Free space, primaries only (no nuclear fragmentation). GCR: Matthiä 2013 (BON fit). Q: ICRP-60. Tissue: water.';
  $('footnote').textContent =
    baseFoot +
    (state.singleLayer
      ? ''
      : ' · Two-layer stack — same CSDA engine, but unvalidated beyond the single-layer limit (no NASA layered measurement).');
  renderOrgans();
  renderSensitivity();
  drawChart();
  drawTimeline();
  requestSelfChecks();
}

// ---- sensitivity panel (Phase B) ---------------------------------------------
// "What assumption matters most" — each row re-reads the SAME cached curves the chart
// plots (no new physics runs): mission total after the stated change vs the current one.
interface SensRow { label: string; pct: number; note: string }

/** Sensitivity rows — computed once, consumed by both the HTML panel and the print export. */
function sensitivityRows(): SensRow[] | null {
  if (!curves) return null;
  const cur = readout().H * state.duration;
  if (!(cur > 0)) return null;
  const rows: SensRow[] = [];

  if (state.singleLayer) {
    // areal density +20% (clamped to the modeled 0–40 g/cm² range)
    const t2 = Math.min(40, state.thickness * 1.2);
    if (t2 > state.thickness + 1e-9) {
      const H2 = interp(curves[state.material]!, t2).H;
      rows.push({
        label: `Areal density +20% (${state.thickness.toFixed(1)} → ${t2.toFixed(1)} g/cm²)`,
        pct: ((H2 * state.duration) / cur - 1) * 100,
        note: 'same curve the chart plots',
      });
    }
    // switch to the best-ranked material at the same areal density
    const bestKey = 'hydrogen' as const; // validated rank: H₂ < CH₄ < PE < water < Al
    if (state.material !== bestKey) {
      const Hb = interp(curves[bestKey]!, state.thickness).H;
      rows.push({
        label: `Material → liquid hydrogen @ ${state.thickness.toFixed(1)} g/cm²`,
        pct: ((Hb * state.duration) / cur - 1) * 100,
        note: 'validated H-content ranking',
      });
    }
  } else {
    rows.push({
      label: 'Layer sensitivities: switch to single-layer view',
      pct: NaN,
      note: 'two-layer doses come from the worker, not the plotted curves — no stale numbers shown',
    });
  }

  rows.push({ label: 'Mission duration +20%', pct: 20, note: 'exactly linear by construction' });
  return rows;
}

function renderSensitivity(): void {
  const el = $('sensRows');
  if (!el) return;
  const rows = sensitivityRows();
  if (!rows) {
    el.innerHTML = '';
    return;
  }
  const fmt = (p: number): string => `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`;
  const maxAbs = Math.max(20, ...rows.filter((r) => Number.isFinite(r.pct)).map((r) => Math.abs(r.pct)));
  el.innerHTML = rows
    .map((r) => {
      if (!Number.isFinite(r.pct)) {
        return `<div class="organ-row"><div class="organ-head"><span class="o-name">${r.label}</span><span class="o-nums">—</span></div><div class="organ-limit">${r.note}</div></div>`;
      }
      const w = (Math.abs(r.pct) / maxAbs) * 100;
      const band = r.pct > 0 ? 'exceed' : 'nominal'; // red = raises dose, green = lowers it
      return `<div class="organ-row">
        <div class="organ-head"><span class="o-name">${r.label}</span><span class="o-nums">${fmt(r.pct)} mission total</span></div>
        <div class="organ-bar"><div class="organ-fill" data-band="${band}" style="width:${w.toFixed(1)}%"></div></div>
        <div class="organ-limit">${r.note}</div>
      </div>`;
    })
    .join('');
}

// ---- organ dose estimates (v2.1) --------------------------------------------
// NASA/NCRP depth-dose convention: skin / eye lens / BFO ≈ dose at 0.007 / 0.3 / 5 g/cm²
// water depth behind the shield stack. Bars compare the WORST 30 days of absorbed dose with
// the NASA-STD-3001 30-day limits (250 / 1000 / 1500 mGy-Eq for BFO / lens / skin) — absorbed
// mGy is shown as a proxy for gray-equivalent because RBE is not modeled (labeled below).
const ORGANS_UI = [
  { key: 'bfo', name: 'Blood-forming organs', depth: '5', limit30d: 250 },
  { key: 'eye', name: 'Eye lens', depth: '0.3', limit30d: 1000 },
  { key: 'skin', name: 'Skin', depth: '0.007', limit30d: 1500 },
] as const;

function renderOrgans(): void {
  const el = $('organRows');
  if (!el) return;
  if (!organs) {
    el.innerHTML = '<p class="val-hint">Computing organ depth-doses…</p>';
    return;
  }
  const f = (x: number, n = 2): string => x.toFixed(n);
  el.innerHTML = ORGANS_UI.map((o) => {
    const d = organs![o.key];
    if (!d) return '';
    const totalMsv = d.H * state.duration;
    const d30 = d.D * Math.min(30, state.duration); // worst 30 days (constant rate; capped by mission length)
    const pct = (d30 / o.limit30d) * 100;
    const band = pct > 100 ? 'exceed' : pct >= 50 ? 'caution' : 'nominal';
    return `<div class="organ-row">
      <div class="organ-head">
        <span class="o-name">${o.name} · ${o.depth} g/cm² depth</span>
        <span class="o-nums">${f(d.H)} mSv/d · mission ${totalMsv.toFixed(0)} mSv</span>
      </div>
      <div class="organ-bar"><div class="organ-fill" data-band="${band}" style="width:${Math.min(100, pct).toFixed(1)}%"></div></div>
      <div class="organ-limit">worst 30 d: ${f(d30, 1)} mGy vs ${o.limit30d} mGy-Eq NASA 30-day limit · ${pct.toFixed(1)}%</div>
    </div>`;
  }).join('');
}

// ---- print export plumbing (v2.3) --------------------------------------------
// The SAME renderer draws the on-screen canvas and the print PNG: export re-renders into an
// offscreen canvas at EXPORT_W×EXPORT_DPR (3200 px wide, 300-DPI-class for poster print) with
// an opaque background and a baked-in caption identifying the configuration. No screenshots.
const EXPORT_W = 1280;
const EXPORT_DPR = 2.5;
const EXPORT_CAPTION_H = 44;

function drawCaption(ctx: CanvasRenderingContext2D, cssW: number, plotH: number, caption: string): void {
  ctx.strokeStyle = 'rgba(40,63,99,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(12, plotH + 6); ctx.lineTo(cssW - 12, plotH + 6); ctx.stroke();
  ctx.font = '11px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#9db1cd';
  ctx.fillText(caption, 12, plotH + 22);
  ctx.fillStyle = '#7f94b0';
  ctx.fillText(`DOSEFIELD — izbanovj3-prog.github.io/DOSEFIELD · generated ${new Date().toISOString().slice(0, 10)}`, 12, plotH + 37);
}

/** Current configuration line baked into exported charts (stands alone on a printed poster). */
function configCaption(chartTitle: string): string {
  const mats = state.singleLayer
    ? `${MAT_LABEL[state.material]} ${state.thickness.toFixed(1)} g/cm²`
    : `${MAT_LABEL[state.material]} ${state.thickness.toFixed(1)} + ${MAT_LABEL[state.layer2.material]} ${state.layer2.thickness.toFixed(1)} g/cm²`;
  const mode = state.mode === 'fragmentation' ? 'primaries + simplified fragmentation' : 'primaries only';
  return `${chartTitle} — ${PRESET_LABEL[state.preset] ?? state.preset} preset · ${mats} · W = ${state.W} (Matthiä 2013) · ${mode} · ${state.duration} d`;
}

/** Print-only sensitivity chart (the on-screen panel is HTML; posters need a canvas). */
function renderSensitivityCanvas(canvas: HTMLCanvasElement, cssW: number, dpr: number, rows: SensRow[], caption: string): void {
  const padT = 24;
  const rowH = 74;
  const cssH = padT + rows.length * rowH + 6;
  canvas.width = cssW * dpr;
  canvas.height = (cssH + EXPORT_CAPTION_H) * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0d1526';
  ctx.fillRect(0, 0, cssW, cssH + EXPORT_CAPTION_H);
  const maxAbs = Math.max(20, ...rows.filter((r) => Number.isFinite(r.pct)).map((r) => Math.abs(r.pct)));
  rows.forEach((r, i) => {
    const y = padT + i * rowH;
    ctx.font = '13px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#c9d8ee';
    ctx.fillText(r.label, 16, y + 14);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#7a8fb2';
    ctx.fillText(Number.isFinite(r.pct) ? `${r.pct >= 0 ? '+' : ''}${r.pct.toFixed(1)}% mission total` : '—', cssW - 16, y + 14);
    if (Number.isFinite(r.pct)) {
      const barW = cssW - 32;
      ctx.fillStyle = '#060b16';
      ctx.fillRect(16, y + 24, barW, 10);
      ctx.strokeStyle = '#1d2c4a';
      ctx.strokeRect(16.5, y + 24.5, barW - 1, 9);
      ctx.fillStyle = r.pct > 0 ? '#ff5a5a' : '#46e06a'; // red = raises dose, green = lowers it
      ctx.fillRect(16, y + 24, (Math.abs(r.pct) / maxAbs) * barW, 10);
    }
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7f94b0';
    ctx.fillText(r.note, 16, y + 52);
  });
  drawCaption(ctx, cssW, cssH, caption);
}

/** Re-render the requested chart into an offscreen canvas at print resolution and download it. */
function exportChartPNG(kind: 'dose' | 'timeline' | 'spectrum' | 'sensitivity', btn: HTMLButtonElement): void {
  const off = document.createElement('canvas');
  if (kind === 'dose') {
    if (!curves) return;
    renderDoseChart(off, EXPORT_W, EXPORT_DPR, configCaption('Dose-equivalent vs shield areal density'));
  } else if (kind === 'timeline') {
    if (!curves) return;
    renderTimeline(off, EXPORT_W, EXPORT_DPR, configCaption('Cumulative dose over mission'));
  } else if (kind === 'spectrum') {
    if (!spectrum) return;
    renderSpectrumChart(off, EXPORT_W, EXPORT_DPR, `Dose-rate contribution per decade of ion energy (incident GCR, before shielding) — W = ${state.W} (Matthiä 2013)`);
  } else {
    const rows = sensitivityRows();
    if (!rows) return;
    renderSensitivityCanvas(off, EXPORT_W, EXPORT_DPR, rows, configCaption('Sensitivity — mission-total response'));
  }
  off.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dosefield_${kind}_${PRESET_CODE[state.preset] ?? 'custom'}_${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    const prev = btn.textContent;
    btn.textContent = 'Saved ✓';
    setTimeout(() => { btn.textContent = prev; }, 1300);
  }, 'image/png');
}

function drawChart(): void {
  const canvas = $<HTMLCanvasElement>('chart');
  renderDoseChart(canvas, canvas.clientWidth || 900, window.devicePixelRatio || 1);
}
function renderDoseChart(canvas: HTMLCanvasElement, cssW: number, dpr: number, caption?: string): void {
  if (!curves) return;
  const cssH = 420;
  const totalH = cssH + (caption ? EXPORT_CAPTION_H : 0);
  canvas.width = cssW * dpr;
  canvas.height = totalH * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, totalH);
  if (caption) { ctx.fillStyle = '#0d1526'; ctx.fillRect(0, 0, cssW, totalH); }

  const pad = { l: 56, r: 16, t: 14, b: 36 };
  const plotW = cssW - pad.l - pad.r;
  const plotH = cssH - pad.t - pad.b;

  const tMax = 40;
  let hMax = 0;
  for (const m of Object.keys(curves)) for (const p of curves[m]!) hMax = Math.max(hMax, p.H);
  hMax = Math.ceil(hMax * 1.1 * 2) / 2 || 3;

  const xOf = (t: number) => pad.l + (t / tMax) * plotW;
  const yOf = (h: number) => pad.t + plotH - (h / hMax) * plotH;

  // grid + axes
  ctx.strokeStyle = 'rgba(40,63,99,0.5)';
  ctx.fillStyle = '#7f94b0';
  ctx.font = '11px ui-monospace, monospace';
  ctx.lineWidth = 1;
  for (let h = 0; h <= hMax + 1e-9; h += 0.5) {
    const y = yOf(h);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(cssW - pad.r, y); ctx.stroke();
    ctx.textAlign = 'right'; ctx.fillText(h.toFixed(1), pad.l - 8, y + 4);
  }
  for (let t = 0; t <= tMax; t += 5) {
    const x = xOf(t);
    ctx.strokeStyle = 'rgba(40,63,99,0.28)';
    ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + plotH); ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillText(String(t), x, cssH - pad.b + 18);
  }
  ctx.fillStyle = '#9db1cd'; ctx.textAlign = 'center';
  ctx.fillText('shield areal density  (g/cm²)', pad.l + plotW / 2, cssH - 4);
  ctx.save(); ctx.translate(14, pad.t + plotH / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText('dose-equivalent  (mSv/day)', 0, 0); ctx.restore();

  // Phase A: shaded ±input-uncertainty band around the ACTIVE material's curve
  // (H·(1±bandRel); input propagation only — the un-modeled-secondaries gap is separate).
  if (bandRel > 0) {
    const pts = curves[state.material]!;
    ctx.fillStyle = 'rgba(0, 212, 255, 0.09)';
    ctx.beginPath();
    pts.forEach((p, i) => { const x = xOf(p.t); const y = yOf(Math.min(p.H * (1 + bandRel), hMax)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i]!;
      ctx.lineTo(xOf(p.t), yOf(p.H * (1 - bandRel)));
    }
    ctx.closePath();
    ctx.fill();
  }

  // traces
  for (const m of ['aluminum', 'polyethylene', 'water', 'hydrogen', 'methane'] as const) {
    const pts = curves[m]!;
    ctx.strokeStyle = TRACE[m];
    ctx.lineWidth = m === state.material ? 2.6 : 1.5;
    ctx.globalAlpha = m === state.material ? 1 : 0.62;
    ctx.beginPath();
    pts.forEach((p, i) => { const x = xOf(p.t); const y = yOf(p.H); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // current-config marker — single-layer: (thickness, dose) on the active curve; two-layer:
  // (total areal density, two-layer dose) plotted against the single-material reference curves.
  const rd = readout();
  const markT = state.singleLayer ? state.thickness : state.thickness + state.layer2.thickness;
  const mx = xOf(Math.min(markT, tMax));
  const my = yOf(rd.H);
  ctx.strokeStyle = 'rgba(231,240,255,0.45)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(mx, pad.t); ctx.lineTo(mx, pad.t + plotH); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#e7f0ff';
  ctx.beginPath(); ctx.arc(mx, my, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = TRACE[state.material]; ctx.lineWidth = 2; ctx.stroke();

  if (caption) drawCaption(ctx, cssW, cssH, caption);
}

// Cumulative dose over the mission (Feature 3). Linear accumulation = constant GCR rate
// (no solar-cycle variation or SPE spikes — labeled). Reference lines + career-limit crossing.
function drawTimeline(): void {
  const canvas = $<HTMLCanvasElement>('timeline');
  if (!canvas) return;
  renderTimeline(canvas, canvas.clientWidth || 900, window.devicePixelRatio || 1);
}
function renderTimeline(canvas: HTMLCanvasElement, cssW: number, dpr: number, caption?: string): void {
  const cssH = 320;
  const totalH = cssH + (caption ? EXPORT_CAPTION_H : 0);
  canvas.width = cssW * dpr;
  canvas.height = totalH * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, totalH);
  if (caption) { ctx.fillStyle = '#0d1526'; ctx.fillRect(0, 0, cssW, totalH); }

  const pad = { l: 56, r: 16, t: 18, b: 36 };
  const plotW = cssW - pad.l - pad.r;
  const plotH = cssH - pad.t - pad.b;

  const rate = readout().H; // mSv/day (constant)
  const days = Math.max(1, state.duration);
  const totalSv = (rate * days) / 1000;
  const CAREER = NASA_CAREER_LIMIT_MSV / 1000; // 0.6 Sv
  const ANNUAL = 0.05; // Sv — NCRP occupational reference, not a current NASA mission limit

  const yMax = Math.max(CAREER * 1.08, totalSv * 1.12, ANNUAL * 1.4);
  const xOf = (d: number) => pad.l + (d / days) * plotW;
  const yOf = (sv: number) => pad.t + plotH - (Math.min(sv, yMax) / yMax) * plotH;

  ctx.font = '11px ui-monospace, monospace';
  const ystep = yMax > 0.5 ? 0.1 : 0.02;
  for (let v = 0; v <= yMax + 1e-9; v += ystep) {
    const y = yOf(v);
    ctx.strokeStyle = 'rgba(40,63,99,0.4)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(cssW - pad.r, y); ctx.stroke();
    ctx.fillStyle = '#7f94b0'; ctx.textAlign = 'right'; ctx.fillText(v.toFixed(2), pad.l - 8, y + 4);
  }
  const xstep = days <= 30 ? 5 : days <= 200 ? 30 : 60;
  for (let d = 0; d <= days + 1e-9; d += xstep) {
    ctx.fillStyle = '#7f94b0'; ctx.textAlign = 'center'; ctx.fillText(String(Math.round(d)), xOf(d), cssH - pad.b + 18);
  }
  ctx.fillStyle = '#9db1cd'; ctx.textAlign = 'center';
  ctx.fillText('mission day', pad.l + plotW / 2, cssH - 4);
  ctx.save(); ctx.translate(14, pad.t + plotH / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText('cumulative dose-equivalent  (Sv)', 0, 0); ctx.restore();

  const refLine = (sv: number, color: string, label: string): void => {
    if (sv > yMax) return;
    const y = yOf(sv);
    ctx.strokeStyle = color; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(cssW - pad.r, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.fillText(label, pad.l + 6, y - 5);
  };
  refLine(ANNUAL, '#ff9f43', 'Annual Limit (50 mSv) · NCRP occupational');
  refLine(CAREER, '#ff5a5a', 'NASA Career Limit (600 mSv)');

  // cumulative-dose line (straight, constant rate)
  ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(xOf(0), yOf(0)); ctx.lineTo(xOf(days), yOf(totalSv)); ctx.stroke();
  ctx.fillStyle = '#e7f0ff';
  ctx.beginPath(); ctx.arc(xOf(days), yOf(totalSv), 4, 0, Math.PI * 2); ctx.fill();

  if (rate > 0 && totalSv > CAREER) {
    const crossDay = (CAREER * 1000) / rate; // cumulative = 600 mSv
    if (crossDay <= days) {
      const x = xOf(crossDay);
      ctx.strokeStyle = 'rgba(255,90,90,0.85)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + plotH); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ff5a5a'; ctx.textAlign = 'center'; ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.fillText(`Limit reached on day ${Math.round(crossDay)}`, x, pad.t + plotH - 8);
    }
    ctx.fillStyle = '#ff5a5a'; ctx.textAlign = 'right'; ctx.font = 'bold 12px sans-serif';
    ctx.fillText('⚠ Exceeds NASA career limit', cssW - pad.r, pad.t + 2);
  }

  if (caption) drawCaption(ctx, cssW, cssH, caption);
}

// ---- dose spectrum dH/dT chart (v2.2) ------------------------------------------
// Log–log plot of the differential dose-equivalent contribution per ion energy for the
// INCIDENT (pre-shield) GCR field. Same integrand as the free-space dose — the chart just
// resolves in energy what the readout integrates. Depends on W only, labeled as such.
function fmtEnergy(T: number): string {
  if (T >= 1000) return `${(T / 1000).toFixed(T >= 10000 ? 0 : 1)}k`;
  return String(Math.round(T));
}

function drawSpectrum(): void {
  const canvas = $<HTMLCanvasElement>('spectrum');
  if (!canvas) return;
  renderSpectrumChart(canvas, canvas.clientWidth || 900, window.devicePixelRatio || 1);
}
function renderSpectrumChart(canvas: HTMLCanvasElement, cssW: number, dpr: number, caption?: string): void {
  if (!spectrum) return;
  const cssH = 340;
  const totalH = cssH + (caption ? EXPORT_CAPTION_H : 0);
  canvas.width = cssW * dpr;
  canvas.height = totalH * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, totalH);
  if (caption) { ctx.fillStyle = '#0d1526'; ctx.fillRect(0, 0, cssW, totalH); }

  const pad = { l: 64, r: 16, t: 20, b: 40 };
  const plotW = cssW - pad.l - pad.r;
  const plotH = cssH - pad.t - pad.b;

  // x: 10 … 1e5 MeV/n (4 decades); y: 5 decades down from the total's maximum
  const vMax = Math.max(...spectrum.total);
  const expHi = Math.ceil(Math.log10(vMax));
  const Y_DECADES = 5;
  const expLo = expHi - Y_DECADES;
  const xOf = (T: number): number => pad.l + ((Math.log10(T) - 1) / 4) * plotW;
  const yOf = (v: number): number => {
    const lv = Math.log10(Math.max(v, Math.pow(10, expLo)));
    return pad.t + plotH - ((lv - expLo) / Y_DECADES) * plotH;
  };

  ctx.font = '11px ui-monospace, monospace';
  ctx.lineWidth = 1;
  // y grid: one line per decade
  for (let ex = expLo; ex <= expHi; ex++) {
    const y = yOf(Math.pow(10, ex));
    ctx.strokeStyle = 'rgba(40,63,99,0.5)';
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(cssW - pad.r, y); ctx.stroke();
    ctx.fillStyle = '#7f94b0'; ctx.textAlign = 'right';
    ctx.fillText(`1e${ex}`, pad.l - 8, y + 4);
  }
  // x grid: decades 10 … 1e5
  for (let ex = 1; ex <= 5; ex++) {
    const T = Math.pow(10, ex);
    const x = xOf(T);
    ctx.strokeStyle = 'rgba(40,63,99,0.28)';
    ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + plotH); ctx.stroke();
    ctx.fillStyle = '#7f94b0'; ctx.textAlign = 'center';
    ctx.fillText(fmtEnergy(T), x, cssH - pad.b + 18);
  }
  ctx.fillStyle = '#9db1cd'; ctx.textAlign = 'center';
  ctx.fillText('ion kinetic energy  (MeV/n, log)', pad.l + plotW / 2, cssH - 4);
  ctx.save(); ctx.translate(14, pad.t + plotH / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText('dose contribution  (mSv/day per decade, log)', 0, 0); ctx.restore();

  const trace = (ys: number[], color: string, width: number, alpha = 1): void => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < spectrum!.T.length; i++) {
      const v = ys[i]!;
      if (v <= 0) continue; // log axis: skip empty bins
      const x = xOf(spectrum!.T[i]!);
      const y = yOf(v);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  // per-ion overlays first (under the total)
  if (showIons) {
    for (const k of SPEC_ION_KEYS) trace(spectrum.perIon[k] ?? [], SPEC_COLORS[k]!, 1.3, 0.8);
  }
  // total — the headline trace
  trace(spectrum.total, '#e7f0ff', 2.4);

  // peak-contribution marker (drawn label instead of a hover tooltip — hand-rolled canvas)
  const px = xOf(spectrum.peakT);
  ctx.strokeStyle = 'rgba(0,212,255,0.55)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(px, pad.t); ctx.lineTo(px, pad.t + plotH); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#00d4ff'; ctx.textAlign = px > pad.l + plotW * 0.7 ? 'right' : 'left';
  ctx.fillText(`peak contribution: ${fmtEnergy(spectrum.peakT)} MeV/n`, px + (px > pad.l + plotW * 0.7 ? -6 : 6), pad.t + 12);

  if (caption) drawCaption(ctx, cssW, cssH, caption);
}

// ---- automated self-checks (v2.2) ------------------------------------------------
function renderSelfChecks(): void {
  if (!selfChecks) return;
  const allPass = selfChecks.every((c) => c.pass);
  const nPass = selfChecks.filter((c) => c.pass).length;
  const lamp = $('selfLamp');
  lamp.dataset.state = allPass ? 'pass' : 'fail';
  lamp.title = `Automated self-checks: ${nPass}/${selfChecks.length} pass — see Validation Suite`;
  $('selfSummary').textContent = `${nPass}/${selfChecks.length} pass`;
  $('selfSummary').dataset.state = allPass ? 'pass' : 'fail';
  $('selfCheckRows').innerHTML = selfChecks
    .map(
      (c) =>
        `<div class="val-row ${c.pass ? 'pass' : 'fail'}"><span class="vr-icon">${c.pass ? '✔' : '✘'}</span>` +
        `<span>${c.name}</span><span class="vr-detail">${c.detail}</span></div>`,
    )
    .join('');
}

function renderValidation(d: ValidationSummary): void {
  const f = (x: number, n = 2): string => x.toFixed(n);
  const check = (ok: boolean, label: string, detail: string): string =>
    `<div class="val-row ${ok ? 'pass' : 'fail'}"><span class="vr-icon">${ok ? '✔' : '✘'}</span>` +
    `<span>${label}</span><span class="vr-detail">${detail}</span></div>`;
  const r = d.rad;
  const radRow = (q: string, model: string, meas: string, ratio: string): string =>
    `<tr><td class="rt-q">${q}</td><td>${model}</td><td class="rt-meas">${meas}</td><td class="rt-ratio">${ratio}×</td></tr>`;
  $('validationResults').innerHTML =
    check(
      d.nist.maxSolidPct <= 5,
      'Proton stopping power vs NIST PSTAR',
      `max err ≥10 MeV ${f(d.nist.maxSolidPct)}% · all energies ${f(d.nist.maxAllPct)}%`,
    ) +
    check(
      d.trend.ok,
      'Shields rank by hydrogen content: H₂ < CH₄ < PE < water < Al',
      `hydrogen beats aluminium by up to ${f(d.trend.maxBestBenefitPct, 1)}%`,
    ) +
    `<div class="rad-box">
      <div class="rad-kicker">MSL/RAD CRUISE — MODEL vs MEASURED</div>
      <div class="rad-note">φ≈${d.phiLo}–${d.phiHi} MV → Matthiä W≈${d.cruiseW}, behind ${d.cruiseShield} g/cm² Al-equiv · set independently of the measurement</div>
      <table class="rad-table">
        <thead><tr>
          <th>quantity</th>
          <th>model</th>
          <th>measured (RAD)</th>
          <th>ratio</th></tr></thead>
        <tbody>
          ${radRow('absorbed dose [mGy/d]', f(r.model.D, 3), `${f(r.measured.D, 3)} ± ${d.radSigma.D}`, f(r.ratioD))}
          ${radRow('dose-equivalent [mSv/d]', f(r.model.H), `${f(r.measured.H)} ± ${d.radSigma.H}`, f(r.ratioH))}
          ${radRow('mean quality ⟨Q⟩', f(r.model.Q), `${f(r.measured.Q)} ± ${d.radSigma.Q}`, f(r.ratioQ))}
        </tbody>
      </table>
    </div>
    <div class="limitations">
      <span class="lim-head">Limitations.</span> 1-D deterministic CSDA · GCR primaries + simplified Bradt–Peters fragmentation ·
      <span class="lim-warn">no secondary-neutron / target-fragment transport</span>, so absorbed dose is under-predicted (ratio ${f(r.ratioD)}×) — the honest scope limit. Not a substitute for HZETRN / OLTARIS.
    </div>`;
}

// Hero subhead — the REAL default-config mission total (aluminium · 10 g/cm² · solar min ·
// primaries · 360 d), computed live from the curve, never a typed number. Truth-over-drama
// guard: the "past the limit" claim only renders if the computed total actually exceeds it.
function setHeroSubhead(series: CurveSeries): void {
  const days = 360; // default mission duration (matches the duration slider's default)
  const defH = interp(series.aluminum!, 10).H; // dose-equivalent [mSv/day] at the default 10 g/cm²
  const totalMsv = defH * days;
  const sv = totalMsv / 1000;
  const months = Math.round(days / 30.44);
  const el = $('heroSubhead');
  el.innerHTML =
    totalMsv > NASA_CAREER_LIMIT_MSV
      ? `A ${months}-month Mars round trip delivers <span class="hero-x">~${sv.toFixed(2)} Sv</span> of cosmic radiation — past NASA’s ${NASA_CAREER_LIMIT_MSV} mSv career limit, before you’ve landed.`
      : `A ${months}-month Mars round trip delivers <span class="hero-x">~${sv.toFixed(2)} Sv</span> of cosmic radiation — ${Math.round((totalMsv / NASA_CAREER_LIMIT_MSV) * 100)}% of NASA’s ${NASA_CAREER_LIMIT_MSV} mSv career limit.`;
}

// Always-on validation strip + the hero's NIST figure — sourced from the SAME
// computeValidationSummary() that `npm run report` / generateReport.ts use. No literals typed into the markup.
function renderStrip(d: ValidationSummary): void {
  $('heroNist').textContent = `${d.nist.maxSolidPct.toFixed(2)}%`;
  $('vsNist').innerHTML = `<span class="vs-ok">${d.nist.maxSolidPct.toFixed(2)}%</span> max error`;
  const r = d.rad;
  $('vsRad').innerHTML = `${r.model.H.toFixed(2)} vs ${r.measured.H.toFixed(2)} mSv/day · <span class="vs-ok">${r.ratioH.toFixed(2)}×</span>`;
}

// ---- mission presets (Feature 2) -------------------------------------------
// Illustrative shield stacks for orientation — NOT actual spacecraft specs (labeled in the UI).
const PRESETS: Record<
  string,
  {
    duration: number;
    W: number; // Matthiä solar modulation (0 = solar min, 130 = solar max)
    mode: 'primaries' | 'fragmentation';
    single: boolean;
    l1: { mat: keyof typeof TRACE; t: number };
    l2: { mat: keyof typeof TRACE; t: number };
  }
> = {
  'mars-cruise': { duration: 360, W: W_MIN, mode: 'fragmentation', single: false, l1: { mat: 'aluminum', t: 10 }, l2: { mat: 'polyethylene', t: 5 } },
  'lunar-gateway': { duration: 180, W: W_MAX, mode: 'primaries', single: false, l1: { mat: 'aluminum', t: 8 }, l2: { mat: 'polyethylene', t: 3 } },
  'artemis-transit': { duration: 10, W: W_MIN, mode: 'fragmentation', single: true, l1: { mat: 'aluminum', t: 6 }, l2: { mat: 'polyethylene', t: 5 } },
};

function setSeg(segId: string, attr: string, val: string): void {
  $(segId).querySelectorAll('button').forEach((x) => {
    const on = (x as HTMLElement).dataset[attr] === val;
    x.classList.toggle('active', on);
    x.setAttribute('aria-pressed', String(on));
  });
}
/** Reflect a range input's value into its --fill custom property (filled-track slider). */
function syncFill(el: HTMLInputElement): void {
  const min = parseFloat(el.min);
  const pct = ((parseFloat(el.value) - min) / (parseFloat(el.max) - min)) * 100;
  el.style.setProperty('--fill', `${pct}%`);
}
function setActivePreset(key: string): void {
  state.preset = key;
  setSeg('presetSeg', 'preset', key);
}
/** When the user edits any field manually, fall back to the Custom preset. */
function markCustom(): void {
  if (!applyingPreset && state.preset !== 'custom') setActivePreset('custom');
}
/** Push the whole `state` into the controls: values, readbacks, fills, segments, layer-2 visibility. */
function reflectControls(): void {
  $<HTMLInputElement>('duration').value = String(state.duration);
  $('durationVal').textContent = String(state.duration);
  $<HTMLInputElement>('thickness').value = String(state.thickness);
  $('thicknessVal').textContent = state.thickness.toFixed(1);
  $<HTMLInputElement>('thickness2').value = String(state.layer2.thickness);
  $('thickness2Val').textContent = state.layer2.thickness.toFixed(1);
  $<HTMLInputElement>('wSlider').value = String(state.W);
  $('wVal').textContent = String(state.W);
  (['thickness', 'thickness2', 'duration', 'wSlider'] as const).forEach((id) => syncFill($<HTMLInputElement>(id)));
  setSeg('presetSeg', 'preset', state.preset);
  setSeg('modeSeg', 'mode', state.mode);
  setSeg('layerModeSeg', 'layers', state.singleLayer ? 'single' : 'double');
  setSeg('materialSeg', 'mat', state.material);
  setSeg('material2Seg', 'mat', state.layer2.material);
  $('layer2Group').toggleAttribute('hidden', state.singleLayer);
  $('totalArealVal').textContent = (state.thickness + (state.singleLayer ? 0 : state.layer2.thickness)).toFixed(1);
}

function applyPreset(key: string): void {
  const p = PRESETS[key];
  if (!p) return;
  applyingPreset = true;
  state.duration = p.duration;
  state.W = p.W;
  state.mode = p.mode;
  state.singleLayer = p.single;
  state.material = p.l1.mat;
  state.thickness = p.l1.t;
  state.layer2 = { material: p.l2.mat, thickness: p.l2.t };
  state.preset = key;
  reflectControls();
  requestCurves(); // W/mode may have changed → refresh the chart curves
  requestSpectrum();
  refreshReadout();
  applyingPreset = false;
}

// ---- shareable URL (v2.1; v2.2 adds w=) ----------------------------------------
// The whole mission config round-trips through query params:
//   ?preset=mars&mat1=Al&den1=10&layers=2&mat2=PE&den2=5&w=0&model=frag&days=360
// Legacy links with solar=min|max (pre-v2.2) still restore: they map to W=0|130.
const MAT_CODE: Record<string, string> = { aluminum: 'Al', polyethylene: 'PE', water: 'H2O', hydrogen: 'H2', methane: 'CH4' };
const CODE_MAT: Record<string, keyof typeof TRACE> = { Al: 'aluminum', PE: 'polyethylene', H2O: 'water', H2: 'hydrogen', CH4: 'methane' };
const PRESET_CODE: Record<string, string> = { 'mars-cruise': 'mars', 'lunar-gateway': 'gateway', 'artemis-transit': 'artemis', custom: 'custom' };
const CODE_PRESET: Record<string, string> = { mars: 'mars-cruise', gateway: 'lunar-gateway', artemis: 'artemis-transit', custom: 'custom' };

function buildQuery(): string {
  const q = new URLSearchParams();
  q.set('preset', PRESET_CODE[state.preset] ?? 'custom');
  q.set('mat1', MAT_CODE[state.material]!);
  q.set('den1', String(state.thickness));
  q.set('layers', state.singleLayer ? '1' : '2');
  if (!state.singleLayer) {
    q.set('mat2', MAT_CODE[state.layer2.material]!);
    q.set('den2', String(state.layer2.thickness));
  }
  q.set('w', String(state.W));
  q.set('model', state.mode === 'fragmentation' ? 'frag' : 'prim');
  q.set('days', String(state.duration));
  return q.toString();
}

/** Keep the URL in sync with the config — replaceState for silent updates, pushState on Copy link. */
function syncURL(push = false): void {
  const url = `${location.pathname}?${buildQuery()}`;
  if (push) history.pushState(null, '', url);
  else history.replaceState(null, '', url);
}

/** snap a URL-provided areal density onto the slider grid (0.5 g/cm² steps, 0–40) */
const snapDen = (v: number): number => Math.min(40, Math.max(0, Math.round(v * 2) / 2));

/** Restore the config from query params on load (missing/invalid params keep their defaults). */
function applyURLParams(): void {
  const q = new URLSearchParams(location.search);
  const known = ['preset', 'mat1', 'den1', 'mat2', 'den2', 'layers', 'w', 'solar', 'model', 'days'];
  if (!known.some((k) => q.has(k))) return;
  applyingPreset = true;
  const m1 = CODE_MAT[q.get('mat1') ?? ''];
  if (m1) state.material = m1;
  const m2 = CODE_MAT[q.get('mat2') ?? ''];
  if (m2) state.layer2.material = m2;
  const den1 = parseFloat(q.get('den1') ?? '');
  if (Number.isFinite(den1)) state.thickness = snapDen(den1);
  const den2 = parseFloat(q.get('den2') ?? '');
  if (Number.isFinite(den2)) state.layer2.thickness = snapDen(den2);
  if (q.has('layers')) state.singleLayer = q.get('layers') !== '2';
  const w = parseInt(q.get('w') ?? '', 10);
  if (Number.isFinite(w)) state.W = Math.min(W_MAX, Math.max(W_MIN, w));
  else {
    const solar = q.get('solar'); // legacy pre-v2.2 links
    if (solar === 'min') state.W = W_MIN;
    else if (solar === 'max') state.W = W_MAX;
  }
  const model = q.get('model');
  if (model) state.mode = model === 'frag' ? 'fragmentation' : 'primaries';
  const days = parseInt(q.get('days') ?? '', 10);
  if (Number.isFinite(days)) state.duration = Math.min(1000, Math.max(30, Math.round(days / 10) * 10));
  state.preset = CODE_PRESET[q.get('preset') ?? ''] ?? 'custom';
  reflectControls();
  applyingPreset = false;
}
$('presetSeg').querySelectorAll('button').forEach((b) =>
  b.addEventListener('click', () => {
    const key = (b as HTMLElement).dataset.preset!;
    if (key === 'custom') setActivePreset('custom');
    else applyPreset(key);
  }),
);

// ---- wiring ----------------------------------------------------------------
$('materialSeg').querySelectorAll('button').forEach((b) =>
  b.addEventListener('click', () => {
    state.material = (b as HTMLElement).dataset.mat as keyof typeof TRACE;
    setSeg('materialSeg', 'mat', state.material);
    refreshReadout();
  }),
);
$('material2Seg').querySelectorAll('button').forEach((b) =>
  b.addEventListener('click', () => {
    state.layer2.material = (b as HTMLElement).dataset.mat as keyof typeof TRACE;
    setSeg('material2Seg', 'mat', state.layer2.material);
    refreshReadout();
  }),
);
$('layerModeSeg').querySelectorAll('button').forEach((b) =>
  b.addEventListener('click', () => {
    state.singleLayer = (b as HTMLElement).dataset.layers === 'single';
    setSeg('layerModeSeg', 'layers', state.singleLayer ? 'single' : 'double');
    $('layer2Group').toggleAttribute('hidden', state.singleLayer);
    refreshReadout();
  }),
);
$<HTMLInputElement>('thickness2').addEventListener('input', (e) => {
  state.layer2.thickness = parseFloat((e.target as HTMLInputElement).value);
  $('thickness2Val').textContent = state.layer2.thickness.toFixed(1);
  syncFill(e.target as HTMLInputElement);
  refreshReadout();
});
$<HTMLInputElement>('wSlider').addEventListener('input', (e) => {
  markCustom();
  state.W = parseInt((e.target as HTMLInputElement).value, 10);
  $('wVal').textContent = String(state.W);
  syncFill(e.target as HTMLInputElement);
  scheduleCurves(); // debounced — the curve set is the heavy compute
  requestSpectrum();
  refreshReadout();
});
$('modeSeg').querySelectorAll('button').forEach((b) =>
  b.addEventListener('click', () => {
    state.mode = (b as HTMLElement).dataset.mode as 'primaries' | 'fragmentation';
    setSeg('modeSeg', 'mode', state.mode);
    requestCurves();
    refreshReadout();
  }),
);
$<HTMLInputElement>('thickness').addEventListener('input', (e) => {
  state.thickness = parseFloat((e.target as HTMLInputElement).value);
  $('thicknessVal').textContent = state.thickness.toFixed(1);
  syncFill(e.target as HTMLInputElement);
  refreshReadout();
});
$<HTMLInputElement>('duration').addEventListener('input', (e) => {
  markCustom();
  state.duration = parseInt((e.target as HTMLInputElement).value, 10);
  $('durationVal').textContent = String(state.duration);
  syncFill(e.target as HTMLInputElement);
  syncURL();
  render();
});
// ---- copy shareable link (v2.1) ----------------------------------------------
$<HTMLButtonElement>('copyLink').addEventListener('click', () => {
  syncURL(true); // pushState so the copied config is a real history entry
  const btn = $<HTMLButtonElement>('copyLink');
  const done = (): void => {
    const prev = btn.textContent;
    btn.textContent = 'Copied ✓';
    setTimeout(() => { btn.textContent = prev; }, 1300);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(location.href).then(done, () => fallbackCopy(done));
  } else {
    fallbackCopy(done);
  }
});
function fallbackCopy(done: () => void): void {
  const ta = document.createElement('textarea');
  ta.value = location.href;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); done(); } finally { ta.remove(); }
}

// ---- export mission report (v2.1) ----------------------------------------------
// Plain-text report built ONLY from numbers computed this session (readout, organ
// depth-doses, cached validation summary) — nothing typed in, per the integrity rules.
const MAT_LABEL: Record<string, string> = {
  aluminum: 'Aluminium', polyethylene: 'Polyethylene', water: 'Water', hydrogen: 'Liquid hydrogen', methane: 'Methane',
};
const PRESET_LABEL: Record<string, string> = {
  'mars-cruise': 'Mars Cruise', 'lunar-gateway': 'Lunar Gateway', 'artemis-transit': 'Artemis Transit', custom: 'Custom',
};

function buildReportText(): string {
  const cur = readout();
  const totalMsv = cur.H * state.duration;
  const rule = '-'.repeat(52);
  const L: string[] = [];
  L.push('DOSEFIELD - Mission Radiation Report');
  L.push(`Generated: ${new Date().toISOString().slice(0, 10)}`);
  L.push(rule);
  L.push(`Mission preset:   ${PRESET_LABEL[state.preset] ?? state.preset} (illustrative config, not spacecraft specs)`);
  L.push(`Shield layer 1:   ${MAT_LABEL[state.material]} - ${state.thickness.toFixed(1)} g/cm2`);
  if (!state.singleLayer) L.push(`Shield layer 2:   ${MAT_LABEL[state.layer2.material]} - ${state.layer2.thickness.toFixed(1)} g/cm2`);
  L.push(`Total density:    ${(state.thickness + (state.singleLayer ? 0 : state.layer2.thickness)).toFixed(1)} g/cm2`);
  L.push(`Solar modulation: W = ${state.W} (Matthia 2013; 0 = solar min / worst GCR, 130 = solar max)`);
  L.push(`Nuclear model:    ${state.mode === 'fragmentation' ? 'Primaries + simplified fragmentation (Bradt-Peters)' : 'Primaries only'}`);
  L.push(`Duration:         ${state.duration} days`);
  L.push(rule);
  L.push('DOSE RESULTS (behind shield, free space)');
  L.push(`Daily rate:       ${cur.H.toFixed(2)} mSv/day dose-equivalent`);
  L.push(`Mission total:    ${(totalMsv / 1000).toFixed(2)} Sv (${totalMsv.toFixed(0)} mSv)`);
  L.push(`Absorbed dose:    ${cur.D.toFixed(3)} mGy/day`);
  L.push(`Mean quality <Q>: ${cur.Q.toFixed(2)}`);
  L.push(`NASA career limit (600 mSv effective): ${((totalMsv / NASA_CAREER_LIMIT_MSV) * 100).toFixed(0)}%`);
  L.push(rule);
  L.push('ORGAN ESTIMATES (approximate; NASA depth-dose convention + ICRP-60 Q)');
  if (organs) {
    for (const o of ORGANS_UI) {
      const d = organs[o.key];
      if (!d) continue;
      const d30 = d.D * Math.min(30, state.duration);
      L.push(`${(o.name + ' (' + o.depth + ' g/cm2):').padEnd(34)}${d.H.toFixed(2)} mSv/day - mission ${(d.H * state.duration).toFixed(0)} mSv`);
      L.push(`${''.padEnd(34)}worst 30 d ${d30.toFixed(1)} mGy vs ${o.limit30d} mGy-Eq NASA 30-day limit (${((d30 / o.limit30d) * 100).toFixed(1)}%)`);
    }
  } else {
    L.push('(organ depth-doses not computed yet)');
  }
  L.push('Organ estimates are approximate: 1-D depth-dose at 0.007 / 0.3 / 5 g/cm2 water');
  L.push('(skin / eye lens / BFO convention); absorbed mGy shown as a proxy for gray-');
  L.push('equivalent (RBE not modeled). Refer to HZETRN/OLTARIS for organ-level planning.');
  L.push(rule);
  L.push('MODEL');
  L.push('GCR spectrum:     Matthia et al. 2013 (Badhwar-O\'Neill fit)');
  L.push('Stopping power:   Bethe-Bloch + Sternheimer density effect (CSDA)');
  L.push('Fragmentation:    Bradt-Peters charge-changing (simplified, single-collision)');
  if (lastVal) {
    L.push(`Validation:       NIST PSTAR max err ${lastVal.nist.maxSolidPct.toFixed(2)}% (>=10 MeV); MSL/RAD H ratio ${lastVal.rad.ratioH.toFixed(2)} (within the ~2x bar)`);
  } else {
    L.push('Validation:       NIST PSTAR + NASA MSL/RAD (within ~2x) - see the live validation suite');
  }
  if (!state.singleLayer) L.push('Note: the two-layer stack is unvalidated beyond the single-layer limit.');
  L.push(rule);
  L.push('Built for NASA Stardance Challenge - https://izbanovj3-prog.github.io/DOSEFIELD/');
  return L.join('\n') + '\n';
}

$<HTMLButtonElement>('exportReport').addEventListener('click', () => {
  const blob = new Blob([buildReportText()], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `dosefield_report_${PRESET_CODE[state.preset] ?? 'custom'}_${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
  const btn = $<HTMLButtonElement>('exportReport');
  const prev = btn.textContent;
  btn.textContent = 'Saved ✓';
  setTimeout(() => { btn.textContent = prev; }, 1300);
});

$<HTMLButtonElement>('runValidation').addEventListener('click', () => {
  const btn = $<HTMLButtonElement>('runValidation');
  btn.disabled = true;
  btn.textContent = '▶ RUNNING…';
  $('validationResults').innerHTML = '<p class="val-hint">Running live physics checks…</p>';
  worker.postMessage({ type: 'validate' });
  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = '▶ RUN VALIDATION';
  }, 600);
});
(['exportDose', 'exportTimeline', 'exportSpectrum', 'exportSens'] as const).forEach((id) => {
  const kind = { exportDose: 'dose', exportTimeline: 'timeline', exportSpectrum: 'spectrum', exportSens: 'sensitivity' }[id] as
    | 'dose' | 'timeline' | 'spectrum' | 'sensitivity';
  $<HTMLButtonElement>(id).addEventListener('click', (e) => exportChartPNG(kind, e.currentTarget as HTMLButtonElement));
});
$<HTMLButtonElement>('ionToggle').addEventListener('click', () => {
  showIons = !showIons;
  const btn = $<HTMLButtonElement>('ionToggle');
  btn.setAttribute('aria-pressed', String(showIons));
  btn.classList.toggle('active', showIons);
  $('specIonLegend').toggleAttribute('hidden', !showIons);
  drawSpectrum();
});
window.addEventListener('resize', () => { drawChart(); drawTimeline(); drawSpectrum(); });

renderVersion();
renderProvenance(document.getElementById('provenance'));
applyURLParams(); // restore a shared configuration before the first compute
(['thickness', 'thickness2', 'duration', 'wSlider'] as const).forEach((id) => syncFill($<HTMLInputElement>(id)));
setStatus('busy', 'COMPUTING');
requestCurves();
if (!state.singleLayer) worker.postMessage({ type: 'multiLayer', layers: layers(), W: state.W, mode: state.mode });
requestOrgans();
requestSpectrum();
worker.postMessage({ type: 'validate' }); // populate the validation panel on load
