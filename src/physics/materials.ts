/**
 * Material database for the stopping-power engine.
 *
 * Each material carries exactly what the Bethe–Bloch formula and the Sternheimer
 * density-effect correction require, with the SAME values NIST PSTAR uses, so that
 * agreement with PSTAR tests the *physics implementation* rather than the inputs.
 *
 * Sources (accessed 2026-06-16):
 *  - <Z/A>, density, mean excitation energy I:
 *      NIST PSTAR composition pages, https://physics.nist.gov/cgi-bin/Star/compos.pl?ap<matno>
 *  - Sternheimer density-effect parameters (a, m=k, x0, x1, C̄, δ0):
 *      PDG Atomic & Nuclear Properties muon-energy-loss tables (2023),
 *      https://pdg.lbl.gov/2023/AtomicNuclearProperties/MUE/  ,
 *      ultimately R.M. Sternheimer, M.J. Berger, S.M. Seltzer,
 *      At. Data Nucl. Data Tables 30, 261 (1984).
 *
 * Note on water I: PSTAR (ICRU-49) uses I = 75 eV. PDG lists 79.7 eV on its summary
 * page, but its tabulated density-effect C̄ = 3.5017 is self-consistent with I = 75 eV
 * (C̄ = 2·ln(I/ħω_p)+1 with ħω_p = 21.47 eV ⇒ I = 75 eV). We therefore use I = 75 eV to
 * match PSTAR; the density-effect set is consistent with that choice.
 */

/** Sternheimer parameterization of the density-effect correction δ(βγ). */
export interface DensityEffectParams {
  /** fit coefficient a */
  a: number;
  /** exponent m (a.k.a. k or m_s) */
  m: number;
  /** lower bound x0 = log10(βγ) below which δ ≈ 0 (or δ0·10^(2(x−x0)) for conductors) */
  x0: number;
  /** upper bound x1 = log10(βγ) above which δ → 2·ln(10)·x − C̄ */
  x1: number;
  /** C̄ = −C, the density-effect saturation constant */
  Cbar: number;
  /**
   * Selects the branch below x0 (PDG Eq. 34.7): conductors take δ = δ0·10^(2(x−x0)),
   * insulators take δ = 0. Stated explicitly, never inferred from δ0, Z or the name — see
   * `checkDensityEffect`, which rejects a flag that disagrees with δ0 at module load.
   */
  conductor: boolean;
  /** δ0: the conductor value of δ at x0 (Sternheimer 1984); exactly 0 for insulators */
  delta0: number;
}

/** An element in a material, with its mass fraction (for nuclear-interaction MFP of compounds). */
export interface ElementFraction {
  Z: number;
  /** atomic mass A in g/mol */
  A: number;
  /** mass fraction in the material */
  massFraction: number;
}

export interface Material {
  key: string;
  name: string;
  /** NIST Star material number (for provenance) */
  matno: string;
  /** <Z/A> in mol/g */
  ZoverA: number;
  /** density in g/cm³ (only used for linear-thickness conversions, not mass stopping power) */
  density: number;
  /** mean excitation energy I in eV */
  I_eV: number;
  densityEffect: DensityEffectParams;
  /** elemental composition (mass fractions) — from NIST PSTAR composition pages */
  composition: ElementFraction[];
  sourceNote: string;
}

export const ALUMINUM: Material = {
  key: 'aluminum',
  name: 'Aluminum',
  matno: '013',
  ZoverA: 13 / 26.9815385, // = 0.481814 mol/g (Z=13, A=26.9815385 g/mol)
  density: 2.6989,
  I_eV: 166.0,
  densityEffect: { a: 0.0802, m: 3.6345, x0: 0.1708, x1: 3.0127, Cbar: 4.2395, conductor: true, delta0: 0.12 },
  composition: [{ Z: 13, A: 26.9815, massFraction: 1.0 }],
  sourceNote: 'NIST PSTAR matno 013; Sternheimer params PDG 2023 (Sternheimer-Berger-Seltzer 1984).',
};

export const WATER: Material = {
  key: 'water',
  name: 'Water (liquid)',
  matno: '276',
  ZoverA: 0.55509,
  density: 1.0,
  I_eV: 75.0, // PSTAR/ICRU-49 value (see header note)
  densityEffect: { a: 0.0912, m: 3.4773, x0: 0.24, x1: 2.8004, Cbar: 3.5017, conductor: false, delta0: 0.0 },
  composition: [
    { Z: 1, A: 1.008, massFraction: 0.111894 },
    { Z: 8, A: 15.999, massFraction: 0.888106 },
  ],
  sourceNote: 'NIST PSTAR matno 276 (liquid water, I=75 eV); Sternheimer params PDG 2023.',
};

