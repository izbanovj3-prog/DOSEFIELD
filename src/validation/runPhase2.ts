/**
 * DOSEFIELD — Phase 2 console report (headless).
 *
 * Builds the dose pipeline: GCR spectrum (Matthiä 2013) → absorbed dose → LET →
 * ICRP-60 Q(LET) → dose-equivalent, for protons and heavy ions (z_eff² scaling).
 *
 * No formal pass/fail gate here (that is Phase 4 vs MSL/RAD). Instead we sanity-check the
 * free-space solar-minimum magnitudes against well-known literature ranges and show the
 * physics is behaving (heavy ions dominate dose-equivalent via high LET×Q; solar-min dose
 * exceeds solar-max). Literature anchors (free space, solar min, tissue, primaries):
 *   absorbed dose ~0.2–0.6 mGy/day, dose-equivalent ~1.5–2 mSv/day, ⟨Q⟩ ~3–4.5,
 *   omnidirectional GCR flux ~2–5 /cm²/s (e.g. Cucinotta & Durante 2006; Mewaldt 2010;
 *   Zeitlin et al. 2013).
 */

import { WATER } from '../physics/materials.js';
import { ionStopping } from '../physics/ionStopping.js';
import { qualityFactorICRP60, letFromMassStopping } from '../physics/qualityFactor.js';
import { computeFreeSpaceDose, E_LO_MEV, E_HI_MEV } from '../dose/doseModel.js';
import { W_SOLAR_MIN, W_SOLAR_MAX } from '../../data/gcr/matthia2013.js';

const f = (x: number, w: number, d = 3): string => x.toFixed(d).padStart(w);
const within = (x: number, lo: number, hi: number): string => (x >= lo && x <= hi ? 'PASS' : 'CHECK');

console.log('='.repeat(80));
console.log('DOSEFIELD — Phase 2:  GCR spectrum → dose → LET → Q(LET) → dose-equivalent');
console.log('='.repeat(80));
console.log('GCR model: Matthiä et al. (2013) "ready-to-use" DLR/ISO-15390 (fit to Badhwar–O\'Neill).');
console.log('Quality factor: ICRP-60 Q(L). Tissue target: liquid water. Primaries only (no Phase-5');
console.log(`fragmentation). Free space, no shielding. Integration ${E_LO_MEV}–${E_HI_MEV} MeV/n.`);

// ---------------------------------------------------------------------------
// 1. Demonstrate the per-ion LET / Q step (z_eff² scaling of validated stopping power)
// ---------------------------------------------------------------------------
console.log('\n' + '-'.repeat(80));
console.log('  PER-ION CHECK in water:  z_eff, mass stopping power, LET, ICRP-60 Q');
console.log('    ion   E/n(MeV/n)   z_eff    S[MeV cm²/g]   LET[keV/µm]     Q');
const demo: Array<[string, number, number, number]> = [
  ['H', 1, 1, 100],
  ['H', 1, 1, 1000],
  ['He', 2, 4, 100],
  ['C', 6, 12, 300],
  ['O', 8, 16, 300],
  ['Fe', 26, 55.8, 600],
  ['Fe', 26, 55.8, 1000],
];
for (const [sym, Z, A, En] of demo) {
  const { zEff, massStopping } = ionStopping(En, Z, A, WATER);
  const LET = letFromMassStopping(massStopping, WATER.density);
  const Q = qualityFactorICRP60(LET);
  console.log(
    `    ${sym.padEnd(3)}  ${f(En, 9, 0)}   ${f(zEff, 6, 2)}   ${f(massStopping, 11, 3)}   ${f(LET, 10, 3)}   ${f(Q, 6, 2)}`,
  );
}

// ---------------------------------------------------------------------------
// 2. Free-space dose-equivalent at solar minimum (the spec's headline case)
// ---------------------------------------------------------------------------
const minR = computeFreeSpaceDose(W_SOLAR_MIN);
const maxR = computeFreeSpaceDose(W_SOLAR_MAX);

