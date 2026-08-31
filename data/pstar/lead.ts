import type { PstarDataset } from './types.js';

/**
 * NIST PSTAR proton stopping-power & range data for LEAD (matno 082, I = 823 eV).
 * Pulled from the NIST PSTAR database on 2026-08-31 by submitting the material form at
 *   https://physics.nist.gov/PhysRefData/Star/Text/PSTAR.html  (prog=PSTAR, matno=082)
 * which POSTs to https://physics.nist.gov/cgi-bin/Star/ap_table.pl — the table has no GET URL.
 * Columns: electronic / total stopping power [MeV·cm²/g], CSDA range [g/cm²].
 *
 * NOT A SHIPPED SHIELD MATERIAL. This dataset exists so the repository can *reproduce* the
 * high-Z rejection recorded in METHODS.md §13.4 instead of asserting it: Bethe–Bloch without
 * shell corrections cannot reproduce PSTAR at Z = 82, and `test/highZRejection.test.ts` measures
 * by how much. It is deliberately kept out of `PSTAR_DATASETS`, whose members are the validated
 * low-Z shields and are expected to PASS.
 */
export const PSTAR_LEAD: PstarDataset = {
  material: 'Lead',
  matno: '082',
  I_eV: 823.0,
  source: 'NIST PSTAR, accessed 2026-08-31',
  points: [
    { T_MeV: 1, electronic: 6.292e1, total: 6.298e1, csdaRange: 1.183e-2 },
    { T_MeV: 2, electronic: 4.534e1, total: 4.537e1, csdaRange: 3.091e-2 },
    { T_MeV: 5, electronic: 2.737e1, total: 2.739e1, csdaRange: 1.196e-1 },
    { T_MeV: 10, electronic: 1.778e1, total: 1.779e1, csdaRange: 3.528e-1 },
    { T_MeV: 20, electronic: 1.116e1, total: 1.116e1, csdaRange: 1.086e0 },
    { T_MeV: 50, electronic: 5.804e0, total: 5.806e0, csdaRange: 5.057e0 },
    { T_MeV: 100, electronic: 3.551e0, total: 3.552e0, csdaRange: 1.652e1 },
    { T_MeV: 250, electronic: 1.996e0, total: 1.996e0, csdaRange: 7.669e1 },
    { T_MeV: 500, electronic: 1.437e0, total: 1.438e0, csdaRange: 2.292e2 },
    { T_MeV: 1000, electronic: 1.185e0, total: 1.186e0, csdaRange: 6.217e2 },
  ],
};
