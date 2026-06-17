/**
 * Galactic Cosmic Ray differential flux — Matthiä et al. (2013) "ready-to-use" model.
 *
 * Source (cite this, do NOT claim it as Badhwar–O'Neill itself):
 *   D. Matthiä, T. Berger, A.I. Mrigakshi, G. Reitz,
 *   "A ready-to-use galactic cosmic ray model",
 *   Advances in Space Research 51 (2013) 329–338. doi:10.1016/j.asr.2012.09.022
 *
 * This is the DLR modification of the ISO 15390 model: a compact PARAMETRIC fit (per
 * element Z=1..28) intended to be ingested directly, that reproduces Badhwar–O'Neill /
 * measured GCR spectra given a single solar-modulation parameter W (0 = least modulated /
 * solar minimum / highest GCR ... up to ~200 = strong solar maximum).
 *
 * Coefficients (AI, CI, gammaI, alphaI) and the flux equation are transcribed verbatim
 * from the reference implementation:
 *   https://github.com/ssc-maire/CosRayModifiedISO (internalFunctions/pythonModifiedISO.py),
 * accessed 2026-06-16. Validity: E ≥ 10 MeV/n, 0 ≤ W ≤ 200, 1 ≤ Z ≤ 28.
 *
 * Output flux units: particles / (cm² · s · sr · (MeV/nucleon)).
 */

export interface GcrSpecies {
  Z: number;
  symbol: string;
  /** atomic mass number A used by the model */
  A: number;
  /** normalization coefficient C_i */
  C: number;
  /** spectral index γ_i */
  gamma: number;
  /** spectral index α_i */
  alpha: number;
}

// Per-element coefficients, index = Z-1 (H..Ni). Verbatim from Matthiä 2013 / reference impl.
const SYMBOLS = [
  'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne',
  'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca',
  'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni',
];
const AI = [
  1.0, 4.0, 6.9, 9.0, 10.8, 12.0, 14.0, 16.0, 19.0, 20.2,
  23.0, 24.3, 27.0, 28.1, 31.0, 32.1, 35.4, 39.9, 39.1, 40.1,
  44.9, 47.9, 50.9, 52.0, 54.9, 55.8, 58.9, 58.7,
];
const CI = [
  1.85e4, 3.69e3, 19.5, 17.7, 49.2, 103.0, 36.7, 87.4, 3.19, 16.4,
  4.43, 19.3, 4.17, 13.4, 1.15, 3.06, 1.3, 2.33, 1.87, 2.17,
  0.74, 2.63, 1.23, 2.12, 1.14, 9.32, 0.1, 0.48,
];
const GAMMAI = [
  2.74, 2.77, 2.82, 3.05, 2.96, 2.76, 2.89, 2.7, 2.82, 2.76,
  2.84, 2.7, 2.77, 2.66, 2.89, 2.71, 3.0, 2.93, 3.05, 2.77,
  2.97, 2.99, 2.94, 2.89, 2.74, 2.63, 2.63, 2.63,
];
const ALPHAI = [
  2.85, 3.12, 3.41, 4.3, 3.93, 3.18, 3.77, 3.11, 4.05, 3.11,
  3.14, 3.65, 3.46, 3.0, 4.04, 3.3, 4.4, 4.33, 4.49, 2.93,
  3.78, 3.79, 3.5, 3.28, 3.29, 3.01, 4.25, 3.52,
];

export const GCR_SPECIES: GcrSpecies[] = SYMBOLS.map((symbol, i) => ({
  Z: i + 1,
  symbol,
  A: AI[i]!,
  C: CI[i]!,
  gamma: GAMMAI[i]!,
  alpha: ALPHAI[i]!,
}));

export function getGcrSpecies(Z: number): GcrSpecies {
  const s = GCR_SPECIES[Z - 1];
  if (!s) throw new Error(`No GCR species for Z=${Z} (valid 1..28)`);
  return s;
}

/**
 * Solar-modulation parameter presets (dimensionless W of the Matthiä model).
 *  - SOLAR_MIN: W = 0, the least-modulated / maximal-GCR limit (worst case for dose,
 *    ≈ deep solar minimum such as 2009). The project spec asks for solar minimum.
 *  - SOLAR_MAX: W = 130, representative strong solar maximum (strongest modulation).
 */
export const W_SOLAR_MIN = 0;
export const W_SOLAR_MAX = 130;

/**
 * Solar modulation for the MSL/RAD cruise (2011-11 → 2012-08), rising solar activity.
 * Set INDEPENDENTLY of the RAD measurement (no tuning to fit): the cruise modulation
 * potential was φ ≈ 550–800 MV (Guo et al. 2015); via the model's OULU→W relation
 * (W = −0.093·R_OULU[/min] + 638.7), the ~2012 neutron-monitor level (~108 counts/s)
 * maps to W ≈ 30. Bracketed by W_CRUISE_LOW..HIGH for the honest error budget.
 */
export const W_CRUISE_2012 = 30;
export const W_CRUISE_LOW = 20;
export const W_CRUISE_HIGH = 45;

/**
 * Matthiä 2013 differential GCR flux for species Z at kinetic energy per nucleon
 * E_n [MeV/n] and solar modulation W. Returns particles/(cm²·s·sr·(MeV/n)).
 * Equation transcribed verbatim from the reference implementation.
 */
export function differentialFluxMatthia(Z: number, E_n_MeV: number, W: number): number {
  const sp = getGcrSpecies(Z);
  const A = sp.A;
  // rest energy per nucleon in GeV/n (model uses 0.938 for protons, 0.939 for Z>1)
  const restmass = Z > 1 ? 0.939 : 0.938;

  const x = 0.001 * E_n_MeV; // MeV/n -> GeV/n
  const pPerNucleon = Math.sqrt(x * (x + 2 * restmass)); // GeV/n
  const rigidity = (A / Z) * pPerNucleon; // GV
  const beta = pPerNucleon / (x + restmass);

  // DLR-modified ISO modulation
  const R0 = 0.37 + 0.0003 * Math.pow(W, 1.45);
  const delta = 0.02 * W + 4.7;
  const phi =
    sp.C *
    Math.pow(beta, sp.alpha) /
    Math.pow(rigidity, sp.gamma) *
    Math.pow(rigidity / (rigidity + R0), delta);

  // unit/Jacobian factors (rigidity-space -> energy-space, m^-2 -> cm^-2, GeV/n -> MeV/n)
  return 0.0001 * phi * (A / Z) * 0.001 / beta;
}
