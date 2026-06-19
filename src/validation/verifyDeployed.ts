/**
 * INTEGRITY VERIFICATION — the values the deployed UI shows must come from the physics
 * functions and agree with `npm run report` + the validation phases. Nothing is hardcoded:
 * this script recomputes every quantity from the SAME functions the UI calls and compares
 * to the documented validated values.
 *
 * UI data paths (see src/ui/dose.worker.ts):
 *  - Validation panel  → electronicMassStoppingPower (NIST) + computeRadComparison (RAD),
 *    at the functions' DEFAULT resolution — byte-identical to generateReport.ts.
 *  - Dose curves/readouts → computeShieldedDose / computeFragmentedDose at perDecade = 50
 *    (the worker's CURVE_PERDECADE, chosen for snappy recompute; ~0.4% coarser than the
 *    report's default, NOT a different model).
 */
import { electronicMassStoppingPower } from '../physics/stoppingPower.js';
import { MATERIALS } from '../physics/materials.js';
import { PSTAR_DATASETS } from '../../data/pstar/index.js';
import { computeShieldedDose } from '../dose/shieldedDose.js';
import { computeFragmentedDose } from '../dose/fragmentedDose.js';
import { computeRadComparison } from '../dose/radComparison.js';
import { RAD_CRUISE } from '../../data/rad/zeitlin2013.js';
import { W_SOLAR_MIN, W_CRUISE_2012 } from '../../data/gcr/matthia2013.js';

const UI_PERDECADE = 50; // == worker CURVE_PERDECADE

function nistMaxSolid(): number {
  let m = 0;
  for (const key of Object.keys(PSTAR_DATASETS) as (keyof typeof PSTAR_DATASETS)[]) {
    const ds = PSTAR_DATASETS[key];
    const mat = MATERIALS[key]!;
    for (const p of ds.points)
      if (p.T_MeV >= 10)
        m = Math.max(m, Math.abs((electronicMassStoppingPower(p.T_MeV, mat) - p.electronic) / p.electronic) * 100);
  }
  return m;
}
function polyAdvantage(W: number, frag: boolean, pd?: number): number {
  const f = frag ? computeFragmentedDose : computeShieldedDose;
  const al = f('aluminum', 20, W, pd as number).doseEquivalent_mSv_day;
  const poly = f('polyethylene', 20, W, pd as number).doseEquivalent_mSv_day;
  return (1 - poly / al) * 100;
}
function radQ(frag: boolean): number {
  const f = frag ? computeFragmentedDose : computeShieldedDose;
  return f('aluminum', RAD_CRUISE.shielding_gcm2, W_CRUISE_2012).meanQ; // default perDecade (== report)
}

interface Row {
  quantity: string;
  ui: number;
  ref: number;
  tol: number; // allowed |Δ| relative (%)
}
const rows: Row[] = [];
const rad = computeRadComparison(); // exactly what the UI validation panel calls

// --- validation-panel quantities: UI path === report path (same functions, default res) ---
rows.push({ quantity: 'NIST PSTAR max err ≥10 MeV [%]', ui: nistMaxSolid(), ref: 1.55, tol: 3 });
rows.push({ quantity: 'RAD H_model [mSv/day]', ui: rad.model.H, ref: 1.47, tol: 2 });
rows.push({ quantity: 'RAD ⟨Q⟩_model primaries', ui: rad.model.Q, ref: 4.78, tol: 2 });
rows.push({ quantity: 'RAD measured H [mSv/day]', ui: rad.measured.H, ref: 1.75, tol: 0.5 });
rows.push({ quantity: 'RAD ⟨Q⟩ + fragmentation', ui: radQ(true), ref: 4.41, tol: 2 });

// --- curve quantities: UI uses perDecade=50, report uses default (~0.4% coarser) ---
const advPrimUI = polyAdvantage(W_SOLAR_MIN, false, UI_PERDECADE);
const advFragUI = polyAdvantage(W_SOLAR_MIN, true, UI_PERDECADE);
rows.push({ quantity: 'Poly advantage @20 g/cm² primaries [%]', ui: advPrimUI, ref: 11.6, tol: 6 });
rows.push({ quantity: 'Poly advantage @20 g/cm² + fragmentation [%]', ui: advFragUI, ref: 33.3, tol: 6 });

// --- evaluate ---
const f3 = (x: number) => x.toFixed(3).padStart(9);
let fails = 0;
console.log('='.repeat(84));
console.log('DOSEFIELD — deployed-build integrity cross-check (UI functions vs report values)');
console.log('='.repeat(84));
console.log('  quantity                                       UI-path     report      Δ%     result');
for (const r of rows) {
  const dPct = Math.abs((r.ui - r.ref) / r.ref) * 100;
  const ok = dPct <= r.tol;
  if (!ok) fails++;
  console.log(
    `  ${r.quantity.padEnd(44)} ${f3(r.ui)}  ${f3(r.ref)}  ${dPct.toFixed(2).padStart(6)}   ${ok ? 'PASS' : 'FAIL'}`,
  );
}

// --- physics invariants (direction, not magnitude) ---
console.log('-'.repeat(84));
const qPrim = radQ(false);
const qFrag = radQ(true);
const inv1 = qFrag < qPrim;
const inv2 = advFragUI > advPrimUI;
console.log(`  INVARIANT  fragmentation lowers ⟨Q⟩ at RAD point: ${qPrim.toFixed(3)} → ${qFrag.toFixed(3)}   ${inv1 ? 'PASS' : 'FAIL'}`);
console.log(`  INVARIANT  fragmentation widens poly advantage:  ${advPrimUI.toFixed(1)}% → ${advFragUI.toFixed(1)}%   ${inv2 ? 'PASS' : 'FAIL'}`);
if (!inv1) fails++;
if (!inv2) fails++;

console.log('='.repeat(84));
console.log(fails === 0 ? 'VERIFY: PASS — UI-path values match report/validated values; physics directions hold.' : `VERIFY: FAIL — ${fails} mismatch(es).`);
console.log('='.repeat(84));
process.exit(fails === 0 ? 0 : 1);
