/**
 * Input-uncertainty propagation (Phase A) — every constant traceable to a published source.
 *
 * WHAT THIS BAND IS: the 1σ-style relative uncertainty of the computed dose-equivalent that
 * follows from the two dominant INPUTS — the GCR flux model and the stopping-power data —
 * treated as independent multiplicative (fully energy-correlated) scale errors and combined
 * in quadrature. Dose is linear in flux and, to first order, scales with stopping power, so
 * scale errors pass through directly; this is the standard first-order treatment.
 *
 * WHAT THIS BAND IS NOT (labeled honestly, do not widen or narrow it silently):
 *  - It does NOT include model-form error: the un-transported secondary charged particles /
 *    target fragments that cause the documented 0.67× absorbed-dose gap vs MSL/RAD. That gap
 *    is a scope limit, not an input uncertainty, and is reported separately.
 *  - It does NOT assign an uncertainty to ICRP-60 Q(L): a regulatory convention, not a
 *    measured quantity (definitional).
 *  - The GCR component is constrained by AMS-02 for H and He only; Z ≥ 3 spectra are ASSUMED
 *    to carry comparable uncertainty (stated assumption — no published per-ion figure found
 *    that we could verify; see METHODS).
 *
 * Sources (verified this project, see also README "Data sources"):
 *  - GCR flux (DLR/Matthiä 2013 model vs AMS-02): Norbury, Whitman, Lee, Slaba & Badavi,
 *    "Comparison of space radiation GCR models to recent AMS data",
 *    Life Sci. Space Res. 18 (2018) 64–71, Table 1. DLR |Rd| for HYDROGEN:
 *    14% (<1.5 GeV/n — the range providing ~50% of effective dose behind 20 g/cm² Al,
 *    per Slaba & Blattnig 2014 as cited therein), 5.3% (1.5–4 GeV/n), 2.7% (4–20 GeV/n);
 *    HELIUM ≤ 2.8% in every range. We take the LARGEST dose-dominant-range value (14%)
 *    for all species — conservative by construction.
 *  - Stopping power: ICRU Report 49 stated accuracy, as quoted in the NIST STAR
 *    documentation — collision stopping powers "1% to 2% for elements, 1% to 4% for
 *    compounds" in the high-energy region (our integration floor is 10 MeV/n, well inside
 *    it). We take 4% — the compound (water target) bound.
 *  - Implementation error is NOT a constant here: pass the computed max deviation vs NIST
 *    PSTAR (computeNistStoppingSummary().maxSolidPct) so the band always uses THIS RUN's
 *    number — never a stale copy.
 */

/** GCR-flux relative uncertainty — Norbury et al. 2018, Table 1 (see header). */
export const GCR_FLUX_REL_UNC = 0.14;

/** Stopping-power data relative uncertainty — ICRU-49 compound bound (see header). */
export const STOPPING_REL_UNC_ICRU = 0.04;

/**
 * Total relative 1σ-style input uncertainty of the dose-equivalent.
 * @param implRelUnc this run's computed max |model−PSTAR| relative deviation (≥10 MeV),
 *                   e.g. computeNistStoppingSummary().maxSolidPct / 100
 */
export function doseRelUncertainty(implRelUnc: number): number {
  const stopping = Math.hypot(STOPPING_REL_UNC_ICRU, implRelUnc);
  return Math.hypot(GCR_FLUX_REL_UNC, stopping);
}
