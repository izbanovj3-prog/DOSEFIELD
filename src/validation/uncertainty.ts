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
 *    target fragments that cause the documented absorbed-dose gap vs MSL/RAD. That gap
 *    is a scope limit, not an input uncertainty, and is reported separately.
 *  - It does NOT assign an uncertainty to ICRP-60 Q(L): a regulatory convention, not a
 *    measured quantity (definitional).
 *  - The GCR component is constrained by AMS-02 for H and He only; Z ≥ 3 spectra are ASSUMED
 *    to carry comparable uncertainty (stated assumption — no published per-ion figure found
 *    that we could verify; see METHODS). Whitman et al., Life Sci. Space Res. 22 (2019) 76–88,
 *    Table 2 (read 2026-09-27, NTRS 20200002746): DLR full-spectrum |Rd| vs AMS = C 8.2%, O 6.5%,
 *    N 4.2%, Li 32%, Be 29%, B 16%. It covers Z = 3–8 only; Z ≥ 9 (≈76% of free-space H at W = 0)
 *    remains unconstrained, so the single 20% factor is kept — AUTHOR DECISION whether to adopt a
 *    species-resolved uncertainty.
 *
 * Sources (verified this project, see also README "Data sources"):
 *  - GCR flux (DLR/Matthiä 2013 model vs AMS-02): Norbury, Whitman, Lee, Slaba & Badavi,
 *    "Comparison of space radiation GCR models to recent AMS data",
 *    Life Sci. Space Res. 18 (2018) 64–71, Table 1. DLR |Rd| for HYDROGEN:
 *    <1.5 GeV/n = 14%, 1.5–4 GeV/n = 5.3%, >4 GeV/n = 22%, 4–20 GeV/n = 2.7%,
 *    FULL SPECTRUM = 20% (re-read from the NTRS accepted-manuscript PDF, 2026-09-27);
 *    HELIUM ≤ 2.8% in every range. The dose integral spans the whole incident spectrum, so we take
 *    the FULL-SPECTRUM hydrogen value (20%) for all species. It is not the largest entry (the
 *    >4 GeV/n bin is 22%), and the AMS-02 "full spectrum" covers the AMS energy range, not the
 *    model's 10 MeV/n – 100 GeV/n integration range; Z ≥ 3 is assumed, not measured.
 *  - Stopping power: ICRU Report 49 stated accuracy, as quoted in the NIST STAR
 *    documentation — collision stopping powers "1% to 2% for elements, 1% to 4% for
 *    compounds" in the high-energy region (our integration floor is 10 MeV/n, well inside
 *    it). We take 4%, the upper bound for compounds, and apply it to ALL materials as a
 *    conservative choice (aluminium and hydrogen are elements, for which the bound is 1–2%).
 *    Quote verified on physics.nist.gov/PhysRefData/Star/Text/programs.html (2026-09-27).
 *  - Implementation error is NOT a constant here: pass the computed max deviation vs NIST
 *    PSTAR (computeNistStoppingSummary().maxSolidPct) so the band always uses THIS RUN's
 *    number — never a stale copy.
 */

/** GCR-flux relative uncertainty — Norbury et al. 2018, Table 1 (see header). */
export const GCR_FLUX_REL_UNC = 0.2;

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
