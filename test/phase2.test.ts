import { describe, it, expect } from 'vitest';
import { WATER } from '../src/physics/materials.js';
import { qualityFactorICRP60, letFromMassStopping } from '../src/physics/qualityFactor.js';
import { effectiveCharge } from '../src/physics/effectiveCharge.js';
import { ionStopping, ionMassStoppingPower } from '../src/physics/ionStopping.js';
import { electronicMassStoppingPower } from '../src/physics/stoppingPower.js';
import { differentialFluxMatthia, GCR_SPECIES, W_SOLAR_MIN, W_SOLAR_MAX } from '../data/gcr/matthia2013.js';
import { computeFreeSpaceDose } from '../src/dose/doseModel.js';

describe('ICRP-60 quality factor', () => {
  it('matches the three-branch definition at boundaries', () => {
    expect(qualityFactorICRP60(5)).toBe(1); // L<10
    expect(qualityFactorICRP60(10)).toBeCloseTo(0.32 * 10 - 2.2, 6); // = 1.0 at L=10
    expect(qualityFactorICRP60(100)).toBeCloseTo(0.32 * 100 - 2.2, 6); // = 29.8
    expect(qualityFactorICRP60(400)).toBeCloseTo(300 / Math.sqrt(400), 6); // = 15
  });
  it('is continuous at L=10 (Q→1)', () => {
    expect(qualityFactorICRP60(9.999)).toBe(1);
    expect(qualityFactorICRP60(10)).toBeCloseTo(1.0, 6);
  });
});

describe('Barkas effective charge', () => {
  it('→ Z at high velocity, reduced at low β', () => {
    expect(effectiveCharge(26, 0.99)).toBeCloseTo(26, 1); // fully stripped
    expect(effectiveCharge(26, 0.1)).toBeLessThan(26); // partially stripped
    expect(effectiveCharge(1, 0.5)).toBe(1); // proton always 1
  });
});

describe('heavy-ion z_eff² scaling', () => {
  it('S_ion = z_eff² × S_proton at equal energy/nucleon (high E, fully stripped)', () => {
    const En = 1000; // MeV/n, z_eff ≈ Z here
    const { zEff, massStopping } = ionStopping(En, 8, 16, WATER); // oxygen
    // proton at same energy/nucleon (same β)
    const sP = electronicMassStoppingPower(En, WATER, 1, 938.27208816);
    expect(massStopping / sP).toBeCloseTo(zEff * zEff, 0); // ratio ≈ z_eff²
    expect(zEff).toBeGreaterThan(7.9); // ~8
  });
  it('Fe LET in water near 1 GeV/n is high-LET (~140–160 keV/µm)', () => {
    const S = ionMassStoppingPower(1000, 26, 55.8, WATER);
    const LET = letFromMassStopping(S, WATER.density);
    expect(LET).toBeGreaterThan(120);
    expect(LET).toBeLessThan(180);
  });
});

describe('Matthiä 2013 GCR flux', () => {
  it('has 28 species H..Ni', () => {
    expect(GCR_SPECIES).toHaveLength(28);
    expect(GCR_SPECIES[0]!.symbol).toBe('H');
    expect(GCR_SPECIES[25]!.symbol).toBe('Fe');
  });
  it('proton flux is positive and falls steeply at high energy (power-law tail)', () => {
    const j100 = differentialFluxMatthia(1, 100, W_SOLAR_MIN);
    const j1000 = differentialFluxMatthia(1, 1000, W_SOLAR_MIN);
    const j10000 = differentialFluxMatthia(1, 10000, W_SOLAR_MIN);
    expect(j100).toBeGreaterThan(0);
    expect(j1000).toBeLessThan(j100);
    expect(j10000).toBeLessThan(j1000);
  });
  it('solar minimum flux exceeds solar maximum (less modulation)', () => {
    expect(differentialFluxMatthia(1, 300, W_SOLAR_MIN)).toBeGreaterThan(
      differentialFluxMatthia(1, 300, W_SOLAR_MAX),
    );
  });
});

describe('free-space dose magnitudes (literature sanity, not a formal gate)', () => {
  // Free space, primaries only, deepest modulation (W=0): absorbed dose & flux match
  // well-established free-space values; H and <Q> are upper bounds (exceed shielded RAD).
  const r = computeFreeSpaceDose(W_SOLAR_MIN);
  it('absorbed dose ~0.4–0.5 mGy/day (clean free-space anchor)', () => {
    expect(r.absorbedDose_mGy_day).toBeGreaterThan(0.35);
    expect(r.absorbedDose_mGy_day).toBeLessThan(0.65);
  });
  it('omnidirectional integral flux ~3–7 /cm²/s (clean free-space anchor)', () => {
    expect(r.integralFlux).toBeGreaterThan(3);
    expect(r.integralFlux).toBeLessThan(7);
  });
  it('dose-equivalent ~1.5–3.5 mSv/day (free-space primary-only upper bound)', () => {
    expect(r.doseEquivalent_mSv_day).toBeGreaterThan(1.5);
    expect(r.doseEquivalent_mSv_day).toBeLessThan(3.5);
  });
  it('mean quality factor ~4–7.5 (free-space primary-only, ICRP-60; > shielded ~3.8)', () => {
    expect(r.meanQ).toBeGreaterThan(4.0);
    expect(r.meanQ).toBeLessThan(7.5);
  });
  it('heavy ions (Z≥3) dominate dose-equivalent despite tiny flux share', () => {
    const heavyH = r.perSpecies.filter((p) => p.Z >= 3).reduce((s, p) => s + p.doseEqFraction, 0);
    expect(heavyH).toBeGreaterThan(0.5); // heavies carry most of H
    const protonFluxFrac = r.perSpecies[0]!.flux / r.integralFlux;
    expect(protonFluxFrac).toBeGreaterThan(0.8); // ...while protons carry most of the flux
  });
  it('solar-min dose exceeds solar-max dose', () => {
    expect(computeFreeSpaceDose(W_SOLAR_MIN).doseEquivalent_mSv_day).toBeGreaterThan(
      computeFreeSpaceDose(W_SOLAR_MAX).doseEquivalent_mSv_day,
    );
  });
  it('integrator converged (doubling node density changes H < 0.5%)', () => {
    const coarse = computeFreeSpaceDose(W_SOLAR_MIN, 80).doseEquivalent_mSv_day;
    const fine = computeFreeSpaceDose(W_SOLAR_MIN, 320).doseEquivalent_mSv_day;
    expect(Math.abs(coarse - fine) / fine).toBeLessThan(0.005);
  });
});
