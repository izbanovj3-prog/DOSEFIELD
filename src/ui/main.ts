/**
 * DOSEFIELD dosimeter UI. Controls → worker computes dose-vs-thickness curves (Al/poly/water);
 * the slider readout interpolates the active curve (instant), and the canvas plots all three.
 */
import './styles.css';
import type { CurvePoint, CurveSeries, ValidationData } from './dose.worker.js';

const NASA_CAREER_LIMIT_MSV = 600; // NASA-STD-3001 career effective-dose limit

const TRACE = { aluminum: '#ffb000', polyethylene: '#46e06a', water: '#38bdf8', hydrogen: '#ff79c6' } as const;

interface State {
  material: keyof typeof TRACE;
  thickness: number;
  solar: 'min' | 'max';
  mode: 'primaries' | 'fragmentation';
  duration: number;
}
const state: State = { material: 'aluminum', thickness: 10, solar: 'min', mode: 'primaries', duration: 360 };

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
  } else if (msg.type === 'validate') {
    renderValidation(msg.data);
    renderStrip(msg.data);
  }
};

// ---- rendering -------------------------------------------------------------
function render(): void {
  if (!curves) return;
  const pts = curves[state.material]!;
  const cur = interp(pts, state.thickness);

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
  for (const m of ['aluminum', 'polyethylene', 'water', 'hydrogen'] as const) {
    const pts = curves[m]!;
    ctx.strokeStyle = TRACE[m];
    ctx.lineWidth = m === state.material ? 2.6 : 1.5;
    ctx.globalAlpha = m === state.material ? 1 : 0.62;
    ctx.beginPath();
    pts.forEach((p, i) => { const x = xOf(p.t); const y = yOf(p.H); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // current-thickness marker
  const cur = interp(curves[state.material]!, state.thickness);
  const mx = xOf(state.thickness);
  const my = yOf(cur.H);
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
      'Polyethylene < aluminium at equal areal density',
      `poly better by up to ${f(d.trendWorst, 1)}%`,
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

// ---- wiring ----------------------------------------------------------------
$('materialSeg').querySelectorAll('button').forEach((b) =>
  b.addEventListener('click', () => {
    state.material = (b as HTMLElement).dataset.mat as keyof typeof TRACE;
    $('materialSeg').querySelectorAll('button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    render();
  }),
);
$('solarSeg').querySelectorAll('button').forEach((b) =>
  b.addEventListener('click', () => {
    state.solar = (b as HTMLElement).dataset.solar as 'min' | 'max';
    $('solarSeg').querySelectorAll('button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    requestCurves();
  }),
);
$('modeSeg').querySelectorAll('button').forEach((b) =>
  b.addEventListener('click', () => {
    state.mode = (b as HTMLElement).dataset.mode as 'primaries' | 'fragmentation';
    $('modeSeg').querySelectorAll('button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    requestCurves();
  }),
);
$<HTMLInputElement>('thickness').addEventListener('input', (e) => {
  state.thickness = parseFloat((e.target as HTMLInputElement).value);
  $('thicknessVal').textContent = state.thickness.toFixed(1);
  render();
});
$<HTMLInputElement>('duration').addEventListener('input', (e) => {
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
