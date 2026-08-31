/**
 * Why high-Z shields are not offered — measured, not remembered.
 *
 * METHODS.md §13.4 used to carry a qualitative claim plus a caveat that the failure percentages
 * once quoted for lead and titanium were not reproducible from this repository. They are now:
 * `data/pstar/{lead,titanium}.ts` hold the NIST tables and `HIGH_Z_REFERENCE` in materials.ts
 * holds the same class of inputs the shipped materials use, so the comparison below tests the
 * PHYSICS (Bethe–Bloch with no shell correction) rather than the data.
 *
 * What the measurement actually says, and the docs say the same:
 *   · the error grows with Z, monotonically — Al(13) 1.55% → Ti(22) 2.50% → Pb(82) 6.19%
 *     at ≥10 MeV, against a 2.5% gate for a shipped material;
 *   · lead fails clearly, titanium only marginally — it lands ON the gate, not far past it;
 *   · the historic "wide margin" figures are NOT what this repository computes. The rejection
 *     stands, the old magnitude does not, and nothing here is tuned to rescue it.
 *
 * These materials must never become selectable shields, so their exclusion is asserted too.
 */
import { describe, it, expect } from 'vitest';
import { MATERIALS, HIGH_Z_REFERENCE, LEAD, TITANIUM } from '../src/physics/materials.js';
import { electronicMassStoppingPower } from '../src/physics/stoppingPower.js';
import { PSTAR_DATASETS, PSTAR_HIGH_Z_REFERENCE } from '../data/pstar/index.js';
import type { PstarDataset } from '../data/pstar/types.js';
import type { Material } from '../src/physics/materials.js';

const relErr = (a: number, b: number): number => Math.abs(a - b) / b;

/** Largest |model − PSTAR| / PSTAR over the dataset points at or above `floorMeV`. */
function maxDeviation(mat: Material, ds: PstarDataset, floorMeV: number): number {
  let worst = 0;
  for (const p of ds.points) {
    if (p.T_MeV < floorMeV) continue;
    worst = Math.max(worst, relErr(electronicMassStoppingPower(p.T_MeV, mat), p.electronic));
  }
  return worst;
}

/** The tolerance a SHIPPED material has to meet in test/physics.test.ts above 10 MeV. */
const SHIPPED_GATE = 0.025;

describe('high-Z shields: the rejection reproduces', () => {
  it('the stopping-power error grows monotonically with Z: Al(13) < Ti(22) < Pb(82)', () => {
    const al = maxDeviation(MATERIALS.aluminum!, PSTAR_DATASETS.aluminum, 10);
    const ti = maxDeviation(TITANIUM, PSTAR_HIGH_Z_REFERENCE.titanium, 10);
    const pb = maxDeviation(LEAD, PSTAR_HIGH_Z_REFERENCE.lead, 10);
    expect(al).toBeLessThan(ti);
    expect(ti).toBeLessThan(pb);
    // and the shipped one is the only member of that chain inside the gate
    expect(al).toBeLessThan(SHIPPED_GATE);
  });

  it('lead fails the shipped tolerance decisively (>2× the gate above 10 MeV)', () => {
    expect(maxDeviation(LEAD, PSTAR_HIGH_Z_REFERENCE.lead, 10)).toBeGreaterThan(2 * SHIPPED_GATE);
  });

  it('titanium fails only marginally — it sits on the gate, not far past it', () => {
    // Stated as a band, not a knife-edge equality: the point of the test is that titanium is a
    // BORDERLINE rejection, so "wide margin" language cannot be justified from this repository.
    const ti = maxDeviation(TITANIUM, PSTAR_HIGH_Z_REFERENCE.titanium, 10);
    expect(ti).toBeGreaterThan(0.024);
    expect(ti).toBeLessThan(0.030);
  });

  it('lead shows the shell-correction signature: the model UNDER-predicts at 1 MeV', () => {
    // Every low-Z material over-predicts at 1 MeV. Lead reverses sign, because the K- and L-shell
    // electrons it stops counting are a far larger share of its 82. That reversal is the physical
    // fingerprint of the omitted correction, not a fitting artefact.
    const p1 = PSTAR_HIGH_Z_REFERENCE.lead.points[0]!;
    expect(p1.T_MeV).toBe(1);
    expect(electronicMassStoppingPower(1, LEAD)).toBeLessThan(p1.electronic);

    for (const key of Object.keys(PSTAR_DATASETS) as (keyof typeof PSTAR_DATASETS)[]) {
      const ds = PSTAR_DATASETS[key];
      const lo = ds.points[0]!;
      expect(electronicMassStoppingPower(lo.T_MeV, MATERIALS[key]!)).toBeGreaterThan(lo.electronic);
    }
  });
});

describe('high-Z materials stay out of the shipped pipeline', () => {
  it('are absent from MATERIALS, so nothing in the dose path can select them', () => {
    expect(Object.keys(MATERIALS)).not.toContain('lead');
    expect(Object.keys(MATERIALS)).not.toContain('titanium');
  });

  it('are absent from PSTAR_DATASETS, so they never join the pass/fail suites', () => {
    expect(Object.keys(PSTAR_DATASETS)).not.toContain('lead');
    expect(Object.keys(PSTAR_DATASETS)).not.toContain('titanium');
  });

  it('lead would be the worst shield per areal density anyway — lowest <Z/A> of any entry', () => {
    // The validated monotonic property is that dose-equivalent falls with rising <Z/A>. Lead sits
    // below every shipped material on that axis, so the trend predicts it shields worst per g/cm².
    // PREDICTION, not a validated result: the model cannot reproduce lead's stopping power, so no
    // lead dose figure is computed or quoted anywhere.
    const shipped = Object.values(MATERIALS).map((m) => m.ZoverA);
    expect(LEAD.ZoverA).toBeLessThan(Math.min(...shipped));
  });
});

describe('high-Z reference input data', () => {
  for (const key of Object.keys(HIGH_Z_REFERENCE)) {
    const m = HIGH_Z_REFERENCE[key]!;
    const ds = (PSTAR_HIGH_Z_REFERENCE as Record<string, PstarDataset>)[key]!;

    it(`${key}: I matches the value PSTAR used`, () => {
      expect(m.I_eV).toBeCloseTo(ds.I_eV, 6);
    });

    it(`${key}: <Z/A> agrees with the elemental composition`, () => {
      const fromComposition = m.composition.reduce((s, e) => s + e.massFraction * (e.Z / e.A), 0);
      expect(fromComposition / m.ZoverA - 1).toBeCloseTo(0, 3);
    });

    it(`${key}: carries a real Sternheimer set (no δ≡0 sentinel — both are conductors)`, () => {
      const d = m.densityEffect;
      expect(d.x1).toBeGreaterThan(d.x0);
      expect(d.delta0).toBeGreaterThan(0);
    });
  }
});
