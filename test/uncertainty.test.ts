import { describe, it, expect } from 'vitest';
import { GCR_FLUX_REL_UNC, STOPPING_REL_UNC_ICRU, doseRelUncertainty } from '../src/validation/uncertainty.js';
import { computeNistStoppingSummary } from '../src/validation/validationSummary.js';

describe('Phase A — input-uncertainty propagation', () => {
  it('cited constants match their sources (Norbury 2018 Table 1; ICRU-49 via NIST STAR)', () => {
    // These are transcriptions of published values — a change here must come with a new citation.
    expect(GCR_FLUX_REL_UNC).toBe(0.14);
    expect(STOPPING_REL_UNC_ICRU).toBe(0.04);
  });

  it('is the quadrature of the components', () => {
    const impl = 0.0155;
    const expected = Math.sqrt(0.14 ** 2 + 0.04 ** 2 + impl ** 2);
    expect(doseRelUncertainty(impl)).toBeCloseTo(expected, 12);
  });

  it('is never smaller than its largest component and grows with each component', () => {
    expect(doseRelUncertainty(0)).toBeGreaterThanOrEqual(GCR_FLUX_REL_UNC);
    expect(doseRelUncertainty(0.05)).toBeGreaterThan(doseRelUncertainty(0.01));
  });

  it('with this run’s computed PSTAR deviation the total stays ≈15% (flux-dominated)', () => {
    const implRel = computeNistStoppingSummary().maxSolidPct / 100; // computed, not typed in
    const total = doseRelUncertainty(implRel);
    expect(implRel).toBeLessThan(0.05); // sanity on the computed input itself
    expect(total).toBeGreaterThan(GCR_FLUX_REL_UNC); // components add, if only slightly
    expect(total).toBeLessThan(0.16); // flux term dominates; a jump means an input regressed
  });
});
