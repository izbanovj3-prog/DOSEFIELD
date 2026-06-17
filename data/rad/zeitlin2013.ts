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
 * The MSL cruise ran 2011-11-26 → 2012-08-06 (~253 days). RAD measured the GCR field PLUS
 * secondary particles produced in the spacecraft, behind real (anisotropic) shielding.
 */

export const RAD_CRUISE = {
  /** absorbed GCR dose rate in water, mGy/day (Guo 2015: 458 ± 32 µGy/day) */
  doseRate_mGy_day: 0.458,
  doseRate_sigma: 0.032,
  /** GCR dose-equivalent rate, mSv/day (Guo 2015: 1.75 ± 0.30; Zeitlin 2013: 1.84 ± 0.33) */
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
