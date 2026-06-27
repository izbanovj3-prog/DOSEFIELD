import type { PstarDataset } from './types.js';

/**
 * NIST PSTAR proton stopping-power & range data for METHANE (CH4, I = 41.7 eV).
 * Pulled from the NIST PSTAR database, accessed 2026-06-27:
 *   https://physics.nist.gov/PhysRefData/Star/Text/PSTAR.html  (prog=PSTAR, Methane)
 * The NIST export gives electronic stopping power [MeV·cm²/g] and CSDA range [g/cm²].
 * Nuclear stopping is <0.1% above 1 MeV (and excluded from the model), so `total` is set
 * equal to `electronic` rather than carrying a separately-fabricated column. The NIST
 * material number was not in the export, so `matno` is left as the formula, not guessed.
 */
export const PSTAR_METHANE: PstarDataset = {
  material: 'Methane',
  matno: 'CH4',
  I_eV: 41.7,
  source: 'NIST PSTAR, accessed 2026-06-27',
  points: [
    { T_MeV: 1, electronic: 3.464e2, total: 3.464e2, csdaRange: 1.744e-3 },
    { T_MeV: 2, electronic: 2.057e2, total: 2.057e2, csdaRange: 5.634e-3 },
    { T_MeV: 5, electronic: 9.989e1, total: 9.989e1, csdaRange: 2.811e-2 },
    { T_MeV: 10, electronic: 5.676e1, total: 5.676e1, csdaRange: 9.747e-2 },
    { T_MeV: 20, electronic: 3.202e1, total: 3.202e1, csdaRange: 3.429e-1 },
    { T_MeV: 50, electronic: 1.512e1, total: 1.512e1, csdaRange: 1.819e0 },
    { T_MeV: 100, electronic: 8.797e0, total: 8.797e0, csdaRange: 6.356e0 },
    { T_MeV: 250, electronic: 4.689e0, total: 4.689e0, csdaRange: 3.149e1 },
    { T_MeV: 500, electronic: 3.276e0, total: 3.276e0, csdaRange: 9.761e1 },
    { T_MeV: 1000, electronic: 2.631e0, total: 2.631e0, csdaRange: 2.725e2 },
  ],
};
