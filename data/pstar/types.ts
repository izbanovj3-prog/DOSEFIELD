/** One row of a NIST PSTAR proton table. */
export interface PstarPoint {
  /** proton kinetic energy, MeV */
  T_MeV: number;
  /** electronic (collision) stopping power, MeV·cm²/g — what Bethe–Bloch computes */
  electronic: number;
  /** total stopping power (electronic + nuclear), MeV·cm²/g */
  total: number;
  /** CSDA range from rest, g/cm² */
  csdaRange: number;
}

export interface PstarDataset {
  material: string;
  /** NIST Star material number */
  matno: string;
  /** mean excitation energy used by PSTAR for this material, eV */
  I_eV: number;
  /** provenance string */
  source: string;
  points: PstarPoint[];
}
