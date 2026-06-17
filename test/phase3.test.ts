import { describe, it, expect } from 'vitest';
import { MATERIALS } from '../src/physics/materials.js';
import { getRangeTable, IonRangeTable } from '../src/physics/ionRange.js';
import { computeShieldedDose } from '../src/dose/shieldedDose.js';
import { computeFreeSpaceDose } from '../src/dose/doseModel.js';
import { W_SOLAR_MIN } from '../data/gcr/matthia2013.js';

const relErr = (a: number, b: number) => Math.abs(a - b) / b;

describe('ion range tables', () => {
  it('proton range in Al matches NIST PSTAR (cross-check of the integrator)', () => {
    const t = getRangeTable(1, 1, MATERIALS.aluminum!);
    expect(relErr(t.rangeAtEnergy(100), 10.01)).toBeLessThan(0.01); // PSTAR 10.01 g/cm²
    expect(relErr(t.rangeAtEnergy(1000), 412.4)).toBeLessThan(0.01); // PSTAR 412.4 g/cm²
  });
  it('range↔energy inversion round-trips', () => {
    const t = getRangeTable(1, 1, MATERIALS.water!);
    for (const E of [50, 200, 800]) {
      const R = t.rangeAtEnergy(E);
      expect(relErr(t.energyAtRange(R), E)).toBeLessThan(0.005);
    }
  });
  it('heavy ions range less (g/cm²) than protons at equal energy/nucleon (~A/Z² scaling)', () => {
    const p = getRangeTable(1, 1, MATERIALS.aluminum!).rangeAtEnergy(1000);
    const fe = getRangeTable(26, 55.8, MATERIALS.aluminum!).rangeAtEnergy(1000);
    expect(fe).toBeLessThan(p); // Fe much shorter range per g/cm²
    expect(fe / p).toBeGreaterThan(0.02); // ~A/Z² = 55.8/676 ≈ 0.083
    expect(fe / p).toBeLessThan(0.2);
  });
  it('caches tables (same instance for same material+ion)', () => {
    expect(getRangeTable(1, 1, MATERIALS.water!)).toBe(getRangeTable(1, 1, MATERIALS.water!));
    expect(getRangeTable(1, 1, MATERIALS.water!) instanceof IonRangeTable).toBe(true);
  });
});

describe('slab transport / shielded dose', () => {
  it('t=0 reduces to the Phase-2 free-space result (<1%)', () => {
    const free = computeFreeSpaceDose(W_SOLAR_MIN).doseEquivalent_mSv_day;
    const t0 = computeShieldedDose('aluminum', 0, W_SOLAR_MIN).doseEquivalent_mSv_day;
    expect(relErr(t0, free)).toBeLessThan(0.01);
  });
  it('dose-equivalent decreases under thick shielding', () => {
    const h0 = computeShieldedDose('aluminum', 0, W_SOLAR_MIN).doseEquivalent_mSv_day;
    const h40 = computeShieldedDose('aluminum', 40, W_SOLAR_MIN).doseEquivalent_mSv_day;
    expect(h40).toBeLessThan(h0);
  });
});

describe('VALIDATION #3 — shielding trend (polyethylene < aluminum at equal areal density)', () => {
  for (const t of [5, 10, 20, 30]) {
    it(`poly < Al at ${t} g/cm²`, () => {
      const al = computeShieldedDose('aluminum', t, W_SOLAR_MIN).doseEquivalent_mSv_day;
      const poly = computeShieldedDose('polyethylene', t, W_SOLAR_MIN).doseEquivalent_mSv_day;
      expect(poly).toBeLessThan(al);
    });
  }
  it('water shields between poly and Al per g/cm² (⟨Z/A⟩ ordering)', () => {
    // ⟨Z/A⟩: poly 0.570 > water 0.555 > Al 0.482 → more electrons/g stop more per g/cm²
    const al = computeShieldedDose('aluminum', 20, W_SOLAR_MIN).doseEquivalent_mSv_day;
    const water = computeShieldedDose('water', 20, W_SOLAR_MIN).doseEquivalent_mSv_day;
    const poly = computeShieldedDose('polyethylene', 20, W_SOLAR_MIN).doseEquivalent_mSv_day;
    expect(poly).toBeLessThanOrEqual(water + 1e-9);
    expect(water).toBeLessThanOrEqual(al + 1e-9);
  });
});
