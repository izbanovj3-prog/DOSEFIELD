import type { PstarDataset } from './types.js';

/**
 * NIST PSTAR proton stopping-power & range data for ALUMINUM (matno 013, I = 166 eV).
 * Pulled directly from the NIST PSTAR database on 2026-06-16:
 *   https://physics.nist.gov/cgi-bin/Star/ap_table.pl  (prog=PSTAR, matno=013)
 * Columns: electronic / total stopping power [MeV·cm²/g], CSDA range [g/cm²].
 */
export const PSTAR_ALUMINUM: PstarDataset = {
  material: 'Aluminum',
  matno: '013',
  I_eV: 166.0,
  source: 'NIST PSTAR, accessed 2026-06-16',
  points: [
    { T_MeV: 1, electronic: 1.719e2, total: 1.72e2, csdaRange: 3.945e-3 },
    { T_MeV: 2, electronic: 1.094e2, total: 1.095e2, csdaRange: 1.146e-2 },
    { T_MeV: 5, electronic: 5.691e1, total: 5.695e1, csdaRange: 5.188e-2 },
    { T_MeV: 10, electronic: 3.375e1, total: 3.376e1, csdaRange: 1.705e-1 },
    { T_MeV: 20, electronic: 1.968e1, total: 1.969e1, csdaRange: 5.748e-1 },
    { T_MeV: 50, electronic: 9.59e0, total: 9.594e0, csdaRange: 2.928e0 },
    { T_MeV: 100, electronic: 5.676e0, total: 5.678e0, csdaRange: 1.001e1 },
    { T_MeV: 250, electronic: 3.075e0, total: 3.076e0, csdaRange: 4.855e1 },
    { T_MeV: 500, electronic: 2.166e0, total: 2.167e0, csdaRange: 1.489e2 },
    { T_MeV: 1000, electronic: 1.749e0, total: 1.75e0, csdaRange: 4.124e2 },
  ],
};