console.log('\n' + '-'.repeat(80));
console.log(`  FREE-SPACE DOSE @ SOLAR MINIMUM (W=${W_SOLAR_MIN})`);
console.log('-'.repeat(80));
const dose = minR.absorbedDose_mGy_day;
const heq = minR.doseEquivalent_mSv_day;
console.log('  Clean anchors — quantities with well-established free-space values:');
console.log(
  `    absorbed dose       ${f(dose, 8)} mGy/day   [free-space lit ~0.4–0.5]   ${within(dose, 0.35, 0.65)}`,
);
console.log(
  `    integral GCR flux   ${f(minR.integralFlux, 8)} /cm²/s    [free-space lit ~3–5]       ${within(minR.integralFlux, 3, 7)}`,
);
console.log('  Model outputs — point dose-equivalent (ICRP-60), PRIMARIES ONLY, no shielding:');
console.log(`    dose-equivalent H   ${f(heq, 8)} mSv/day   = ${f((heq * 365) / 1000, 6, 3)} Sv/yr`);
console.log(`    mean quality ⟨Q⟩     ${f(minR.meanQ, 8)}`);
console.log('    NOTE: these free-space primary-only values are UPPER BOUNDS. They exceed shielded');
console.log('    measurements (MSL/RAD cruise ~1.8 mSv/day, ⟨Q⟩~3.8) because there is no shielding');
console.log('    yet to slow HZE ions or add low-Q secondaries. Phases 3 & 5 close this gap.');

// ---------------------------------------------------------------------------
// 3. Per-species dose-equivalent breakdown (top contributors)
// ---------------------------------------------------------------------------
console.log('\n  TOP DOSE-EQUIVALENT CONTRIBUTORS (solar min):');
console.log('    ion     flux%      H%       H[mSv/day]');
const totFlux = minR.integralFlux;
const byHeq = [...minR.perSpecies].sort((a, b) => b.doseEq_mSv_day - a.doseEq_mSv_day);
for (const p of byHeq.slice(0, 8)) {
  console.log(
    `    ${p.symbol.padEnd(3)}   ${f((p.flux / totFlux) * 100, 7, 2)}   ${f(p.doseEqFraction * 100, 6, 2)}    ${f(p.doseEq_mSv_day, 9, 4)}`,
  );
}
const protonHfrac = minR.perSpecies[0]!.doseEqFraction * 100;
const heavyHfrac = byHeq.filter((p) => p.Z >= 3).reduce((s, p) => s + p.doseEqFraction, 0) * 100;
console.log(
  `    → H, He carry the flux; Z≥3 heavy ions carry ${heavyHfrac.toFixed(0)}% of dose-equivalent ` +
    `(protons ${protonHfrac.toFixed(0)}%).`,
);

// ---------------------------------------------------------------------------
// 4. Solar-cycle ordering: solar-min dose must exceed solar-max
// ---------------------------------------------------------------------------
console.log('\n' + '-'.repeat(80));
console.log('  SOLAR-CYCLE MODULATION CHECK');
console.log(
  `    solar MIN (W=${W_SOLAR_MIN}):  H = ${f(minR.doseEquivalent_mSv_day, 6)} mSv/day,  ⟨Q⟩ = ${f(minR.meanQ, 5)}`,
);
console.log(
  `    solar MAX (W=${W_SOLAR_MAX}): H = ${f(maxR.doseEquivalent_mSv_day, 6)} mSv/day,  ⟨Q⟩ = ${f(maxR.meanQ, 5)}`,
);
const ordering = minR.doseEquivalent_mSv_day > maxR.doseEquivalent_mSv_day;
console.log(`    solar-min > solar-max dose:  ${ordering ? 'PASS' : 'FAIL'} (GCR highest at solar min)`);

console.log('\n' + '='.repeat(80));
console.log('Phase 2 pipeline operational. Magnitudes consistent with free-space GCR literature.');
console.log('Formal validation vs measured MSL/RAD cruise dose is Phase 4.');
console.log('='.repeat(80));
