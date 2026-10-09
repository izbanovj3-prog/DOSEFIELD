/**
 * NIST ASTAR helium-ion (alpha-particle) stopping-power & range data for the five shipped shield
 * materials. Source: NIST Standard Reference Database 124 (ESTAR/PSTAR/ASTAR), data content last
 * updated July 2017, doi:10.18434/T4NC7P. Retrieved 2026-10-01 (UTC) by POSTing
 *   prog=ASTAR, matno=<NIST material number>, GraphType=None, Energies=<list below>
 * to https://physics.nist.gov/cgi-bin/Star/ap_table.pl (form at
 * https://physics.nist.gov/PhysRefData/Star/Text/ASTAR.html).
 * T_MeV is the TOTAL alpha kinetic energy (MeV); 4, 8, 20, 40, 80, 200, 400, 1000 MeV correspond to
 * 1, 2, 5, 10, 20, 50, 100, 250 MeV/n. Columns: electronic / nuclear / total stopping power
 * [MeV·cm²/g], CSDA range [g/cm²]. NIST material numbers match data/pstar (hydrogen = matno 001,
 * the NIST gaseous-hydrogen entry; methane = matno 197).
 *
 * VALIDATION DATA ONLY: not used by any dose calculation. Compared against the model's
 * Barkas-effective-charge helium stopping in scripts/reproduce_paper1.ts.
 */
export interface AstarPoint { T_MeV: number; electronic: number; nuclear: number; total: number; csdaRange: number }
export interface AstarDataset { nistName: string; matno: string; points: AstarPoint[] }
export const ASTAR_RETRIEVED_UTC = '2026-10-01';
export const ASTAR_HELIUM: Record<'aluminum' | 'water' | 'polyethylene' | 'hydrogen' | 'methane', AstarDataset> = {
  aluminum: {
    nistName: 'ALUMINUM',
    matno: '013',
    points: [
    { T_MeV: 4, electronic: 698.6, nuclear: 0.5506, total: 699.1, csdaRange: 0.004283 },
    { T_MeV: 8, electronic: 439.8, nuclear: 0.3004, total: 440.1, csdaRange: 0.01173 },
    { T_MeV: 20, electronic: 227.1, nuclear: 0.1332, total: 227.2, csdaRange: 0.05216 },
    { T_MeV: 40, electronic: 134.4, nuclear: 0.07131, total: 134.5, csdaRange: 0.1712 },
    { T_MeV: 80, electronic: 78.31, nuclear: 0.0378, total: 78.35, csdaRange: 0.5775 },
    { T_MeV: 200, electronic: 38.16, nuclear: 0.01604, total: 38.17, csdaRange: 2.943 },
    { T_MeV: 400, electronic: 22.59, nuclear: 0.008252, total: 22.6, csdaRange: 10.06 },
    { T_MeV: 1000, electronic: 12.25, nuclear: 0.003371, total: 12.25, csdaRange: 48.78 },
    ],
  },
  water: {
    nistName: 'WATER, LIQUID',
    matno: '276',
    points: [
    { T_MeV: 4, electronic: 1034, nuclear: 0.8686, total: 1035, csdaRange: 0.002711 },
    { T_MeV: 8, electronic: 630.1, nuclear: 0.4694, total: 630.6, csdaRange: 0.007842 },
    { T_MeV: 20, electronic: 314.4, nuclear: 0.2054, total: 314.6, csdaRange: 0.03668 },
    { T_MeV: 40, electronic: 181.5, nuclear: 0.1087, total: 181.6, csdaRange: 0.124 },
    { T_MeV: 80, electronic: 103.6, nuclear: 0.05679, total: 103.7, csdaRange: 0.4287 },
    { T_MeV: 200, electronic: 49.5, nuclear: 0.02362, total: 49.52, csdaRange: 2.24 },
    { T_MeV: 400, electronic: 29, nuclear: 0.01201, total: 29.01, csdaRange: 7.76 },
    { T_MeV: 1000, electronic: 15.57, nuclear: 0.004848, total: 15.58, csdaRange: 38.12 },
    ],
  },
  polyethylene: {
    nistName: 'POLYETHYLENE',
    matno: '221',
    points: [
    { T_MeV: 4, electronic: 1145, nuclear: 0.9529, total: 1146, csdaRange: 0.002319 },
    { T_MeV: 8, electronic: 692.6, nuclear: 0.5137, total: 693.1, csdaRange: 0.006974 },
    { T_MeV: 20, electronic: 341.7, nuclear: 0.224, total: 341.9, csdaRange: 0.0334 },
    { T_MeV: 40, electronic: 195.7, nuclear: 0.1181, total: 195.8, csdaRange: 0.1141 },
    { T_MeV: 80, electronic: 111.1, nuclear: 0.0615, total: 111.1, csdaRange: 0.3977 },
    { T_MeV: 200, electronic: 52.76, nuclear: 0.02544, total: 52.79, csdaRange: 2.094 },
    { T_MeV: 400, electronic: 30.81, nuclear: 0.01289, total: 30.83, csdaRange: 7.282 },
    { T_MeV: 1000, electronic: 16.5, nuclear: 0.00519, total: 16.5, csdaRange: 35.91 },
    ],
  },
  hydrogen: {
    nistName: 'HYDROGEN',
    matno: '001',
    points: [
    { T_MeV: 4, electronic: 2675, nuclear: 2.766, total: 2678, csdaRange: 0.0009391 },
    { T_MeV: 8, electronic: 1538, nuclear: 1.484, total: 1539, csdaRange: 0.002995 },
    { T_MeV: 20, electronic: 723.8, nuclear: 0.6425, total: 724.5, csdaRange: 0.01527 },
    { T_MeV: 40, electronic: 404.7, nuclear: 0.3364, total: 405.1, csdaRange: 0.05394 },
    { T_MeV: 80, electronic: 225.6, nuclear: 0.1737, total: 225.8, csdaRange: 0.1926 },
    { T_MeV: 200, electronic: 105.3, nuclear: 0.07121, total: 105.3, csdaRange: 1.037 },
    { T_MeV: 400, electronic: 60.85, nuclear: 0.03587, total: 60.89, csdaRange: 3.654 },
    { T_MeV: 1000, electronic: 32.23, nuclear: 0.01441, total: 32.25, csdaRange: 18.25 },
    ],
  },
  methane: {
    nistName: 'METHANE',
    matno: '197',
    points: [
    { T_MeV: 4, electronic: 1370, nuclear: 1.181, total: 1371, csdaRange: 0.001901 },
    { T_MeV: 8, electronic: 816.2, nuclear: 0.6357, total: 816.8, csdaRange: 0.005829 },
    { T_MeV: 20, electronic: 396.8, nuclear: 0.2766, total: 397.1, csdaRange: 0.02846 },
    { T_MeV: 40, electronic: 225.6, nuclear: 0.1456, total: 225.8, csdaRange: 0.09828 },
    { T_MeV: 80, electronic: 127.3, nuclear: 0.0756, total: 127.4, csdaRange: 0.3452 },
    { T_MeV: 200, electronic: 60.14, nuclear: 0.03119, total: 60.17, csdaRange: 1.83 },
    { T_MeV: 400, electronic: 35, nuclear: 0.01577, total: 35.02, csdaRange: 6.391 },
    { T_MeV: 1000, electronic: 18.68, nuclear: 0.006348, total: 18.69, csdaRange: 31.64 },
    ],
  },
};
