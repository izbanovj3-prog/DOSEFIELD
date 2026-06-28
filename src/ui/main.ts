/**
 * DOSEFIELD dosimeter UI. Controls → worker computes dose-vs-thickness curves (Al/poly/water);
 * the slider readout interpolates the active curve (instant), and the canvas plots all three.
 */
import './styles.css';
import type { CurvePoint, CurveSeries, ValidationData } from './dose.worker.js';

const NASA_CAREER_LIMIT_MSV = 600; // NASA-STD-3001 career effective-dose limit

const TRACE = { aluminum: '#ffb000', polyethylene: '#46e06a', water: '#38bdf8', hydrogen: '#ff79c6', methane: '#a78bfa' } as const;

interface Layer {
  material: keyof typeof TRACE;
  thickness: number;
}
interface State {
  material: keyof typeof TRACE; // Layer 1 (structural) material
  thickness: number; // Layer 1 areal density (g/cm²)
  layer2: Layer; // Layer 2 (inner lining)
  singleLayer: boolean;
  solar: 'min' | 'max';
  mode: 'primaries' | 'fragmentation';
  duration: number;
  preset: string; // active mission preset, or 'custom'
}
const state: State = {
  material: 'aluminum',
  thickness: 10,
  layer2: { material: 'polyethylene', thickness: 5 },
  singleLayer: true,
  solar: 'min',
  mode: 'primaries',
  duration: 360,
  preset: 'custom',
};
// last two-layer readout from the worker (used when singleLayer = false)
let ml = { H: 0, D: 0, Q: 0 };
let mlTimer: number | undefined;
let applyingPreset = false; // guards the auto-→Custom fallback while a preset sets fields

// cache of computed curves per (solar condition, nuclear mode)
const curveCache = new Map<string, CurveSeries>();
const curveKey = (): string => `${state.solar}:${state.mode}`;
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

function requestCurves(): void {
  const cached = curveCache.get(curveKey());
  if (cached) {
    curves = cached;
    render();
    return;
  }
  setStatus('busy', 'COMPUTING');
  worker.postMessage({ type: 'curves', solar: state.solar, mode: state.mode });
}

