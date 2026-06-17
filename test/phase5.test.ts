import { describe, it, expect } from 'vitest';
import { MATERIALS } from '../src/physics/materials.js';
import { chargeChangingCrossSection, interactionMFP, fragmentYield } from '../src/physics/fragmentation.js';
import { computeFragmentedDose } from '../src/dose/fragmentedDose.js';
import { computeShieldedDose } from '../src/dose/shieldedDose.js';
import { computeFreeSpaceDose } from '../src/dose/doseModel.js';
import { RAD_CRUISE } from '../data/rad/zeitlin2013.js';
import { W_SOLAR_MIN, W_CRUISE_2012 } from '../data/gcr/matthia2013.js';

const relErr = (a: number, b: number) => Math.abs(a - b) / b;

describe('Bradt–Peters fragmentation', () => {
  it('cross-section grows with projectile/target mass', () => {
    expect(chargeChangingCrossSection(56, 27)).toBeGreaterThan(chargeChangingCrossSection(12, 27));
  });
  it('Fe mean free path: polyethylene < water < aluminium (H-rich fragments faster per g/cm²)', () => {
    const al = interactionMFP(55.8, MATERIALS.aluminum!);
    const water = interactionMFP(55.8, MATERIALS.water!);
    const poly = interactionMFP(55.8, MATERIALS.polyethylene!);
    expect(poly).toBeLessThan(water);
    expect(water).toBeLessThan(al);
    expect(al).toBeGreaterThan(10); // sanity: ~22 g/cm²
    expect(al).toBeLessThan(40);
  });
  it('fragment yield conserves charge (Σ Z_f·n = Z_p)', () => {
    const frags = fragmentYield(26, 55.8);
    const totZ = frags.reduce((s, fr) => s + fr.Z * fr.multiplicity, 0);
    expect(totZ).toBeCloseTo(26, 6);
    const totA = frags.reduce((s, fr) => s + fr.A * fr.multiplicity, 0);
    expect(totA).toBeCloseTo(55.8, 4); // A/Z-preserving → mass also conserved into charged fragments
  });
});

describe('fragmented dose', () => {
  it('t=0 reduces to primary-only free-space (<1%)', () => {
    const free = computeFreeSpaceDose(W_SOLAR_MIN).doseEquivalent_mSv_day;
    const frag0 = computeFragmentedDose('aluminum', 0, W_SOLAR_MIN).doseEquivalent_mSv_day;
    expect(relErr(frag0, free)).toBeLessThan(0.01);
  });
  it('softens ⟨Q⟩ toward the measured RAD value', () => {
    const t = RAD_CRUISE.shielding_gcm2;
    const prim = computeShieldedDose('aluminum', t, W_CRUISE_2012).meanQ;
    const frag = computeFragmentedDose('aluminum', t, W_CRUISE_2012).meanQ;
    expect(frag).toBeLessThan(prim); // softer
    expect(Math.abs(frag - RAD_CRUISE.meanQ)).toBeLessThan(Math.abs(prim - RAD_CRUISE.meanQ)); // closer
  });
  it('widens the polyethylene-vs-aluminium advantage', () => {
    const t = 20;
    const benefit = (al: number, poly: number) => 1 - poly / al;
    const prim = benefit(
      computeShieldedDose('aluminum', t, W_SOLAR_MIN).doseEquivalent_mSv_day,
      computeShieldedDose('polyethylene', t, W_SOLAR_MIN).doseEquivalent_mSv_day,
    );
    const frag = benefit(
      computeFragmentedDose('aluminum', t, W_SOLAR_MIN).doseEquivalent_mSv_day,
      computeFragmentedDose('polyethylene', t, W_SOLAR_MIN).doseEquivalent_mSv_day,
    );
    expect(frag).toBeGreaterThan(prim);
  });
});