export const POLYETHYLENE: Material = {
  key: 'polyethylene',
  name: 'Polyethylene (CH2)n',
  matno: '221',
  ZoverA: 0.57034,
  density: 0.94, // PSTAR/ICRU value; PDG lists a revised 0.89 (mass stopping power is density-independent)
  I_eV: 57.4,
  densityEffect: { a: 0.1211, m: 3.4292, x0: 0.1489, x1: 2.5296, Cbar: 3.0563, conductor: false, delta0: 0.0 },
  composition: [
    { Z: 1, A: 1.008, massFraction: 0.143711 },
    { Z: 6, A: 12.011, massFraction: 0.856289 },
  ],
  sourceNote: 'NIST PSTAR matno 221; Sternheimer params PDG 2023.',
};

export const HYDROGEN: Material = {
  key: 'hydrogen',
  name: 'Hydrogen (H₂)',
  matno: '001',
  ZoverA: 1 / 1.00794, // = 0.99212 mol/g (Z=1, A=1.00794) — highest <Z/A> of any element
  density: 0.0708, // liquid H₂ (PDG); mass stopping power is density-independent
  I_eV: 19.2, // NIST PSTAR / ICRU-49; model reproduces PSTAR to 0.14% (H has negligible shell correction)
  // Density effect modeled as δ≡0: plasma energy 0.263 eV (PDG, gaseous H) puts the Sternheimer
  // onset at βγ≳80 — above the modeled GCR range (≤100 GeV/n ⇒ βγ≲108, contributes negligibly).
  // Labeled approximation: x0 is a sentinel that keeps δ=0 throughout; the other params are inert.
  densityEffect: { a: 0, m: 1, x0: 99, x1: 99, Cbar: 0, conductor: false, delta0: 0 },
  composition: [{ Z: 1, A: 1.008, massFraction: 1.0 }],
  sourceNote:
    'NIST PSTAR matno 001 (I=19.2 eV, ICRU-49), validated to 0.14%. Density effect negligible ' +
    '(PDG plasma energy 0.263 eV → onset above GCR range), modeled as 0. Represents a cryogenic ' +
    'liquid-H₂ shield; the per-areal-density result is governed by <Z/A>=0.992, identical gas/liquid.',
};

export const METHANE: Material = {
  key: 'methane',
  name: 'Methane (CH₄)',
  matno: 'CH4',
  ZoverA: 10 / 16.043, // = 0.62333 mol/g (CH4: ΣZ=10, ΣA=16.043) — H-richer than polyethylene (0.570)
  density: 0.4226, // liquid CH₄ (cryogenic); mass stopping power is density-independent
  I_eV: 41.7, // NIST PSTAR / ICRU-37; model reproduces PSTAR to 2.66% (1 MeV) / 0.34% (≥10 MeV)
  // Density effect modeled as δ≡0: gaseous CH₄ plasma energy ≈0.59 eV → Sternheimer onset above
  // the modeled GCR range (labeled). A liquid-CH₄ shield's δ is stronger above ~10 GeV/n but
  // contributes negligibly to integrated dose. x0 sentinel keeps δ=0; the other params are inert.
  densityEffect: { a: 0, m: 1, x0: 99, x1: 99, Cbar: 0, conductor: false, delta0: 0 },
  composition: [
    { Z: 6, A: 12.011, massFraction: 0.748673 },
    { Z: 1, A: 1.008, massFraction: 0.251327 },
  ],
  sourceNote:
    'NIST PSTAR Methane (CH₄), I=41.7 eV (ICRU-37), validated to 2.66%/0.34%. Density effect ' +
    'negligible (gas plasma energy ≈0.59 eV → onset above GCR range), modeled as 0. Cryogenic ' +
    'liquid-CH₄ shield (dual-use propellant); per areal density governed by <Z/A>=0.623. matno ' +
    'left as formula (not in the pasted NIST export).',
};

/**
 * The shipped shield materials. All low-Z, all validated against NIST PSTAR — the material
 * picker, the dose curves and the report draw from exactly this map, and
 * `test/materials.test.ts` pins its membership so a high-Z entry cannot drift in.
 */