worker.onmessage = (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === 'curves') {
    curveCache.set(`${msg.solar}:${msg.mode}`, msg.series);
    if (!heroSet && msg.solar === 'min' && msg.mode === 'primaries') {
      setHeroSubhead(msg.series);
      heroSet = true;
    }
    if (msg.solar === state.solar && msg.mode === state.mode) {
      curves = msg.series;
      setStatus('ready', 'READY');
      render();
    }
  } else if (msg.type === 'multiLayer') {
    ml = { H: msg.H, D: msg.D, Q: msg.Q };
    setStatus('ready', 'READY');
    render();
  } else if (msg.type === 'validate') {
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

/** Update the total-areal readout and (two-layer) kick a debounced off-thread compute, then render. */
function refreshReadout(): void {
  markCustom();
  $('totalArealVal').textContent = (state.thickness + (state.singleLayer ? 0 : state.layer2.thickness)).toFixed(1);
  if (!state.singleLayer) {
    setStatus('busy', 'COMPUTING');
    clearTimeout(mlTimer);
    mlTimer = window.setTimeout(
      () => worker.postMessage({ type: 'multiLayer', layers: layers(), solar: state.solar, mode: state.mode }),
      90,
    );
  }
  render();
}

function render(): void {
  if (!curves) return;
  const cur = readout();

  $('rateValue').textContent = cur.H.toFixed(2);
  $('absVal').textContent = cur.D.toFixed(3);
  $('qVal').textContent = cur.Q.toFixed(2);

  const totalSv = (cur.H * state.duration) / 1000;
  $('totalVal').textContent = totalSv.toFixed(2);

  const totalMsv = cur.H * state.duration;
  const pct = (totalMsv / NASA_CAREER_LIMIT_MSV) * 100;
  $('careerPct').textContent = pct.toFixed(0) + '%';
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
  $('footnote').textContent =
    state.mode === 'fragmentation'
      ? 'Free space, with simplified nuclear fragmentation (Bradt–Peters; charged fragments only — no secondary neutrons, not HZETRN). GCR: Matthiä 2013. Q: ICRP-60. Tissue: water.'
      : 'Free space, primaries only (no nuclear fragmentation). GCR: Matthiä 2013 (BON fit). Q: ICRP-60. Tissue: water.';
  drawChart();
}

function drawChart(): void {
  if (!curves) return;
  const canvas = $<HTMLCanvasElement>('chart');
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 900;
  const cssH = 420;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

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
  ctx.fillStyle = '#6a7c97';
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
  ctx.fillStyle = '#8aa0bf'; ctx.textAlign = 'center';
  ctx.fillText('shield areal density  (g/cm²)', pad.l + plotW / 2, cssH - 4);
  ctx.save(); ctx.translate(14, pad.t + plotH / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText('dose-equivalent  (mSv/day)', 0, 0); ctx.restore();

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
}

function renderValidation(d: ValidationData): void {
  const f = (x: number, n = 2): string => x.toFixed(n);
  const check = (ok: boolean, label: string, detail: string): string =>
    `<div class="val-row ${ok ? 'pass' : 'fail'}"><span class="vr-icon">${ok ? '✔' : '✘'}</span>` +
    `<span>${label}</span><span class="vr-detail">${detail}</span></div>`;
  const r = d.rad;
  const radRow = (q: string, model: string, meas: string, ratio: string): string =>
    `<tr><td style="padding:6px 8px;color:var(--dim)">${q}</td>` +
    `<td style="padding:6px 8px;text-align:right;color:var(--text);font-variant-numeric:tabular-nums">${model}</td>` +
    `<td style="padding:6px 8px;text-align:right;color:var(--dim);font-variant-numeric:tabular-nums">${meas}</td>` +
    `<td style="padding:6px 8px;text-align:right;color:var(--accent);font-variant-numeric:tabular-nums">${ratio}×</td></tr>`;
  $('validationResults').innerHTML =
    check(
      d.nistMaxSolid <= 5,
      'Proton stopping power vs NIST PSTAR',
      `max err ≥10 MeV ${f(d.nistMaxSolid)}% · all energies ${f(d.nistMaxAll)}%`,
    ) +
    check(
      d.trendOk,
      'Shields rank by hydrogen content: H₂ < CH₄ < PE < water < Al',
      `hydrogen beats aluminium by up to ${f(d.trendBest, 1)}%`,
    ) +
    `<div style="margin-top:12px;background:#091020;border:1px solid var(--edge);border-radius:8px;padding:12px">
      <div style="font-size:11px;color:var(--accent);letter-spacing:1px;margin-bottom:6px">MSL/RAD CRUISE — MODEL vs MEASURED</div>
      <div style="font-size:10.5px;color:var(--dim);margin-bottom:8px">φ≈${d.phiLo}–${d.phiHi} MV → Matthiä W≈${d.cruiseW}, behind ${d.cruiseShield} g/cm² Al-equiv · set independently of the measurement</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="color:var(--dim);font-size:10px;text-transform:uppercase;letter-spacing:.5px">
          <th style="text-align:left;padding:4px 8px;font-weight:400">quantity</th>
          <th style="text-align:right;padding:4px 8px;font-weight:400">model</th>
          <th style="text-align:right;padding:4px 8px;font-weight:400">measured (RAD)</th>
          <th style="text-align:right;padding:4px 8px;font-weight:400">ratio</th></tr></thead>
        <tbody>
          ${radRow('absorbed dose [mGy/d]', f(r.model.D, 3), `${f(r.measured.D, 3)} ± ${d.radSigma.D}`, f(r.ratioD))}
          ${radRow('dose-equivalent [mSv/d]', f(r.model.H), `${f(r.measured.H)} ± ${d.radSigma.H}`, f(r.ratioH))}
          ${radRow('mean quality ⟨Q⟩', f(r.model.Q), `${f(r.measured.Q)} ± ${d.radSigma.Q}`, f(r.ratioQ))}
        </tbody>
      </table>
    </div>
    <div style="margin-top:12px;font-size:11px;line-height:1.65;color:var(--dim)">
      <span style="color:var(--text)">Limitations.</span> 1-D deterministic CSDA · GCR primaries + simplified Bradt–Peters fragmentation ·
      <span style="color:var(--warn)">no secondary-neutron / target-fragment transport</span>, so absorbed dose is under-predicted (ratio ${f(r.ratioD)}×) — the honest scope limit. Not a substitute for HZETRN / OLTARIS.
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

// Always-on validation strip + the hero's NIST figure — sourced from the SAME runValidation()
// data that `npm run report` / generateReport.ts use. No literals typed into the markup.
function renderStrip(d: ValidationData): void {
  $('heroNist').textContent = `${d.nistMaxSolid.toFixed(2)}%`;
  $('vsNist').innerHTML = `<span class="vs-ok">${d.nistMaxSolid.toFixed(2)}%</span> max error`;
  const r = d.rad;
  $('vsRad').innerHTML = `${r.model.H.toFixed(2)} vs ${r.measured.H.toFixed(2)} mSv/day · <span class="vs-ok">${r.ratioH.toFixed(2)}×</span>`;
}

// ---- mission presets (Feature 2) -------------------------------------------
// Illustrative shield stacks for orientation — NOT actual spacecraft specs (labeled in the UI).
const PRESETS: Record<
  string,
  {
    duration: number;
    solar: 'min' | 'max';
    mode: 'primaries' | 'fragmentation';
    single: boolean;
    l1: { mat: keyof typeof TRACE; t: number };
    l2: { mat: keyof typeof TRACE; t: number };
  }
> = {
  'mars-cruise': { duration: 360, solar: 'min', mode: 'fragmentation', single: false, l1: { mat: 'aluminum', t: 10 }, l2: { mat: 'polyethylene', t: 5 } },
  'lunar-gateway': { duration: 180, solar: 'max', mode: 'primaries', single: false, l1: { mat: 'aluminum', t: 8 }, l2: { mat: 'polyethylene', t: 3 } },
  'artemis-transit': { duration: 10, solar: 'min', mode: 'fragmentation', single: true, l1: { mat: 'aluminum', t: 6 }, l2: { mat: 'polyethylene', t: 5 } },
};

function setSeg(segId: string, attr: string, val: string): void {
  $(segId).querySelectorAll('button').forEach((x) => x.classList.toggle('active', (x as HTMLElement).dataset[attr] === val));
}
function setActivePreset(key: string): void {
  state.preset = key;
  setSeg('presetSeg', 'preset', key);
}
/** When the user edits any field manually, fall back to the Custom preset. */
function markCustom(): void {
  if (!applyingPreset && state.preset !== 'custom') setActivePreset('custom');
}
function applyPreset(key: string): void {
  const p = PRESETS[key];
  if (!p) return;
  applyingPreset = true;
  state.duration = p.duration;
  state.solar = p.solar;
  state.mode = p.mode;
  state.singleLayer = p.single;
  state.material = p.l1.mat;
  state.thickness = p.l1.t;
  state.layer2 = { material: p.l2.mat, thickness: p.l2.t };
  $<HTMLInputElement>('duration').value = String(p.duration);
  $('durationVal').textContent = String(p.duration);
  $<HTMLInputElement>('thickness').value = String(p.l1.t);
  $('thicknessVal').textContent = p.l1.t.toFixed(1);
  $<HTMLInputElement>('thickness2').value = String(p.l2.t);
  $('thickness2Val').textContent = p.l2.t.toFixed(1);
  setSeg('solarSeg', 'solar', p.solar);
  setSeg('modeSeg', 'mode', p.mode);
  setSeg('layerModeSeg', 'layers', p.single ? 'single' : 'double');
  setSeg('materialSeg', 'mat', p.l1.mat);
  setSeg('material2Seg', 'mat', p.l2.mat);
  $('layer2Group').toggleAttribute('hidden', p.single);
  setActivePreset(key);
  requestCurves(); // solar/mode may have changed → refresh the chart curves
  refreshReadout();
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
    $('materialSeg').querySelectorAll('button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    refreshReadout();
  }),
);
$('material2Seg').querySelectorAll('button').forEach((b) =>
  b.addEventListener('click', () => {
    state.layer2.material = (b as HTMLElement).dataset.mat as keyof typeof TRACE;
    $('material2Seg').querySelectorAll('button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    refreshReadout();
  }),
);
$('layerModeSeg').querySelectorAll('button').forEach((b) =>
  b.addEventListener('click', () => {
    state.singleLayer = (b as HTMLElement).dataset.layers === 'single';
    $('layerModeSeg').querySelectorAll('button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    $('layer2Group').toggleAttribute('hidden', state.singleLayer);
    refreshReadout();
  }),
);
$<HTMLInputElement>('thickness2').addEventListener('input', (e) => {
  state.layer2.thickness = parseFloat((e.target as HTMLInputElement).value);
  $('thickness2Val').textContent = state.layer2.thickness.toFixed(1);
  refreshReadout();
});
$('solarSeg').querySelectorAll('button').forEach((b) =>
  b.addEventListener('click', () => {
    state.solar = (b as HTMLElement).dataset.solar as 'min' | 'max';
    $('solarSeg').querySelectorAll('button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    requestCurves();
    refreshReadout();
  }),
);
$('modeSeg').querySelectorAll('button').forEach((b) =>
  b.addEventListener('click', () => {
    state.mode = (b as HTMLElement).dataset.mode as 'primaries' | 'fragmentation';
    $('modeSeg').querySelectorAll('button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    requestCurves();
    refreshReadout();
  }),
);
$<HTMLInputElement>('thickness').addEventListener('input', (e) => {
  state.thickness = parseFloat((e.target as HTMLInputElement).value);
  $('thicknessVal').textContent = state.thickness.toFixed(1);
  refreshReadout();
});
$<HTMLInputElement>('duration').addEventListener('input', (e) => {
  markCustom();
  state.duration = parseInt((e.target as HTMLInputElement).value, 10);
  $('durationVal').textContent = String(state.duration);
  render();
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
window.addEventListener('resize', () => drawChart());

setStatus('busy', 'COMPUTING');
requestCurves();
worker.postMessage({ type: 'validate' }); // populate the validation panel on load
