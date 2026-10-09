/**
 * Measured MSL/RAD cruise radiation values — the Phase-4 validation target.
 *
 * Primary source:
 *   C. Zeitlin et al., "Measurements of Energetic Particle Radiation in Transit to Mars
 *   on the Mars Science Laboratory", Science 340 (2013) 1080–1084. doi:10.1126/science.1235989
 * Modeling / conditions source:
 *   J. Guo et al., "Variations of dose rate observed by MSL/RAD in transit to Mars",
 *   Astron. Astrophys. 577 (2015) A58. doi:10.1051/0004-6361/201525680 (arXiv:1503.06631)
 *
 * NAMING NOTE: the file/export names are historical. The comparison values in RAD_CRUISE (0.458 mGy/day,
 * 1.75 mSv/day) are the RE-EVALUATED values of Guo et al. (2015, A&A 577, A58); the original Zeitlin et
 * al. (2013) values (0.481 ± 0.080 mGy/day, 1.84 ± 0.33 mSv/day) are kept in the comments below. <Q> = 3.82
 * is Zeitlin's. Names are not changed here to avoid touching imports.
 *
 * The MSL cruise ran 2011-11-26 → 2012-08-06 ("253-day cruise" as stated by Guo et al. 2015 and Köhler
 * et al. 2015 for these dates; the calendar-date difference is 254 days). RAD measured the GCR field PLUS
 * secondary particles produced in the spacecraft, behind real (anisotropic) shielding.
 */

export const RAD_CRUISE = {
  /** absorbed GCR dose rate in water, mGy/day (Guo 2015: 458 ± 32 µGy/day) */
  doseRate_mGy_day: 0.458,
  doseRate_sigma: 0.032,
  /** GCR dose-equivalent rate, mSv/day. Guo 2015: 1.75 ± 0.30 (after the re-evaluated Si→tissue
   *  conversion). Zeitlin 2013 (original): 1.84 ± 0.33 — confirmed from the paper text by the author.
   *  Two papers, two values; not a contradiction. Zeitlin's original absorbed dose in water: 481 ± 80
   *  µGy/day; the silicon-detector rate was 332 ± 23 µGy/day, × 1.38 → 458 ± 32 (Guo 2015). */
  doseEquivalent_mSv_day: 1.75,
  doseEquivalent_sigma: 0.3,
  /** mean quality factor ⟨Q⟩ (Zeitlin 2013) */
  meanQ: 3.82,
  meanQ_sigma: 0.25,
  /** representative average spacecraft shielding seen by RAD, g/cm² Al-equivalent (Guo 2015;
   *  most of the solid angle < 10 g/cm², broad tail to ~100, average ≈ 16) */
  shielding_gcm2: 16,
  shielding_low: 10,
  shielding_high: 20,
  /** solar modulation potential during cruise, MV (Guo 2015: 550–800) */
  phi_MV_low: 550,
  phi_MV_high: 800,
  /** round-trip cruise dose-equivalent estimate, Sv (Zeitlin 2013) */
  roundTrip_Sv: 0.66,
  cruiseDays: 253,
  source: 'Zeitlin et al., Science 340, 1080 (2013); Guo et al., A&A 577, A58 (2015)',
} as const;
