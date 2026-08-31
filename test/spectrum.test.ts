/**
 * The two dose spectra (src/ui/spectrum.ts) are presentation-layer views of integrands the dose
 * engines already sum. Two things have to stay true, and this file is what keeps them true:
 *
 *  1. CLOSURE — integrating a spectrum over its own log₁₀ energy axis reproduces the engine result
 *     it belongs to. On matched Simpson nodes the two are the same sum, so the agreement is at
 *     floating-point level; at the coarser display density it must still be far inside the model's
 *     own uncertainty. A chart that did not close would be a decorative curve, not a decomposition.
 *
 *  2. SEPARATION — the incident spectrum is differential in INCIDENT energy and the shielded one in
 *     RESIDUAL energy behind the stack. They live on different abscissae; neither is re-projected
 *     into the other's coordinates. The grids are asserted to differ so a future "let's just put
 *     them on one axis" edit fails here rather than silently shipping.
 */
import { describe, it, expect } from 'vitest';
import {
  incidentSpectrum,
  shieldedSpectrum,
  T_INCIDENT_LO,
  E_RESIDUAL_LO,
  SPEC_PER_DECADE,
} from '../src/ui/spectrum.js';
import { computeFreeSpaceDose } from '../src/dose/doseModel.js';
import { computeShieldedDose } from '../src/dose/shieldedDose.js';
import { computeFragmentedDose } from '../src/dose/fragmentedDose.js';
import { computeMultiLayerDose, computeMultiLayerFragmentedDose } from '../src/dose/multiLayerDose.js';

const rel = (a: number, b: number): number => Math.abs(a - b) / b;

const AL10 = [{ material: 'aluminum', thickness: 10 }];
const PE10 = [{ material: 'polyethylene', thickness: 10 }];
const STACK = [
  { material: 'aluminum', thickness: 10 },
  { material: 'polyethylene', thickness: 5 },
];

describe('incident dose spectrum — closure against the free-space engine', () => {
  for (const W of [0, 130]) {
    it(`∫ dH/dlog₁₀T = computeFreeSpaceDose at matched nodes (W=${W})`, () => {
      const engine = computeFreeSpaceDose(W, 100).doseEquivalent_mSv_day;
      expect(rel(incidentSpectrum(W, 100).integral, engine)).toBeLessThan(1e-12);
    });

    it(`display density still closes to <0.1% (W=${W})`, () => {
      const engine = computeFreeSpaceDose(W, 100).doseEquivalent_mSv_day;
      expect(rel(incidentSpectrum(W, SPEC_PER_DECADE).integral, engine)).toBeLessThan(1e-3);
    });
  }
});

describe('behind-shield dose spectrum — closure against the shielded engines', () => {
  for (const W of [0, 130]) {
    for (const [name, layers] of [['Al 10', AL10], ['PE 10', PE10], ['Al 10 + PE 5', STACK]] as const) {
      it(`∫ dH/dlog₁₀E_out = computeMultiLayerDose at matched nodes — ${name}, W=${W}`, () => {
        const engine = computeMultiLayerDose(layers, W, 100).doseEquivalent_mSv_day;
        expect(rel(shieldedSpectrum(layers, W, false, 100).integral, engine)).toBeLessThan(1e-12);
      });

      it(`display density still closes to <0.1% — ${name}, W=${W}`, () => {
        const engine = computeMultiLayerDose(layers, W, 100).doseEquivalent_mSv_day;
        expect(rel(shieldedSpectrum(layers, W, false, SPEC_PER_DECADE).integral, engine)).toBeLessThan(1e-3);
      });
    }
  }

  // The single-slab path is the VALIDATED one (NIST PSTAR + MSL/RAD), so the spectrum has to close
  // against it too — within the same tolerance the repo already asserts for multi-layer ≡ single.
  it('single slab: closes against computeShieldedDose within 0.5%', () => {
    const engine = computeShieldedDose('aluminum', 10, 0, 100).doseEquivalent_mSv_day;
    expect(rel(shieldedSpectrum(AL10, 0, false, 100).integral, engine)).toBeLessThan(5e-3);
  });

  it('fragmentation mode closes against the fragmented engines', () => {
    const ml = computeMultiLayerFragmentedDose(STACK, 0, 60).doseEquivalent_mSv_day;
    expect(rel(shieldedSpectrum(STACK, 0, true, 60).integral, ml)).toBeLessThan(1e-12);
    const single = computeFragmentedDose('aluminum', 10, 0, 60).doseEquivalent_mSv_day;
    expect(rel(shieldedSpectrum(AL10, 0, true, 60).integral, single)).toBeLessThan(5e-3);
  });

  it('an empty stack reduces to the incident spectrum (the engine short-circuits to free space)', () => {
    const empty = shieldedSpectrum([{ material: 'aluminum', thickness: 0 }], 0, false, 100);
    expect(empty.T[0]).toBeCloseTo(T_INCIDENT_LO, 6);
    expect(rel(empty.integral, computeFreeSpaceDose(0, 100).doseEquivalent_mSv_day)).toBeLessThan(1e-12);
  });
});

describe('the two spectra stay on separate energy axes', () => {
  it('incident starts at the flux validity floor, residual an order of magnitude lower', () => {
    const inc = incidentSpectrum(0);
    const shielded = shieldedSpectrum(AL10, 0);
    expect(inc.T[0]).toBeCloseTo(T_INCIDENT_LO, 6);
    expect(shielded.T[0]).toBeCloseTo(E_RESIDUAL_LO, 6);
    expect(shielded.T[0]!).toBeLessThan(inc.T[0]!);
    expect(shielded.T.length).not.toBe(inc.T.length);
  });

  it('shielding moves the per-decade peak up in energy — the slow ions are the ones removed', () => {
    // Not a tuned target: an ion only reaches the target if its range exceeded the shield, so the
    // surviving population is harder. Guards the panel against being fed the incident curve.
    const inc = incidentSpectrum(0);
    const shielded = shieldedSpectrum(AL10, 0);
    expect(shielded.peakT).toBeGreaterThan(inc.peakT);
  });

  it('a thicker shield lowers the integral of the residual spectrum', () => {
    const thin = shieldedSpectrum([{ material: 'aluminum', thickness: 5 }], 0);
    const thick = shieldedSpectrum([{ material: 'aluminum', thickness: 30 }], 0);
    expect(thick.integral).toBeLessThan(thin.integral);
  });
});
