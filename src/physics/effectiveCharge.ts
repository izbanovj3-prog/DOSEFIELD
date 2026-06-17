/**
 * Barkas effective charge for a partially-stripped ion moving at velocity β=v/c:
 *
 *   z_eff = Z · [ 1 − exp(−125 · β · Z^(−2/3)) ]
 *
 * Source: W.H. Barkas, "Nuclear Research Emulsions" (1963); widely used form, e.g.
 * Ziegler/ICRU. z_eff → Z (fully stripped) at high velocity and is reduced at low β
 * where the ion picks up electrons. Used for the heavy-ion z_eff² stopping-power scaling.
 *
 * APPROXIMATION (labeled): a single empirical effective-charge form; it does not capture
 * shell-by-shell electron capture/loss in detail. Adequate because GCR dose is dominated
 * by ions above ~100 MeV/n, where z_eff ≈ Z.
 */
export function effectiveCharge(Z: number, beta: number): number {
  if (Z <= 1) return Z;
  return Z * (1 - Math.exp(-125 * beta * Math.pow(Z, -2 / 3)));
}