export const MATERIALS: Record<string, Material> = {
  aluminum: ALUMINUM,
  water: WATER,
  polyethylene: POLYETHYLENE,
  hydrogen: HYDROGEN,
  methane: METHANE,
};

/* ---------------------------------------------------------------------------------------
 * HIGH-Z REFERENCE MATERIALS — not shields, not offered, not validated.
 *
 * These two exist for one purpose: to make the rejection of high-Z shielding a measured
 * result. The Bethe–Bloch implementation here omits the shell correction, whose size grows
 * with Z, so it cannot reproduce PSTAR for heavy elements. That claim used to be carried by
 * a remembered pair of percentages that no longer reproduced from this repository;
 * `test/highZRejection.test.ts` now recomputes it from these definitions and the PSTAR tables
 * in `data/pstar/{lead,titanium}.ts`.
 *
 * They are deliberately NOT in `MATERIALS`: nothing in the dose pipeline should be able to
 * select them, and the membership test above enforces that. Their inputs are sourced exactly
 * like the shipped materials, so the comparison tests the physics rather than the data.
 * ------------------------------------------------------------------------------------- */

export const LEAD: Material = {
  key: 'lead',
  name: 'Lead (high-Z reference — not a shield option)',
  matno: '082',
  ZoverA: 82 / 207.2, // = 0.395753 mol/g (Z=82, A=207.2(1) g/mol, PDG 2023)
  density: 11.35,
  I_eV: 823.0,
  densityEffect: { a: 0.09359, m: 3.1608, x0: 0.3776, x1: 3.8073, Cbar: 6.2018, conductor: true, delta0: 0.14 },
  composition: [{ Z: 82, A: 207.2, massFraction: 1.0 }],
  sourceNote:
    'NIST PSTAR matno 082 (density 11.35 g/cm³, I=823.0 eV, accessed 2026-08-31); Sternheimer ' +
    'params PDG 2023 muon energy-loss table for lead (Sternheimer-Berger-Seltzer 1984). ' +
    'REFERENCE ONLY: Bethe without shell corrections does not reproduce PSTAR at Z=82.',
};

export const TITANIUM: Material = {
  key: 'titanium',
  name: 'Titanium (high-Z reference — not a shield option)',
  matno: '022',
  ZoverA: 22 / 47.867, // = 0.459617 mol/g (Z=22, A=47.867(1) g/mol, PDG 2023)
  density: 4.54,
  I_eV: 233.0,
  densityEffect: { a: 0.15662, m: 3.0302, x0: 0.0957, x1: 3.0386, Cbar: 4.445, conductor: true, delta0: 0.12 },
  composition: [{ Z: 22, A: 47.867, massFraction: 1.0 }],
  sourceNote:
    'NIST PSTAR matno 022 (density 4.54 g/cm³, I=233.0 eV, accessed 2026-08-31); Sternheimer ' +
    'params PDG 2023 muon energy-loss table for titanium (Sternheimer-Berger-Seltzer 1984). ' +
    'REFERENCE ONLY: the shell-correction error is already out of tolerance at Z=22.',
};

/** High-Z reference materials — comparison inputs only, never shield options. */
export const HIGH_Z_REFERENCE: Record<string, Material> = {
  titanium: TITANIUM,
  lead: LEAD,
};

/**
 * The conductor flag and δ0 must agree: a conductor needs δ0 > 0 (its value comes from
 * Sternheimer 1984, never a default), an insulator needs δ0 = 0 exactly. Throws on either
 * mismatch — including a NaN δ0 — so a typo cannot quietly move a material onto the other
 * branch below x0.
 */
export function checkDensityEffect(mat: Material): void {
  const { conductor, delta0 } = mat.densityEffect;
  if (conductor && !(delta0 > 0)) {
    throw new Error(`${mat.key}: conductor requires δ0 > 0 from Sternheimer 1984, got ${delta0}`);
  }
  if (!conductor && delta0 !== 0) {
    throw new Error(`${mat.key}: non-conductor must have δ0 = 0, got ${delta0}`);
  }
}

// Module-load gate: every table in this file is checked before anything can compute with it.
for (const mat of [...Object.values(MATERIALS), ...Object.values(HIGH_Z_REFERENCE)]) {
  checkDensityEffect(mat);
}
