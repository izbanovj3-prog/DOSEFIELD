/**
 * Reproduce every number used in Paper 1 (DOSEFIELD manuscript, LSSR submission) from the
 * committed code, and write them to ONE file (default: paper1_results.json).
 *
 *   npx tsx scripts/reproduce_paper1.ts [out.json]
 *
 * Pure recomputation: no network, no fitting, no constant is changed. Figures are drawn from this
 * file by the plotting scripts deposited with the manuscript. Sensitivity runs that require editing a
 * constant (Bradt–Peters r0/b, 10 vs 11 MeV/n floor, 1e5 vs 1e6 MeV/n ceiling) are NOT done here —
 * they are documented in the Paper-1 DEVLOG with the exact edits.
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { MATERIALS, WATER } from '../src/physics/materials.js';
import { electronicMassStoppingPower } from '../src/physics/stoppingPower.js';
import { csdaRangeIncrement } from '../src/physics/range.js';
import { ionStopping } from '../src/physics/ionStopping.js';
import { interactionMFP } from '../src/physics/fragmentation.js';
import { PSTAR_DATASETS } from '../data/pstar/index.js';
import { computeFreeSpaceDose } from '../src/dose/doseModel.js';
import { computeShieldedDose } from '../src/dose/shieldedDose.js';
import { computeFragmentedDose } from '../src/dose/fragmentedDose.js';
import { computeMultiLayerDose, computeMultiLayerFragmentedDose } from '../src/dose/multiLayerDose.js';
import { computeRadComparison } from '../src/dose/radComparison.js';
import { computeNistStoppingSummary, computeShieldingTrendSummary } from '../src/validation/validationSummary.js';
import { doseRelUncertainty, GCR_FLUX_REL_UNC, STOPPING_REL_UNC_ICRU } from '../src/validation/uncertainty.js';
import { RAD_CRUISE } from '../data/rad/zeitlin2013.js';
import { W_CRUISE_2012_UNMASKED, W_CRUISE_FULL_UNMASKED, OULU_MEAN_ZEITLIN_WINDOW_SEP_MASKED_PER_MIN, OULU_MEAN_FULL_CRUISE_SEP_MASKED_PER_MIN, W_CRUISE_2012, W_CRUISE_FULL, W_CRUISE_LOW, W_CRUISE_HIGH, W_CRUISE_LEGACY_30, wFromOuluCountsPerSecond, wFromOuluCountsPerMinute, OULU_MEAN_ZEITLIN_WINDOW_PER_MIN, OULU_MEAN_FULL_CRUISE_PER_MIN } from '../data/gcr/matthia2013.js';

import { ASTAR_HELIUM, ASTAR_RETRIEVED_UTC } from '../data/astar/helium.js';
import { LEAD, TITANIUM } from '../src/physics/materials.js';
import { PSTAR_LEAD, PSTAR_TITANIUM } from '../data/pstar/index.js';

const out: any = {};
// 1. PSTAR comparison, every point
out.pstar = [];
for (const key of Object.keys(PSTAR_DATASETS) as (keyof typeof PSTAR_DATASETS)[]) {
  const ds = PSTAR_DATASETS[key]; const mat = MATERIALS[key]!;
  const E0 = ds.points[0]!.T_MeV, R0 = ds.points[0]!.csdaRange;
  for (const p of ds.points) {
    const S = electronicMassStoppingPower(p.T_MeV, mat);
    const dR = p.T_MeV > E0 ? csdaRangeIncrement(E0, p.T_MeV, mat) : null;
    out.pstar.push({ material: key, T_MeV: p.T_MeV, S_model: S, S_pstar: p.electronic,
      dev_pct: (S - p.electronic) / p.electronic * 100,
      dR_model: dR, dR_pstar: p.T_MeV > E0 ? p.csdaRange - R0 : null,
      dR_dev_pct: dR === null ? null : (dR - (p.csdaRange - R0)) / (p.csdaRange - R0) * 100 });
  }
}
out.nistSummary = computeNistStoppingSummary();
// 2. heavy-ion model stopping (no NIST reference exists for C/Fe; He would need ASTAR)
out.ions = [];
const IONS: [string, number, number][] = [['H',1,1.0],['He',2,4.0],['C',6,12.0],['Fe',26,55.8]];
const EN = [1,2,5,10,20,50,100,250,500,1000,1e4,1e5];
for (const key of Object.keys(MATERIALS)) for (const [sym,Z,A] of IONS) for (const En of EN) {
  const r = ionStopping(En, Z, A, MATERIALS[key]!);
  out.ions.push({ material: key, ion: sym, Z, A, E_MeV_per_n: En, beta: r.beta, zEff: r.zEff, S_model: r.massStopping,
     S_over_Z2_S_H: r.massStopping / (Z*Z*ionStopping(En,1,1.0,MATERIALS[key]!).massStopping) });
}
// 3. RAD comparison
const unc = doseRelUncertainty(out.nistSummary.maxSolidPct / 100);
out.unc = { total: unc, gcr: GCR_FLUX_REL_UNC, stopping: STOPPING_REL_UNC_ICRU, impl: out.nistSummary.maxSolidPct/100 };
out.rad = computeRadComparison();
out.radMeasured = RAD_CRUISE;
out.W = { headline: W_CRUISE_2012, full: W_CRUISE_FULL, low: W_CRUISE_LOW, high: W_CRUISE_HIGH, legacy: W_CRUISE_LEGACY_30, at108cps: wFromOuluCountsPerSecond(108), ouluZeitlin: OULU_MEAN_ZEITLIN_WINDOW_PER_MIN, ouluFull: OULU_MEAN_FULL_CRUISE_PER_MIN, check: wFromOuluCountsPerMinute(6480) };
out.W.headlineUnmasked = W_CRUISE_2012_UNMASKED; out.W.fullUnmasked = W_CRUISE_FULL_UNMASKED; out.W.ouluZeitlinMasked = OULU_MEAN_ZEITLIN_WINDOW_SEP_MASKED_PER_MIN; out.W.ouluFullMasked = OULU_MEAN_FULL_CRUISE_SEP_MASKED_PER_MIN;
out.radFrag = computeFragmentedDose('aluminum', RAD_CRUISE.shielding_gcm2, W_CRUISE_2012);
out.radFull = { prim: computeShieldedDose('aluminum', 16, W_CRUISE_FULL), frag: computeFragmentedDose('aluminum', 16, W_CRUISE_FULL) };
out.radUnmasked = { prim: computeShieldedDose('aluminum', 16, W_CRUISE_2012_UNMASKED), frag: computeFragmentedDose('aluminum', 16, W_CRUISE_2012_UNMASKED) };
out.radFullUnmasked = { prim: computeShieldedDose('aluminum', 16, W_CRUISE_FULL_UNMASKED), frag: computeFragmentedDose('aluminum', 16, W_CRUISE_FULL_UNMASKED) };
out.radLegacy = { prim: computeShieldedDose('aluminum', 16, W_CRUISE_LEGACY_30), frag: computeFragmentedDose('aluminum', 16, W_CRUISE_LEGACY_30) };
for (const k of ['radFull','radLegacy','radUnmasked','radFullUnmasked']) for (const m of ['prim','frag']) { const r = out[k][m]; out[k][m] = { D: r.absorbedDose_mGy_day, H: r.doseEquivalent_mSv_day, Q: r.meanQ }; }
out.radWsens = [];
for (const W of [20,30,36,45,W_CRUISE_2012,W_CRUISE_FULL,W_CRUISE_2012_UNMASKED,W_CRUISE_FULL_UNMASKED,60,70]) {
  const p = computeShieldedDose('aluminum', 16, W); const f = computeFragmentedDose('aluminum', 16, W);
  out.radWsens.push({ W, D_prim: p.absorbedDose_mGy_day, H_prim: p.doseEquivalent_mSv_day, Q_prim: p.meanQ,
                      D_frag: f.absorbedDose_mGy_day, H_frag: f.doseEquivalent_mSv_day, Q_frag: f.meanQ });
}
out.radBracket = [];
for (const W of [W_CRUISE_LOW,W_CRUISE_2012,W_CRUISE_HIGH]) for (const t of [10,16,20]) {
  const r = computeShieldedDose('aluminum', t, W); out.radBracket.push({ W, t, D: r.absorbedDose_mGy_day, H: r.doseEquivalent_mSv_day, Q: r.meanQ });
}
// three-bin shielding sensitivity (Guo et al. 2015 bins; weights 0.3/0.5/0.2; representative depths
// fixed by the author BEFORE this calculation: 2.5, 9, 54 g/cm2; heavy bin bracketed at 20 and 80 g/cm2)
out.threeBin = [];
for (const heavy of [54, 20, 80]) {
  const depths = [2.5, 9, heavy], w = [0.3, 0.5, 0.2];
  for (const mode of ['prim', 'frag']) {
    let D = 0, H = 0; const per: any[] = [];
    for (let k = 0; k < 3; k++) { const r = mode === 'prim' ? computeShieldedDose('aluminum', depths[k]!, W_CRUISE_2012) : computeFragmentedDose('aluminum', depths[k]!, W_CRUISE_2012);
      D += w[k]! * r.absorbedDose_mGy_day; H += w[k]! * r.doseEquivalent_mSv_day; per.push({ t: depths[k], D: r.absorbedDose_mGy_day, H: r.doseEquivalent_mSv_day }); }
    out.threeBin.push({ heavy, mode, meanDepth: 0.3*2.5 + 0.5*9 + 0.2*heavy, W: W_CRUISE_2012, D, H, Q: H / D, ratioD: D / RAD_CRUISE.doseRate_mGy_day, ratioH: H / RAD_CRUISE.doseEquivalent_mSv_day, per });
  }
}
out.bracketSens = [];
for (const W of [20, 35.4881, 45, 69.8181, 71.9357]) for (const t of [10, 16, 20]) { const r = computeShieldedDose('aluminum', t, W); out.bracketSens.push({ W, t, D: r.absorbedDose_mGy_day, H: r.doseEquivalent_mSv_day }); }
// 4. free space
const fs0 = computeFreeSpaceDose(0), fs130 = computeFreeSpaceDose(130);
out.freeSpace = { W0: { D: fs0.absorbedDose_mGy_day, H: fs0.doseEquivalent_mSv_day, Q: fs0.meanQ, flux: fs0.integralFlux, perSpecies: fs0.perSpecies },
                  W130: { D: fs130.absorbedDose_mGy_day, H: fs130.doseEquivalent_mSv_day, Q: fs130.meanQ } };
// 5. shielding sweep
out.sweep = [];
const TS = [0,1,2,3,4,5,6,8,10,12,15,20,25,30,35,40];
for (const key of Object.keys(MATERIALS)) for (const t of TS) {
  const p = computeShieldedDose(key, t, 0); const f = computeFragmentedDose(key, t, 0);
  out.sweep.push({ material: key, t, D_prim: p.absorbedDose_mGy_day, H_prim: p.doseEquivalent_mSv_day, Q_prim: p.meanQ,
                   D_frag: f.absorbedDose_mGy_day, H_frag: f.doseEquivalent_mSv_day, Q_frag: f.meanQ });
}
out.trend = computeShieldingTrendSummary();
out.mfp = [];
for (const key of Object.keys(MATERIALS)) for (const [sym,,A] of IONS) if (A>1) out.mfp.push({ material: key, ion: sym, A, lambda_gcm2: interactionMFP(A, MATERIALS[key]!) });
// 6. presets exactly as coded in src/ui/main.ts
const pre = (layers: any[], W: number, frag: boolean) => frag ? computeMultiLayerFragmentedDose(layers, W) : computeMultiLayerDose(layers, W);
const mars = pre([{material:'aluminum',thickness:10},{material:'polyethylene',thickness:5}], 0, true);
const gate = pre([{material:'aluminum',thickness:8},{material:'polyethylene',thickness:3}], 130, false);
const art  = pre([{material:'aluminum',thickness:6}], 0, true);
const artIfTwo = pre([{material:'aluminum',thickness:6},{material:'polyethylene',thickness:5}], 0, true);
const marsPrim = pre([{material:'aluminum',thickness:10},{material:'polyethylene',thickness:5}], 0, false);
const S = (r: any, days: number) => ({ D: r.absorbedDose_mGy_day, H: r.doseEquivalent_mSv_day, Q: r.meanQ, days, D_total_mGy: r.absorbedDose_mGy_day*days, H_total_mSv: r.doseEquivalent_mSv_day*days });
out.presets = { mars: S(mars,360), marsPrimaries: S(marsPrim,360), gateway: S(gate,180), artemis: S(art,10), artemisIfTwoLayer: S(artIfTwo,10) };
// single-layer reduction check
const sl1 = computeMultiLayerFragmentedDose([{material:'aluminum',thickness:6}],0).doseEquivalent_mSv_day;
const sl2 = computeFragmentedDose('aluminum',6,0).doseEquivalent_mSv_day;
out.singleLayerCheck = { multi: sl1, single: sl2 };


// --- additions for Paper 1 (paper1-v1.0.0 freeze) -------------------------------------------
// helium vs NIST ASTAR (validation only; T = total alpha kinetic energy, E/n = T/4, A = 4)
out.astarHelium = { retrievedUTC: ASTAR_RETRIEVED_UTC, points: [] as any[] };
for (const [mat, ds] of Object.entries(ASTAR_HELIUM)) for (const p of ds.points) {
  const r = ionStopping(p.T_MeV / 4, 2, 4.0, MATERIALS[mat]!);
  out.astarHelium.points.push({ material: mat, matno: ds.matno, T_MeV: p.T_MeV, E_MeV_per_n: p.T_MeV / 4,
    S_model: r.massStopping, S_astar: p.electronic, dev_pct: (r.massStopping - p.electronic) / p.electronic * 100 });
}
const hePts = out.astarHelium.points as any[];
const maxAbs = (xs: any[]) => xs.reduce((m, x) => Math.max(m, Math.abs(x.dev_pct)), 0);
out.astarHelium.maxAbsDevPct_ge10MeVn = maxAbs(hePts.filter((x) => x.E_MeV_per_n >= 10));
out.astarHelium.maxAbsDevPct_all = maxAbs(hePts);
out.astarHelium.perMaterial_ge10MeVn = Object.fromEntries(Object.keys(ASTAR_HELIUM).map((m) => [m, maxAbs(hePts.filter((x) => x.material === m && x.E_MeV_per_n >= 10))]));

// free-space dose-equivalent shares by species group (W = 0)
const ps = out.freeSpace.W0.perSpecies as any[];
const share = (a: number, b: number) => 100 * ps.filter((s) => s.Z >= a && s.Z <= b).reduce((t, s) => t + s.doseEqFraction, 0);
out.speciesShares_W0_pct = { H: share(1, 1), He: share(2, 2), LiB: share(3, 5), CO: share(6, 8), LiO: share(3, 8), Z9_28: share(9, 28) };

// headline summary block used by scripts/check_manuscript_numbers.py
const m = out.rad.model, meas = { D: RAD_CRUISE.doseRate_mGy_day, H: RAD_CRUISE.doseEquivalent_mSv_day, Q: RAD_CRUISE.meanQ };
const ZEITLIN_ORIG = { D: 0.481, H: 1.84 }; // Zeitlin et al. 2013 original values (author-confirmed; data/rad/zeitlin2013.ts comment)
const fr = out.radFrag;
out.summary = {
  W: out.W,
  pstarMaxDevPct_ge10MeV: out.nistSummary.maxSolidPct,
  headline: { D: m.D, H: m.H, Q: m.Q, ratioD: m.D / meas.D, ratioH: m.H / meas.H, ratioQ: m.Q / meas.Q,
              ratioD_zeitlin: m.D / ZEITLIN_ORIG.D, ratioH_zeitlin: m.H / ZEITLIN_ORIG.H,
              deficitD_mGy: meas.D - m.D, deficitD_pct: 100 * (1 - m.D / meas.D), deficitH_pct: 100 * (1 - m.H / meas.H), excessQ_pct: 100 * (m.Q / meas.Q - 1),
              H_lo: out.rad.H_lo, H_hi: out.rad.H_hi, D_lo: out.rad.D_lo, D_hi: out.rad.D_hi },
  frag: { D: fr.absorbedDose_mGy_day, H: fr.doseEquivalent_mSv_day, Q: fr.meanQ, ratioD: fr.absorbedDose_mGy_day / meas.D, ratioH: fr.doseEquivalent_mSv_day / meas.H, ratioQ: fr.meanQ / meas.Q },
  uncertainty: { total: out.unc.total, H_band: [m.H * (1 - out.unc.total), m.H * (1 + out.unc.total)], D_band: [m.D * (1 - out.unc.total), m.D * (1 + out.unc.total)], H_abs: m.H * out.unc.total },
  neutron_Kohler2015: { measured_uGy: 3.8, extrapolated_uGy: 6,
    frac_of_481_pct: 100 * 0.0038 / 0.481, frac_of_458_pct: 100 * 0.0038 / 0.458,
    extrap_frac_of_481_pct: 100 * 0.006 / 0.481, extrap_frac_of_458_pct: 100 * 0.006 / 0.458,
    frac_of_deficit_pct: 100 * 0.0038 / (meas.D - m.D), extrap_frac_of_deficit_pct: 100 * 0.006 / (meas.D - m.D) },
};


// high-Z reference materials (excluded from the shield set): max |dev| vs PSTAR at >= 10 MeV
out.highZ = {} as any;
for (const [key, mat, ds] of [['lead', LEAD, PSTAR_LEAD], ['titanium', TITANIUM, PSTAR_TITANIUM]] as const) {
  const devs = ds.points.filter((p) => p.T_MeV >= 10).map((p) => (electronicMassStoppingPower(p.T_MeV, mat) - p.electronic) / p.electronic * 100);
  out.highZ[key] = { maxAbsDevPct_ge10MeV: Math.max(...devs.map(Math.abs)) };
}
// PSTAR CSDA range-increment max |dev| at >= 10 MeV; polyethylene advantage at 20 g/cm2 (W = 0)
out.summary_extra = {
  rangeIncrementMaxAbsDevPct_ge10MeV: Math.max(...(out.pstar as any[]).filter((p) => p.T_MeV >= 10 && p.dR_dev_pct !== null).map((p) => Math.abs(p.dR_dev_pct))),
  polyAdvantage20_pct: (() => { const g = (m: string, k: string) => (out.sweep as any[]).find((x) => x.material === m && x.t === 20)[k];
    return { prim: 100 * (1 - g('polyethylene', 'H_prim') / g('aluminum', 'H_prim')), frag: 100 * (1 - g('polyethylene', 'H_frag') / g('aluminum', 'H_frag')) }; })(),
  marsPresetBand_mSv: [out.presets.mars.H_total_mSv * (1 - out.unc.total), out.presets.mars.H_total_mSv * (1 + out.unc.total)],
};

// provenance: commit read from .git (no git binary needed); uncommitted edits are NOT detected here
let commit = 'unknown';
try {
  const head = readFileSync(new URL('../.git/HEAD', import.meta.url), 'utf8').trim();
  commit = head.startsWith('ref: ') ? readFileSync(new URL('../.git/' + head.slice(5), import.meta.url), 'utf8').trim() : head;
} catch { /* not a git checkout */ }
out.provenance = { script: 'scripts/reproduce_paper1.ts', gitHead: commit, node: process.version, generatedUTC: new Date().toISOString() };

const target = process.argv[2] ?? 'paper1_results.json';
writeFileSync(target, JSON.stringify(out, null, 1));
console.log(`paper1 results written: ${target} (git HEAD ${commit})`);
