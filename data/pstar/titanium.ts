import type { PstarDataset } from './types.js';

/**
 * NIST PSTAR proton stopping-power & range data for TITANIUM (matno 022, I = 233 eV).
 * Pulled from the NIST PSTAR database on 2026-08-31 by submitting the material form at
 *   https://physics.nist.gov/PhysRefData/Star/Text/PSTAR.html  (prog=PSTAR, matno=022)
 * which POSTs to https://physics.nist.gov/cgi-bin/Star/ap_table.pl — the table has no GET URL.
 * Columns: electronic / total stopping power [MeV·cm²/g], CSDA range [g/cm²].
 *
 * NOT A SHIPPED SHIELD MATERIAL — see the note in `lead.ts`. Titanium (Z = 22) is the
 * intermediate-Z case: it shows the shell-correction error growing with Z well before lead.
 */
export const PSTAR_TITANIUM: PstarDataset = {
  material: 'Titanium',
  matno: '022',
  I_eV: 233.0,
  source: 'NIST PSTAR, accessed 2026-08-31',
  points: [
    { T_MeV: 1, electronic: 1.435e2, total: 1.437e2, csdaRange: 4.783e-3 },
    { T_MeV: 2, electronic: 9.307e1, total: 9.313e1, csdaRange: 1.366e-2 },
    { T_MeV: 5, electronic: 4.941e1, total: 4.943e1, csdaRange: 6.058e-2 },
    { T_MeV: 10, electronic: 2.967e1, total: 2.969e1, csdaRange: 1.961e-1 },
    { T_MeV: 20, electronic: 1.75e1, total: 1.75e1, csdaRange: 6.529e-1 },
    { T_MeV: 50, electronic: 8.629e0, total: 8.632e0, csdaRange: 3.279e0 },
    { T_MeV: 100, electronic: 5.14e0, total: 5.141e0, csdaRange: 1.111e1 },
    { T_MeV: 250, electronic: 2.8e0, total: 2.801e0, csdaRange: 5.353e1 },
    { T_MeV: 500, electronic: 1.978e0, total: 1.978e0, csdaRange: 1.635e2 },
    { T_MeV: 1000, electronic: 1.6e0, total: 1.6e0, csdaRange: 4.519e2 },
  ],
};
