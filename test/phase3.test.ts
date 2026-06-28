import { describe, it, expect } from 'vitest';
import { MATERIALS } from '../src/physics/materials.js';
import { getRangeTable, IonRangeTable } from '../src/physics/ionRange.js';
import { computeShieldedDose } from '../src/dose/shieldedDose.js';
import { computeFreeSpaceDose } from '../src/dose/doseModel.js';
import { W_SOLAR_MIN } from '../data/gcr/matthia2013.js';
import { computeShieldingTrendSummary, SHIELD_RANK } from '../src/validation/validationSummary.js';
import { computeMultiLayerDose, computeMultiLayerFragmentedDose } from '../src/dose/multiLayerDose.js';
import { computeFragmentedDose } from '../src/dose/fragmentedDose.js';

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

describe('VALIDATION #3b — full monotonic shielding ranking (by hydrogen content / ⟨Z/A⟩)', () => {
  const summary = computeShieldingTrendSummary();
  it('ranks shields exactly H2 < CH4 < PE < water < Al', () => {
    expect([...summary.rank]).toEqual(['hydrogen', 'methane', 'polyethylene', 'water', 'aluminum']);
    expect(summary.ok).toBe(true); // strictly increasing dose-equivalent along the rank at every tested t
  });
  for (const t of [10, 20, 40]) {
    it(`dose-equivalent strictly increases H2→CH4→PE→water→Al at ${t} g/cm²`, () => {
      const H = SHIELD_RANK.map((m) => computeShieldedDose(m, t, W_SOLAR_MIN).doseEquivalent_mSv_day);
      for (let i = 1; i < H.length; i++) expect(H[i]!).toBeGreaterThan(H[i - 1]!);
    });
  }
  it('best shield (H2) beats worst (Al) by a wide margin (>40%)', () => {
    expect(summary.maxBestBenefitPct).toBeGreaterThan(40);
  });
});

describe('multi-layer shielding (v2.0)', () => {
  it('single-layer stack reduces to the validated computeShieldedDose (<0.5%)', () => {
    const ml = computeMultiLayerDose([{ material: 'aluminum', thickness: 20 }], W_SOLAR_MIN).doseEquivalent_mSv_day;
    const sl = computeShieldedDose('aluminum', 20, W_SOLAR_MIN).doseEquivalent_mSv_day;
    expect(relErr(ml, sl)).toBeLessThan(0.005);
  });
  it('single-layer fragmented stack reduces to computeFragmentedDose', () => {
    const ml = computeMultiLayerFragmentedDose([{ material: 'aluminum', thickness: 20 }], W_SOLAR_MIN).doseEquivalent_mSv_day;
    const sl = computeFragmentedDose('aluminum', 20, W_SOLAR_MIN).doseEquivalent_mSv_day;
    expect(relErr(ml, sl)).toBeLessThan(0.005);
  });
  it('a two-material stack lands between the equivalent single-material stacks', () => {
    const two = computeMultiLayerDose(
      [{ material: 'aluminum', thickness: 10 }, { material: 'polyethylene', thickness: 5 }],
      W_SOLAR_MIN,
    ).doseEquivalent_mSv_day;
    const pe15 = computeShieldedDose('polyethylene', 15, W_SOLAR_MIN).doseEquivalent_mSv_day;
    const al15 = computeShieldedDose('aluminum', 15, W_SOLAR_MIN).doseEquivalent_mSv_day;
    expect(two).toBeGreaterThan(pe15); // worse than all-polyethylene
    expect(two).toBeLessThan(al15); // better than all-aluminium
  });
  it('an empty stack returns the free-space dose', () => {
    const empty = computeMultiLayerDose([{ material: 'aluminum', thickness: 0 }], W_SOLAR_MIN).doseEquivalent_mSv_day;
    const free = computeFreeSpaceDose(W_SOLAR_MIN).doseEquivalent_mSv_day;
    expect(relErr(empty, free)).toBeLessThan(1e-9);
  });
});
