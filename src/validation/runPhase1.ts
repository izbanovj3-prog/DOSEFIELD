/**
 * DOSEFIELD — Phase 1 validation harness (headless).
 *
 * Validation gate (project spec): proton electronic stopping power and CSDA range from the
 * Bethe–Bloch engine must agree with NIST PSTAR within a few percent BEFORE any dose code.
 *
 * Two checks per material, against PSTAR data pulled on 2026-06-16:
 *   1. Stopping power:   S_model(E)  vs  PSTAR electronic stopping power.
 *   2. Range increment:  ∫_{E0}^{E} dE/S_model  vs  R_PSTAR(E) − R_PSTAR(E0).
 *      (We validate the range *increment* above E0 = 1 MeV because the Bethe formula is
 *       not valid below ~1 MeV; the 0→1 MeV part of the absolute range is PSTAR's, not ours.)
 *
 * Exit code 0 if every point passes, 1 otherwise (suitable for CI).
 */

import { MATERIALS } from '../physics/materials.js';
import { electronicMassStoppingPower } from '../physics/stoppingPower.js';
import { csdaRangeIncrement } from '../physics/range.js';
import { PSTAR_DATASETS } from '../../data/pstar/index.js';

/** Acceptance threshold (%). "Within a few percent" per the project spec. */
const PASS_PCT = 5.0;
/** Energy (MeV) at/above which Bethe is solidly valid; we report a tighter stat here. */
const SOLID_MEV = 10;

const pct = (model: number, ref: number): number => ((model - ref) / ref) * 100;
const f = (x: number, w: number, d = 3): string => x.toFixed(d).padStart(w);
const tag = (ok: boolean): string => (ok ? 'PASS' : 'FAIL');

interface Stat {
  maxAbsAll: number;
  maxAbsSolid: number;
  fails: number;
  total: number;
}
const emptyStat = (): Stat => ({ maxAbsAll: 0, maxAbsSolid: 0, fails: 0, total: 0 });
function record(s: Stat, errPct: number, E: number, ok: boolean): void {
  s.total++;
  if (!ok) s.fails++;
  s.maxAbsAll = Math.max(s.maxAbsAll, Math.abs(errPct));
  if (E >= SOLID_MEV) s.maxAbsSolid = Math.max(s.maxAbsSolid, Math.abs(errPct));
}

const spStat = emptyStat();
const rgStat = emptyStat();

console.log('='.repeat(78));
console.log('DOSEFIELD — Phase 1 validation:  Bethe–Bloch engine vs NIST PSTAR (protons)');
console.log('='.repeat(78));
console.log(`Acceptance: |error| <= ${PASS_PCT.toFixed(1)}%   (model: Bethe–Bloch + Sternheimer`);
console.log('density effect; shell / Barkas / Bloch corrections omitted — labeled in code.)');

for (const key of Object.keys(PSTAR_DATASETS) as (keyof typeof PSTAR_DATASETS)[]) {
  const ds = PSTAR_DATASETS[key];
  const mat = MATERIALS[key]!;
  const pts = ds.points;

  console.log('\n' + '-'.repeat(78));
  console.log(`${ds.material}   (I = ${ds.I_eV} eV,  <Z/A> = ${mat.ZoverA.toFixed(5)} mol/g)`);
  console.log(`source: ${ds.source}  |  matno ${ds.matno}`);
  console.log('-'.repeat(78));

  // --- Check 1: electronic stopping power ---
  console.log('  STOPPING POWER  [MeV·cm²/g]');
  console.log('    E(MeV)     model      PSTAR     err%   result');
  for (const p of pts) {
    const model = electronicMassStoppingPower(p.T_MeV, mat);
    const e = pct(model, p.electronic);
    const ok = Math.abs(e) <= PASS_PCT;
    record(spStat, e, p.T_MeV, ok);
    console.log(
      `    ${f(p.T_MeV, 6, 0)}  ${f(model, 9)}  ${f(p.electronic, 9)}  ${f(e, 6, 2)}   ${tag(ok)}`,
    );
  }

  // --- Check 2: CSDA range increment above E0 = pts[0] ---
  const E0 = pts[0]!.T_MeV;
  const R0 = pts[0]!.csdaRange;
  console.log(`  CSDA RANGE INCREMENT  ΔR above ${E0} MeV  [g/cm²]`);
  console.log('    E(MeV)     model      PSTAR     err%   result');
  for (const p of pts.slice(1)) {
    const model = csdaRangeIncrement(E0, p.T_MeV, mat);
    const ref = p.csdaRange - R0;
    const e = pct(model, ref);
    const ok = Math.abs(e) <= PASS_PCT;
    record(rgStat, e, p.T_MeV, ok);
    console.log(
      `    ${f(p.T_MeV, 6, 0)}  ${f(model, 9, 4)}  ${f(ref, 9, 4)}  ${f(e, 6, 2)}   ${tag(ok)}`,
    );
  }
}

console.log('\n' + '='.repeat(78));
console.log('SUMMARY');
console.log(
  `  Stopping power:  ${spStat.total - spStat.fails}/${spStat.total} pass | ` +
    `max|err| = ${spStat.maxAbsAll.toFixed(2)}% (all), ` +
    `${spStat.maxAbsSolid.toFixed(2)}% (E>=${SOLID_MEV} MeV)`,
);
console.log(
  `  Range (ΔR):      ${rgStat.total - rgStat.fails}/${rgStat.total} pass | ` +
    `max|err| = ${rgStat.maxAbsAll.toFixed(2)}% (all), ` +
    `${rgStat.maxAbsSolid.toFixed(2)}% (E>=${SOLID_MEV} MeV)`,
);

const allPass = spStat.fails === 0 && rgStat.fails === 0;
console.log('\n  GATE: ' + (allPass ? 'PASS — Phase 1 physics validated against NIST PSTAR.' : 'FAIL'));
console.log('='.repeat(78));

process.exit(allPass ? 0 : 1);
