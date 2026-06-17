/**
 * DOSEFIELD — Phase 3 console validation (headless).
 *
 * Shielding sweep: transport the GCR spectrum through Al / polyethylene / water slabs and
 * report dose-equivalent behind the shield vs areal density. Validates:
 *   (1) t=0 reduces to the Phase-2 free-space result;
 *   (2) SHIELDING TREND (spec validation #3): polyethylene < aluminum at equal g/cm²;
 *   (3) honest read on diminishing returns (primary-only → fragmentation caveat).
 */

import { computeShieldedDose } from '../dose/shieldedDose.js';
import { computeFreeSpaceDose } from '../dose/doseModel.js';
import { getRangeTable } from '../physics/ionRange.js';
import { MATERIALS } from '../physics/materials.js';
import { W_SOLAR_MIN } from '../../data/gcr/matthia2013.js';

const f = (x: number, w: number, d = 3): string => x.toFixed(d).padStart(w);
const W = W_SOLAR_MIN;
const THICKNESSES = [0, 1, 2, 5, 10, 15, 20, 30, 40]; // g/cm²
const MATS = ['aluminum', 'polyethylene', 'water'] as const;

console.log('='.repeat(82));
console.log('DOSEFIELD — Phase 3:  shielding transport (CSDA) — dose-equivalent vs areal density');
console.log('='.repeat(82));
console.log(`GCR @ solar min (W=${W}), primaries only, thin water target behind the shield.`);

// --- (1) Range table cross-check vs NIST PSTAR (proton in Al) -----------------
const pAl = getRangeTable(1, 1, MATERIALS.aluminum!);
console.log('\n  RANGE-TABLE CROSS-CHECK (proton in Al) vs NIST PSTAR:');
console.log(
  `    R(100 MeV)  = ${f(pAl.rangeAtEnergy(100), 8)} g/cm²   (PSTAR 10.01)   ` +
    `R(1000 MeV) = ${f(pAl.rangeAtEnergy(1000), 8)} g/cm²  (PSTAR 412.4)`,
);

// --- (2) t=0 consistency with Phase 2 ----------------------------------------
const free = computeFreeSpaceDose(W);
const shield0 = computeShieldedDose('aluminum', 0, W);
const dConsist = (100 * Math.abs(shield0.doseEquivalent_mSv_day - free.doseEquivalent_mSv_day)) / free.doseEquivalent_mSv_day;
console.log('\n  t=0 CONSISTENCY (shielded transport vs Phase-2 free space):');
console.log(
  `    free space H = ${f(free.doseEquivalent_mSv_day, 7)} mSv/day,  transport t=0 H = ${f(shield0.doseEquivalent_mSv_day, 7)} mSv/day,  Δ = ${dConsist.toFixed(2)}%  ${dConsist < 1 ? 'PASS' : 'FAIL'}`,
);

// --- (3) Dose-equivalent vs thickness, all three materials -------------------
console.log('\n  DOSE-EQUIVALENT H [mSv/day] vs SHIELD AREAL DENSITY [g/cm²]:');
console.log('    t(g/cm²)     Al        poly       water     |  poly/Al   poly vs Al');
const H: Record<string, number[]> = { aluminum: [], polyethylene: [], water: [] };
for (const t of THICKNESSES) {
  const row: Record<string, number> = {};
  for (const m of MATS) {
    const r = computeShieldedDose(m, t, W);
    row[m] = r.doseEquivalent_mSv_day;
    H[m]!.push(r.doseEquivalent_mSv_day);
  }
  const ratio = row.polyethylene! / row.aluminum!;
  const verdict = t === 0 ? '' : row.polyethylene! < row.aluminum! ? 'poly lower ✓' : 'poly HIGHER ✗';
  console.log(
    `    ${f(t, 6, 0)}    ${f(row.aluminum!, 8)}  ${f(row.polyethylene!, 9)}  ${f(row.water!, 9)}  |  ${f(ratio, 6)}   ${verdict}`,
  );
}

// --- (4) Shielding-trend validation (spec #3): poly < Al at equal g/cm² ------
const checkT = [5, 10, 15, 20, 30, 40];
const polyWins = checkT.every((t) => {
  const i = THICKNESSES.indexOf(t);
  return H.polyethylene![i]! < H.aluminum![i]!;
});
console.log('\n' + '-'.repeat(82));
console.log('  VALIDATION #3 — SHIELDING TREND (polyethylene < aluminum at equal areal density):');
console.log(`    ${polyWins ? 'PASS' : 'FAIL'} — polyethylene gives lower dose-equivalent than aluminum at every t≥5 g/cm².`);
const i20 = THICKNESSES.indexOf(20);
const benefit20 = (1 - H.polyethylene![i20]! / H.aluminum![i20]!) * 100;
console.log(`    At 20 g/cm², polyethylene beats aluminum by ${benefit20.toFixed(1)}% (primary-only).`);

// --- (5) Diminishing returns & honesty ---------------------------------------
const i0 = 0;
const i40 = THICKNESSES.indexOf(40);
const alReduction = (1 - H.aluminum![i40]! / H.aluminum![i0]!) * 100;
console.log('\n  DIMINISHING RETURNS (aluminum):');
console.log(
  `    H(0)=${f(H.aluminum![i0]!, 5)} → H(40 g/cm²)=${f(H.aluminum![i40]!, 5)} mSv/day ` +
    `(only ${alReduction.toFixed(0)}% reduction across 40 g/cm²).`,
);
console.log('    GCR dose-equivalent is hard to shield: slowing primaries raises their LET/Q,');
console.log('    partly offsetting flux loss. HONEST CAVEAT: this primary-only model UNDER-states');
console.log("    polyethylene's true advantage, which also comes from its lower nuclear");
console.log('    fragmentation (fewer/lighter secondaries) — that is Phase 5, not modeled here.');

console.log('\n' + '='.repeat(82));
console.log(`Phase 3 shielding transport operational. Trend poly<Al: ${polyWins ? 'reproduced.' : 'NOT reproduced.'}`);
console.log('='.repeat(82));

process.exit(polyWins && dConsist < 1 ? 0 : 1);
