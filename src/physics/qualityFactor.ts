/**
 * ICRP-60 radiation quality factor Q as a function of unrestricted LET (L) in water.
 *
 * Source: ICRP Publication 60 (1991), "1990 Recommendations of the International
 * Commission on Radiological Protection", Annals of the ICRP 21(1–3), Q(L) relationship:
 *
 *   Q(L) = 1                 for L < 10  keV/µm
 *   Q(L) = 0.32·L − 2.2      for 10 ≤ L ≤ 100 keV/µm
 *   Q(L) = 300 / √L          for L > 100 keV/µm
 *
 * L is the unrestricted linear energy transfer in water, in keV/µm.
 */
export function qualityFactorICRP60(let_keV_per_um: number): number {
  const L = let_keV_per_um;
  if (L < 10) return 1;
  if (L <= 100) return 0.32 * L - 2.2;
  return 300 / Math.sqrt(L);
}

/**
 * Unrestricted LET in a material, derived from mass stopping power.
 *   L[keV/µm] = S[MeV·cm²/g] · ρ[g/cm³] · 0.1
 * (since S·ρ = dE/dx [MeV/cm], and 1 MeV/cm = 0.1 keV/µm).
 */
export function letFromMassStopping(massStopping_MeV_cm2_g: number, density_g_cm3: number): number {
  return massStopping_MeV_cm2_g * density_g_cm3 * 0.1;
}
