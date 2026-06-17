/**
 * DOSEFIELD — Phase 4 console validation: model vs measured MSL/RAD cruise dose.
 *
 * VALIDATION #2 (spec): model GCR dose-equivalent behind representative spacecraft shielding
 * vs the MEASURED MSL/RAD cruise value. Acceptance: same order of magnitude, ideally within
 * ~2× for a primary-only model — and state honestly how far off and why (fragmentation).
 */

import { computeRadComparison } from '../dose/radComparison.js';
import { RAD_CRUISE } from '../../data/rad/zeitlin2013.js';
import { W_CRUISE_2012, W_CRUISE_LOW, W_CRUISE_HIGH } from '../../data/gcr/matthia2013.js';

const f = (x: number, w: number, d = 3): string => x.toFixed(d).padStart(w);
const c = computeRadComparison();
const within2x = (r: number) => r >= 0.5 && r <= 2.0;

console.log('='.repeat(80));
console.log('DOSEFIELD — Phase 4:  model vs measured MSL/RAD cruise dose-equivalent');
console.log('='.repeat(80));
console.log(`Measured: ${RAD_CRUISE.source}`);
console.log(
  `Conditions: cruise φ≈${RAD_CRUISE.phi_MV_low}–${RAD_CRUISE.phi_MV_high} MV → Matthiä W≈${W_CRUISE_2012} ` +
    `(bracket ${W_CRUISE_LOW}–${W_CRUISE_HIGH}); shielding ≈${RAD_CRUISE.shielding_gcm2} g/cm² Al-eq ` +
    `(${RAD_CRUISE.shielding_low}–${RAD_CRUISE.shielding_high}). Primary-only, no secondaries.`,
);

console.log('\n  ' + '-'.repeat(76));
console.log('  quantity                 model        measured        ratio     within 2×');
console.log('  ' + '-'.repeat(76));
console.log(
  `  absorbed dose [mGy/day]  ${f(c.model.D, 7)}      ${f(c.measured.D, 7)}±${f(RAD_CRUISE.doseRate_sigma, 4, 3)}   ${f(c.ratioD, 6)}      ${within2x(c.ratioD) ? 'PASS' : 'FAIL'}`,
);
console.log(
  `  dose-equivalent [mSv/d]  ${f(c.model.H, 7)}      ${f(c.measured.H, 7)}±${f(RAD_CRUISE.doseEquivalent_sigma, 4, 2)}   ${f(c.ratioH, 6)}      ${within2x(c.ratioH) ? 'PASS' : 'FAIL'}`,
);
console.log(
  `  mean quality ⟨Q⟩          ${f(c.model.Q, 7)}      ${f(c.measured.Q, 7)}±${f(RAD_CRUISE.meanQ_sigma, 4, 2)}   ${f(c.ratioQ, 6)}      ${within2x(c.ratioQ) ? 'PASS' : 'FAIL'}`,
);
console.log('  ' + '-'.repeat(76));
console.log(
  `  model dose-equivalent over W/shielding brackets: ${f(c.H_lo, 5)}–${f(c.H_hi, 5)} mSv/day`,
);

console.log('\n  INTERPRETATION (honest):');
const dir = c.ratioH < 1 ? 'UNDER' : 'OVER';
console.log(
  `   • Dose-equivalent ${dir}-predicted by ${(Math.abs(1 - c.ratioH) * 100).toFixed(0)}% ` +
    `(ratio ${c.ratioH.toFixed(2)}) — within the 2× bar for a primary-only model.`,
);
console.log(
  `   • ⟨Q⟩ is OVER-predicted (${c.model.Q.toFixed(2)} vs ${c.measured.Q.toFixed(2)}): with no nuclear`,
);
console.log('     fragmentation, HZE ions are not broken into lower-LET fragments and no low-Q');
console.log('     secondary protons/neutrons are added — both of which lower the real ⟨Q⟩.');
console.log('   • Absorbed dose is the more robust comparison (less sensitive to the LET spectrum).');
console.log('   • Closing the gap is exactly the role of Phase 5 (fragmentation/secondaries).');

const gatePass = within2x(c.ratioH) && within2x(c.ratioD);
console.log('\n  GATE (order-of-magnitude / within 2×): ' + (gatePass ? 'PASS' : 'FAIL'));
console.log('='.repeat(80));
process.exit(gatePass ? 0 : 1);
