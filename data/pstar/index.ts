export type { PstarDataset, PstarPoint } from './types.js';
export { PSTAR_ALUMINUM } from './aluminum.js';
export { PSTAR_WATER } from './water.js';
export { PSTAR_POLYETHYLENE } from './polyethylene.js';
export { PSTAR_HYDROGEN } from './hydrogen.js';

import { PSTAR_ALUMINUM } from './aluminum.js';
import { PSTAR_WATER } from './water.js';
import { PSTAR_POLYETHYLENE } from './polyethylene.js';
import { PSTAR_HYDROGEN } from './hydrogen.js';

/** PSTAR datasets keyed by material key (matches src/physics/materials.ts keys). */
export const PSTAR_DATASETS = {
  aluminum: PSTAR_ALUMINUM,
  water: PSTAR_WATER,
  polyethylene: PSTAR_POLYETHYLENE,
  hydrogen: PSTAR_HYDROGEN,
};
