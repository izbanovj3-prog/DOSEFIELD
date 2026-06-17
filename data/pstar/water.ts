import type { PstarDataset } from './types.js';

/**
 * NIST PSTAR proton stopping-power & range data for LIQUID WATER (matno 276, I = 75 eV).
 * Pulled directly from the NIST PSTAR database on 2026-06-16:
 *   https://physics.nist.gov/cgi-bin/Star/ap_table.pl  (prog=PSTAR, matno=276)
 * Columns: electronic / total stopping power [MeV·cm²/g], CSDA range [g/cm²].
 */
export const PSTAR_WATER: PstarDataset = {
  material: 'Water (liquid)',
  matno: '276',
  I_eV: 75.0,
  source: 'NIST PSTAR, accessed 2026-06-16',
  points: [
    { T_MeV: 1, electronic: 2.606e2, total: 2.608e2, csdaRange: 2.458e-3 },
    { T_MeV: 2, electronic: 1.585e2, total: 1.586e2, csdaRange: 7.555e-3 },
    { T_MeV: 5, electronic: 7.906e1, total: 7.911e1, csdaRange: 3.623e-2 },
    { T_MeV: 10, electronic: 4.564e1, total: 4.567e1, csdaRange: 1.23e-1 },
    { T_MeV: 20, electronic: 2.605e1, total: 2.607e1, csdaRange: 4.26e-1 },
    { T_MeV: 50, electronic: 1.244e1, total: 1.245e1, csdaRange: 2.227e0 },
    { T_MeV: 100, electronic: 7.286e0, total: 7.289e0, csdaRange: 7.718e0 },
    { T_MeV: 250, electronic: 3.91e0, total: 3.911e0, csdaRange: 3.794e1 },
    { T_MeV: 500, electronic: 2.743e0, total: 2.743e0, csdaRange: 1.17e2 },
    { T_MeV: 1000, electronic: 2.211e0, total: 2.211e0, csdaRange: 3.254e2 },
  ],
};
