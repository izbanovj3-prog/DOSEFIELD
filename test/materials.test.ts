import { describe, it, expect } from 'vitest';
import { MATERIALS } from '../src/physics/materials.js';
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
      const isNullSentinel = d.x0 === 99 && d.x1 === 99 && d.a === 0 && d.Cbar === 0 && d.delta0 === 0;
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
