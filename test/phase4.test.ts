import { describe, it, expect } from 'vitest';
import { computeRadComparison } from '../src/dose/radComparison.js';
import { RAD_CRUISE } from '../data/rad/zeitlin2013.js';

describe('VALIDATION #2 — model vs measured MSL/RAD cruise dose', () => {
  const c = computeRadComparison();

  it('absorbed dose within 2× of measured', () => {
    expect(c.ratioD).toBeGreaterThan(0.5);
    expect(c.ratioD).toBeLessThan(2.0);
  });
  it('dose-equivalent within 2× of measured', () => {
    expect(c.ratioH).toBeGreaterThan(0.5);
    expect(c.ratioH).toBeLessThan(2.0);
  });
  it('measured dose-equivalent lies inside the model W/shielding bracket', () => {
    expect(RAD_CRUISE.doseEquivalent_mSv_day).toBeGreaterThanOrEqual(c.H_lo);
    expect(RAD_CRUISE.doseEquivalent_mSv_day).toBeLessThanOrEqual(c.H_hi);
  });
  it('⟨Q⟩ is over-predicted (primary-only: no fragmentation to soften LET spectrum)', () => {
    expect(c.model.Q).toBeGreaterThan(c.measured.Q);
  });
  it('absorbed dose is under-predicted (primary-only: missing spacecraft secondaries)', () => {
    expect(c.model.D).toBeLessThan(c.measured.D);
  });
});
