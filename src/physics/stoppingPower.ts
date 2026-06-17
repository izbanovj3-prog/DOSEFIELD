/**
 * Bethe–Bloch electronic (collision) mass stopping power, −(1/ρ)·dE/dx, in MeV·cm²/g,
 * with the Sternheimer density-effect correction.
 *
 * This is the quantity NIST PSTAR labels "electronic stopping power". It excludes
 * "nuclear stopping power" (elastic recoil), which is < 0.1 % of the total above ~1 MeV
 * and is irrelevant to the GCR energy range; we therefore validate against PSTAR's
 * electronic column directly.
 *
 * Reference formula (PDG "Passage of particles through matter", Eq. 34.5):
 *
 *   −(1/ρ) dE/dx = K · z² · (Z/A) · (1/β²) · [ ½·ln( 2·m_e·c²·β²·γ²·T_max / I² )
 *                                              − β² − δ(βγ)/2 ]
 *
 * APPROXIMATIONS (Phase 1 — explicitly labeled, per project honesty rules):
 *  - Shell correction (−C/Z) is OMITTED. It matters below ~10 MeV for protons; its
 *    omission makes us a few % high there (the standard Bethe low-energy limitation).
 *  - Barkas (z³) and Bloch (z⁴) higher-order corrections are OMITTED (sub-% for protons).
 *  - Below ~1 MeV the Bethe formula itself breaks down (the projectile velocity nears
 *    atomic-electron velocities); we do NOT trust or use it there.
 */

import { K_BETHE, M_E_C2, LN10 } from './constants.js';
import type { DensityEffectParams, Material } from './materials.js';

export interface Kinematics {
  /** Lorentz γ = 1 + T/(m·c²) */
  gamma: number;
  /** β² = 1 − 1/γ² */
  beta2: number;
  /** βγ (momentum in units of m·c) */
  betaGamma: number;
}

/** Relativistic kinematics from kinetic energy T and rest energy m·c² (both MeV). */
export function kinematics(T_MeV: number, restMass_MeV: number): Kinematics {
  const gamma = 1 + T_MeV / restMass_MeV;
  const beta2 = 1 - 1 / (gamma * gamma);
  const betaGamma = Math.sqrt(beta2) * gamma;
  return { gamma, beta2, betaGamma };
}

/**
 * Maximum kinetic energy transferable to a free electron in a single collision (MeV).
 *   T_max = 2·m_e·c²·β²·γ² / (1 + 2γ·m_e/M + (m_e/M)²)
 * Full form (not the M ≫ m_e shortcut), valid for heavy projectiles at all energies here.
 */
export function maxEnergyTransfer(beta2: number, gamma: number, restMass_MeV: number): number {
  const r = M_E_C2 / restMass_MeV;
  return (2 * M_E_C2 * beta2 * gamma * gamma) / (1 + 2 * gamma * r + r * r);
}

/**
 * Sternheimer density-effect correction δ(βγ).
 *   x = log10(βγ)
 *   x ≥ x1:            δ = 2·ln(10)·x − C̄
 *   x0 ≤ x < x1:       δ = 2·ln(10)·x − C̄ + a·(x1 − x)^m
 *   x  < x0 (cond.):   δ = δ0·10^(2(x − x0))      [conductors only]
 *   x  < x0 (insul.):  δ = 0
 */
export function densityEffect(betaGamma: number, p: DensityEffectParams): number {
  const x = Math.log10(betaGamma);
  if (x >= p.x1) return 2 * LN10 * x - p.Cbar;
  if (x >= p.x0) return 2 * LN10 * x - p.Cbar + p.a * Math.pow(p.x1 - x, p.m);
  return p.delta0 > 0 ? p.delta0 * Math.pow(10, 2 * (x - p.x0)) : 0;
}

/**
 * Electronic mass stopping power −(1/ρ)·dE/dx in MeV·cm²/g.
 *
 * @param T_MeV       projectile kinetic energy (total, not per-nucleon) in MeV
 * @param mat         target material
 * @param z           projectile charge number (1 for proton)
 * @param restMass    projectile rest energy in MeV (default proton)
 */
export function electronicMassStoppingPower(
  T_MeV: number,
  mat: Material,
  z = 1,
  restMass_MeV = 938.27208816,
): number {
  const { gamma, beta2, betaGamma } = kinematics(T_MeV, restMass_MeV);
  const tMax = maxEnergyTransfer(beta2, gamma, restMass_MeV);
  const I_MeV = mat.I_eV * 1e-6;
  const delta = densityEffect(betaGamma, mat.densityEffect);

  // Stopping number L = ½·ln(2·m_e·c²·β²·γ²·T_max / I²) − β² − δ/2
  const L =
    0.5 * Math.log((2 * M_E_C2 * beta2 * gamma * gamma * tMax) / (I_MeV * I_MeV)) -
    beta2 -
    delta / 2;

  return K_BETHE * z * z * mat.ZoverA * (1 / beta2) * L;
}
