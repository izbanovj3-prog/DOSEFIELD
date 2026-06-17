/**
 * DOSEFIELD — Phase 5 (optional): simplified projectile fragmentation.
 *
 * Shows how nuclear fragmentation moves the model TOWARD the measured MSL/RAD value:
 *   (1) ⟨Q⟩ softens toward the measured 3.82 (HZE ions break into lower-LET fragments);
 *   (2) polyethylene's shielding advantage over aluminium GROWS (H-rich → shorter
 *       fragmentation mean free path per g/cm²).
 * Honest about what it does NOT do: produce neutrons / target fragments (the chargeless
 * secondaries that raise the absorbed dose) — so this is not HZETRN.
 */

import { computeShieldedDose } from '../dose/shieldedDose.js';
import { computeFragmentedDose } from '../dose/fragmentedDose.js';
import { computeFreeSpaceDose } from '../dose/doseModel.js';
import { interactionMFP } from '../physics/fragmentation.js';
import { MATERIALS } from '../physics/materials.js';
import { RAD_CRUISE } from '../../data/rad/zeitlin2013.js';
import { W_CRUISE_2012, W_SOLAR_MIN } from '../../data/gcr/matthia2013.js';

const f = (x: number, w: number, d = 3): string => x.toFixed(d).padStart(w);

console.log('='.repeat(80));
console.log('DOSEFIELD — Phase 5 (optional):  simplified projectile fragmentation');
console.log('='.repeat(80));
console.log('Bradt–Peters charge-changing cross-sections; single-collision fragment buildup.');
console.log('Primaries attenuate (λ) and break into lighter, lower-LET fragments at same E/n.');

// --- (0) t=0 consistency ----------------------------------------------------
const free = computeFreeSpaceDose(W_SOLAR_MIN).doseEquivalent_mSv_day;
const frag0 = computeFragmentedDose('aluminum', 0, W_SOLAR_MIN).doseEquivalent_mSv_day;
const dCons = (100 * Math.abs(frag0 - free)) / free;
console.log(`\n  t=0 consistency (fragmented vs primary-only free space): Δ=${dCons.toFixed(2)}%  ${dCons < 1 ? 'PASS' : 'FAIL'}`);

// --- (1) fragmentation mean free path (Fe) ---------------------------------
console.log('\n  IRON (Fe) CHARGE-CHANGING MEAN FREE PATH  λ [g/cm²]:');
for (const m of ['aluminum', 'water', 'polyethylene'] as const) {
  const lam = interactionMFP(55.8, MATERIALS[m]!);
  const surv16 = Math.exp(-16 / lam) * 100;
  console.log(`    ${MATERIALS[m]!.name.padEnd(20)} λ=${f(lam, 6)} g/cm²   → ${f(surv16, 5, 1)}% of Fe survives 16 g/cm²`);
}
console.log('    → hydrogen-rich polyethylene breaks up iron far faster per g/cm² than aluminium.');

// --- (2) RAD point: primary-only vs fragmentation vs measured ---------------
const W = W_CRUISE_2012;
const t = RAD_CRUISE.shielding_gcm2;
const prim = computeShieldedDose('aluminum', t, W);
const frag = computeFragmentedDose('aluminum', t, W);
console.log(`\n  ${t} g/cm² Al @ cruise W=${W}:  model → measured`);
console.log('    quantity            primary-only   +fragmentation     measured (RAD)');
console.log(
  `    absorbed [mGy/d]      ${f(prim.absorbedDose_mGy_day, 8)}      ${f(frag.absorbedDose_mGy_day, 8)}        ${f(RAD_CRUISE.doseRate_mGy_day, 8)}`,
);
console.log(
  `    dose-equiv [mSv/d]    ${f(prim.doseEquivalent_mSv_day, 8)}      ${f(frag.doseEquivalent_mSv_day, 8)}        ${f(RAD_CRUISE.doseEquivalent_mSv_day, 8)}`,
);
console.log(
  `    mean ⟨Q⟩              ${f(prim.meanQ, 8)}      ${f(frag.meanQ, 8)}        ${f(RAD_CRUISE.meanQ, 8)}`,
);
const qTowards = Math.abs(frag.meanQ - RAD_CRUISE.meanQ) < Math.abs(prim.meanQ - RAD_CRUISE.meanQ);
console.log(
  `    → ⟨Q⟩ moves ${qTowards ? 'TOWARD' : 'away from'} measured: ${prim.meanQ.toFixed(2)} → ${frag.meanQ.toFixed(2)} (measured ${RAD_CRUISE.meanQ}). ${qTowards ? 'PASS' : 'FAIL'}`,
);

// --- (3) shielding trend: poly advantage grows with fragmentation -----------
const tt = 20;
const primAl = computeShieldedDose('aluminum', tt, W_SOLAR_MIN).doseEquivalent_mSv_day;
const primPoly = computeShieldedDose('polyethylene', tt, W_SOLAR_MIN).doseEquivalent_mSv_day;
const fragAl = computeFragmentedDose('aluminum', tt, W_SOLAR_MIN).doseEquivalent_mSv_day;
const fragPoly = computeFragmentedDose('polyethylene', tt, W_SOLAR_MIN).doseEquivalent_mSv_day;
const benefitPrim = (1 - primPoly / primAl) * 100;
const benefitFrag = (1 - fragPoly / fragAl) * 100;
console.log(`\n  POLYETHYLENE vs ALUMINIUM advantage at ${tt} g/cm² (solar min):`);
console.log(`    primary-only:     poly ${benefitPrim.toFixed(1)}% better`);
console.log(`    +fragmentation:   poly ${benefitFrag.toFixed(1)}% better`);
const grew = benefitFrag > benefitPrim;
console.log(`    → fragmentation ${grew ? 'WIDENS' : 'does not widen'} polyethylene's advantage. ${grew ? 'PASS' : 'FAIL'}`);

console.log('\n  HONEST LIMITATION:');
console.log('   • ⟨Q⟩ softening and the poly advantage are the robust, parameter-free results.');
console.log('   • Absorbed dose does NOT rise toward 0.46 here: this model omits the secondary');
console.log('     NEUTRONS and target fragments produced in the shield, which carry much of the');
console.log("     RAD dose. Capturing those is exactly HZETRN's job — out of scope by design.");

const gate = dCons < 1 && qTowards && grew;
console.log('\n  GATE: ' + (gate ? 'PASS — fragmentation moves ⟨Q⟩ toward RAD and widens the poly advantage.' : 'FAIL'));
console.log('='.repeat(80));
process.exit(gate ? 0 : 1);
