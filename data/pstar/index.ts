export type { PstarDataset, PstarPoint } from './types.js';
export { PSTAR_ALUMINUM } from './aluminum.js';
export { PSTAR_WATER } from './water.js';
export { PSTAR_POLYETHYLENE } from './polyethylene.js';
export { PSTAR_HYDROGEN } from './hydrogen.js';
export { PSTAR_METHANE } from './methane.js';
export { PSTAR_LEAD } from './lead.js';
export { PSTAR_TITANIUM } from './titanium.js';

import { PSTAR_ALUMINUM } from './aluminum.js';
import { PSTAR_WATER } from './water.js';
import { PSTAR_POLYETHYLENE } from './polyethylene.js';
import { PSTAR_HYDROGEN } from './hydrogen.js';
import { PSTAR_METHANE } from './methane.js';
import { PSTAR_LEAD } from './lead.js';
import { PSTAR_TITANIUM } from './titanium.js';

/**
 * PSTAR datasets for the SHIPPED shield materials, keyed to `MATERIALS` in
 * src/physics/materials.ts. Every member of this map is expected to pass the stopping-power
 * and range comparisons — the data-driven suites in test/physics.test.ts loop over it, so a
 * dataset added here automatically gains pass/fail cases.
 */
export const PSTAR_DATASETS = {
  aluminum: PSTAR_ALUMINUM,
  water: PSTAR_WATER,
  polyethylene: PSTAR_POLYETHYLENE,
  hydrogen: PSTAR_HYDROGEN,
  methane: PSTAR_METHANE,
};

/**
 * High-Z reference datasets, keyed to `HIGH_Z_REFERENCE` in src/physics/materials.ts.
 *
 * These are NOT shield options and NOT expected to pass: they exist so the rejection of high-Z
 * shielding is a measured, re-runnable result rather than a remembered one. Bethe–Bloch here
 * omits the shell correction, which scales with Z, so agreement degrades sharply from Z = 13
 * (aluminium, shipped) to Z = 22 and Z = 82. `test/highZRejection.test.ts` quantifies it and
 * asserts the failure is large enough that no tolerance change could quietly admit them.
 */
export const PSTAR_HIGH_Z_REFERENCE = {
  titanium: PSTAR_TITANIUM,
  lead: PSTAR_LEAD,
};
