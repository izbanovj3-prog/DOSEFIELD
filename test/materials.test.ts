import { describe, it, expect } from 'vitest';
import { MATERIALS, HIGH_Z_REFERENCE, checkDensityEffect, type Material } from '../src/physics/materials.js';
import { densityEffect } from '../src/physics/stoppingPower.js';
import { PSTAR_DATASETS } from '../data/pstar/index.js';
import { letFromMassStopping } from '../src/physics/qualityFactor.js';
import { MEV_PER_G_TO_GY, SECONDS_PER_DAY } from '../src/physics/constants.js';

/**
 * Data-integrity and unit tests for inputs that nothing else asserts.
 *
 * Every other suite tests a *calculation*. These test the hand-entered material data and the
 * two unit conversions the whole dose pipeline is scaled by — the places where a typo would
 * change every reported number without failing a single physics test or `tsc`.
 */

const KEYS = Object.keys(MATERIALS);

describe('material composition data', () => {
  it('covers exactly the five shipped low-Z materials', () => {
    expect(KEYS.sort()).toEqual(['aluminum', 'hydrogen', 'methane', 'polyethylene', 'water']);
  });

  for (const key of KEYS) {
    const m = MATERIALS[key]!;

    it(`${key}: mass fractions sum to 1`, () => {
      const sum = m.composition.reduce((s, e) => s + e.massFraction, 0);
      expect(sum).toBeCloseTo(1, 6);
    });

    /**
     * <Z/A> and the elemental composition are entered independently from two different NIST
     * pages, so they cross-check each other: Σ wᵢ·(Zᵢ/Aᵢ) must reproduce the declared <Z/A>.
     * The composition drives the nuclear interaction mean free path of compounds
     * (`interactionMFP`, mass-weighted), while <Z/A> drives Bethe — a typo in either would
     * otherwise pass silently, since the two are never compared anywhere in the model.
     * Observed agreement across the five materials is ≤0.006%; 0.2% is a generous typo gate.
     */
    it(`${key}: <Z/A> agrees with the elemental composition`, () => {
      const fromComposition = m.composition.reduce((s, e) => s + e.massFraction * (e.Z / e.A), 0);
      expect(fromComposition / m.ZoverA - 1).toBeCloseTo(0, 3);
    });

    /**
     * Two shapes are legal here, and the test pins both so neither can rot into the other:
     *  - a real Sternheimer set, which must satisfy x0 < x1;
     *  - the documented δ≡0 sentinel x0 = x1 = 99 used by the two gases (H₂, CH₄), whose
     *    plasma energy puts the density-effect onset at βγ ≳ 80, far above the GCR range —
     *    with that sentinel the correction can never switch on, which is the intent.
     */
    it(`${key}: has positive density, I and a coherent density-effect set`, () => {
      expect(m.density).toBeGreaterThan(0);
      expect(m.I_eV).toBeGreaterThan(0);
      const d = m.densityEffect;
      for (const v of [d.a, d.m, d.x0, d.x1, d.Cbar, d.delta0]) expect(Number.isFinite(v)).toBe(true);
      const isNullSentinel =
        d.x0 === 99 && d.x1 === 99 && d.a === 0 && d.Cbar === 0 && !d.conductor && d.delta0 === 0;
      if (isNullSentinel) expect(['hydrogen', 'methane']).toContain(key);
      else expect(d.x1).toBeGreaterThan(d.x0);
    });

    it(`${key}: I matches the value PSTAR used for the same material`, () => {
      const ds = (PSTAR_DATASETS as Record<string, { I_eV: number; matno: string }>)[key]!;
      expect(m.I_eV).toBeCloseTo(ds.I_eV, 6);
    });
  }

  it('ranks by hydrogen content the same way <Z/A> does (the shielding result depends on it)', () => {
    const byZoverA = [...KEYS].sort((a, b) => MATERIALS[b]!.ZoverA - MATERIALS[a]!.ZoverA);
    expect(byZoverA).toEqual(['hydrogen', 'methane', 'polyethylene', 'water', 'aluminum']);
  });
});

/**
 * Below x0 the density effect branches on the `conductor` flag. `checkDensityEffect` runs over
 * every table at module load; these tests prove it actually rejects each way the flag and δ0
 * can disagree, and pin which materials are conductors.
 */
