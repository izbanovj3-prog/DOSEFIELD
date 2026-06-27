import type { PstarDataset } from './types.js';

/**
 * NIST PSTAR proton stopping-power & range data for HYDROGEN (matno 001, I = 19.2 eV).
 * Pulled from the NIST PSTAR database, accessed 2026-06-27:
 *   https://physics.nist.gov/PhysRefData/Star/Text/PSTAR.html  (prog=PSTAR, Hydrogen)
 * The NIST export gives electronic stopping power [MeV·cm²/g] and CSDA range [g/cm²].
 * Nuclear stopping is <0.1% above 1 MeV (and is excluded from the model), so `total` is
 * set equal to `electronic` here rather than carrying a separately-fabricated column.
 */
export const PSTAR_HYDROGEN: PstarDataset = {
  material: 'Hydrogen',
  matno: '001',
  I_eV: 19.2,
  source: 'NIST PSTAR, accessed 2026-06-27',
  points: [
    { T_MeV: 1, electronic: 6.764e2, total: 6.764e2, csdaRange: 8.476e-4 },
    { T_MeV: 2, electronic: 3.881e2, total: 3.881e2, csdaRange: 2.883e-3 },
    { T_MeV: 5, electronic: 1.823e2, total: 1.823e2, csdaRange: 1.506e-2 },
    { T_MeV: 10, electronic: 1.019e2, total: 1.019e2, csdaRange: 5.346e-2 },
    { T_MeV: 20, electronic: 5.675e1, total: 5.675e1, csdaRange: 1.913e-1 },
    { T_MeV: 50, electronic: 2.647e1, total: 2.647e1, csdaRange: 1.031e0 },
    { T_MeV: 100, electronic: 1.529e1, total: 1.529e1, csdaRange: 3.633e0 },
    { T_MeV: 250, electronic: 8.092e0, total: 8.092e0, csdaRange: 1.816e1 },
    { T_MeV: 500, electronic: 5.625e0, total: 5.625e0, csdaRange: 5.658e1 },
    { T_MeV: 1000, electronic: 4.496e0, total: 4.496e0, csdaRange: 1.587e2 },
  ],
};
