import type { PstarDataset } from './types.js';

/**
 * NIST PSTAR proton stopping-power & range data for POLYETHYLENE (matno 221, I = 57.4 eV).
 * Pulled directly from the NIST PSTAR database on 2026-06-16:
 *   https://physics.nist.gov/cgi-bin/Star/ap_table.pl  (prog=PSTAR, matno=221)
 * Columns: electronic / total stopping power [MeV·cm²/g], CSDA range [g/cm²].
 */
export const PSTAR_POLYETHYLENE: PstarDataset = {
  material: 'Polyethylene (CH2)n',
  matno: '221',
  I_eV: 57.4,
  source: 'NIST PSTAR, accessed 2026-06-16',
  points: [
    { T_MeV: 1, electronic: 2.891e2, total: 2.893e2, csdaRange: 2.145e-3 },
    { T_MeV: 2, electronic: 1.744e2, total: 1.746e2, csdaRange: 6.761e-3 },
    { T_MeV: 5, electronic: 8.597e1, total: 8.602e1, csdaRange: 3.301e-2 },
    { T_MeV: 10, electronic: 4.923e1, total: 4.926e1, csdaRange: 1.132e-1 },
    { T_MeV: 20, electronic: 2.793e1, total: 2.795e1, csdaRange: 3.951e-1 },
    { T_MeV: 50, electronic: 1.326e1, total: 1.327e1, csdaRange: 2.081e0 },
    { T_MeV: 100, electronic: 7.743e0, total: 7.746e0, csdaRange: 7.242e0 },
    { T_MeV: 250, electronic: 4.142e0, total: 4.143e0, csdaRange: 3.574e1 },
    { T_MeV: 500, electronic: 2.9e0, total: 2.9e0, csdaRange: 1.105e2 },
    { T_MeV: 1000, electronic: 2.319e0, total: 2.32e0, csdaRange: 3.083e2 },
  ],
};