describe('conductor flag ↔ δ0 consistency', () => {
  const withDE = (m: Material, patch: Partial<Material['densityEffect']>): Material => ({
    ...m,
    densityEffect: { ...m.densityEffect, ...patch },
  });

  it('aluminium is the only conductor among the five shields', () => {
    expect(KEYS.filter((k) => MATERIALS[k]!.densityEffect.conductor).sort()).toEqual(['aluminum']);
    expect(MATERIALS.aluminum!.densityEffect.delta0).toBe(0.12);
  });

  it('the high-Z reference metals are conductors with their Sternheimer δ0', () => {
    expect(HIGH_Z_REFERENCE.titanium!.densityEffect).toMatchObject({ conductor: true, delta0: 0.12 });
    expect(HIGH_Z_REFERENCE.lead!.densityEffect).toMatchObject({ conductor: true, delta0: 0.14 });
  });

  it('accepts every shipped and reference material', () => {
    for (const m of [...Object.values(MATERIALS), ...Object.values(HIGH_Z_REFERENCE)]) {
      expect(() => checkDensityEffect(m)).not.toThrow();
    }
  });

  it('rejects a conductor whose δ0 is zero, negative or NaN', () => {
    for (const delta0 of [0, -0.12, Number.NaN]) {
      expect(() => checkDensityEffect(withDE(MATERIALS.aluminum!, { delta0 }))).toThrow(/conductor/);
    }
  });

  it('rejects a non-conductor with a nonzero δ0', () => {
    expect(() => checkDensityEffect(withDE(MATERIALS.water!, { delta0: 0.12 }))).toThrow(/non-conductor/);
    expect(() => checkDensityEffect(withDE(MATERIALS.aluminum!, { conductor: false }))).toThrow(/non-conductor/);
  });
});

/**
 * Sternheimer's parameters join the middle branch to the branch below x0: evaluated at x = x0 it
 * must equal δ0 for a conductor and 0 for an insulator.
 *
 * The parameters are printed to finite precision (PDG muE PDFs: `a` to 5 decimals; k, x0, x1, C̄
 * to 4), so the join holds only to within that rounding — PDG's own sets miss by 5.5e-5 (Al) to
 * 3.9e-4 (Pb), which rules out a machine-precision tolerance. The tolerance here IS that rounding:
 * half a unit in the last printed digit of each parameter, propagated through the formula.
 * Nothing in it is fitted. δ0 is treated as exact: it is printed to only 2 decimals, yet all three
 * conductors meet it to < 4e-4, so `a` was evidently set from it.
 *
 * What this catches: aluminium's former a = 0.0802 missed by 1.7e-3 against a bound of 6.9e-4,
 * water's 0.0912 by 1.3e-3 against 5.2e-4. What it cannot: polyethylene's former 0.1211 missed by
 * 4.5e-4, inside its 4.8e-4 bound — a truncation in the last digit can hide in the rounding.
 */
describe('density-effect continuity at x0', () => {
  const HALF_UNIT = { a: 0.5e-5, m: 0.5e-4, x0: 0.5e-4, x1: 0.5e-4, Cbar: 0.5e-4 };
  const all = { ...MATERIALS, ...HIGH_Z_REFERENCE };

  for (const key of Object.keys(all)) {
    const d = all[key]!.densityEffect;
    if (d.x0 === 99) continue; // δ≡0 sentinel (H₂, CH₄): no middle branch to join

    it(`${key}: middle branch at x0 equals ${d.conductor ? 'δ0' : '0'} to printed precision`, () => {
      const u = d.x1 - d.x0;
      const middleAtX0 = 2 * Math.LN10 * d.x0 - d.Cbar + d.a * u ** d.m;
      const target = d.conductor ? d.delta0 : 0;
      const tolerance =
        HALF_UNIT.a * u ** d.m +
        HALF_UNIT.m * d.a * u ** d.m * Math.log(u) +
        HALF_UNIT.x0 * Math.abs(2 * Math.LN10 - d.a * d.m * u ** (d.m - 1)) +
        HALF_UNIT.x1 * d.a * d.m * u ** (d.m - 1) +
        HALF_UNIT.Cbar;
      expect(Math.abs(middleAtX0 - target)).toBeLessThanOrEqual(tolerance);
      // the expression above is the one densityEffect evaluates just above x0
      const justAbove = densityEffect(10 ** (d.x0 + 1e-12), d);
      expect(Math.abs(justAbove - middleAtX0)).toBeLessThan(1e-9);
    });
  }
});

describe('unit conversions', () => {
  /** LET[keV/µm] = S[MeV·cm²/g]·ρ[g/cm³]·0.1, since 1 MeV/cm = 0.1 keV/µm. */
  it('letFromMassStopping converts MeV·cm²/g × g/cm³ → keV/µm', () => {
    expect(letFromMassStopping(10, 1)).toBeCloseTo(1, 12);
    expect(letFromMassStopping(1, 1)).toBeCloseTo(0.1, 12);
    expect(letFromMassStopping(2, 2.6989)).toBeCloseTo(2 * 2.6989 * 0.1, 12);
  });

  it('letFromMassStopping is linear in both arguments', () => {
    expect(letFromMassStopping(7.29, 1)).toBeCloseTo(2 * letFromMassStopping(3.645, 1), 12);
    expect(letFromMassStopping(1, 4)).toBeCloseTo(4 * letFromMassStopping(1, 1), 12);
  });

  /** 1 MeV = 1.602176634e-13 J and 1/g = 1000/kg ⇒ 1 MeV/g = 1.602176634e-10 Gy. */
  it('MEV_PER_G_TO_GY is the CODATA-2018 elementary charge scaled to J/kg', () => {
    expect(MEV_PER_G_TO_GY).toBeCloseTo(1.602176634e-13 * 1000, 20);
  });

  it('SECONDS_PER_DAY is a day', () => {
    expect(SECONDS_PER_DAY).toBe(24 * 60 * 60);
  });
});
