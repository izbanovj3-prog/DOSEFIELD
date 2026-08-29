/**
 * Physical constants for charged-particle stopping-power calculations.
 *
 * Sources:
 *  - CODATA 2018 recommended values (https://physics.nist.gov/cuu/Constants/)
 *  - PDG "Passage of particles through matter" review (Workman et al., PTEP 2022)
 *
 * Unit convention used throughout the physics core:
 *  - Energies in MeV
 *  - Mass stopping power in MeV·cm²/g
 *  - Areal density / range in g/cm²
 *  - <Z/A> in mol/g (so K·<Z/A> yields MeV·cm²/g; see K_BETHE below)
 */

/**
 * Bethe stopping-power coefficient K = 4π·N_A·r_e²·m_e·c².
 * Value 0.307075 MeV·mol⁻¹·cm² (PDG). Combined with <Z/A> [mol/g] and the
 * dimensionless stopping number L, gives mass stopping power in MeV·cm²/g.
 */
export const K_BETHE = 0.307075; // MeV·mol⁻¹·cm²

/** Electron rest energy m_e·c² (CODATA 2018). */
export const M_E_C2 = 0.51099895; // MeV

/** Proton rest energy m_p·c² (CODATA 2018). */
export const M_P_C2 = 938.27208816; // MeV

/** Atomic mass unit energy u·c² (CODATA 2018) — used for per-nucleon kinematics in Phase 2. */
export const M_U_C2 = 931.49410242; // MeV

/** Avogadro constant (CODATA 2018, exact). */
export const N_A = 6.02214076e23; // mol⁻¹

/**
 * Dose unit conversion:  MeV/g → Gray (J/kg).
 * 1 MeV = 1.602176634e-13 J (CODATA 2018, exact via the elementary charge), and 1/g = 1000/kg,
 * so 1 MeV/g = 1.602176634e-10 Gy.
 *
 * Single source on purpose: this factor and SECONDS_PER_DAY were previously re-declared as
 * private literals in doseModel.ts, shieldedDose.ts, fragmentedDose.ts, multiLayerDose.ts and
 * ui/dose.worker.ts. All five copies agreed, but nothing enforced that and `tsc` cannot catch a
 * divergence — one edited copy would silently make two dose paths disagree.
 */
export const MEV_PER_G_TO_GY = 1.602176634e-10; // Gy per (MeV/g)

/** Rate conversion: the model works per second, every reported dose is per day. */
export const SECONDS_PER_DAY = 86400; // s/day

export const LN10 = Math.LN10;
