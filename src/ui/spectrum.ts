/**
 * Spectral decomposition of the dose integrals — PRESENTATION LAYER ONLY.
 *
 * Nothing here is new physics. Both functions re-evaluate, on a log-energy grid, the exact
 * integrand that the dose engines already sum:
 *
 *   incidentSpectrum()  ← the integrand of computeFreeSpaceDose      (src/dose/doseModel.ts)
 *   shieldedSpectrum()  ← the integrand of computeMultiLayerDose /
 *                         computeMultiLayerFragmentedDose            (src/dose/multiLayerDose.ts),
 *                         which reduce exactly to computeShieldedDose /
 *                         computeFragmentedDose for a single slab.
 *
 * TWO DIFFERENT ENERGY VARIABLES — deliberately kept apart:
 *   incidentSpectrum is differential in the INCIDENT kinetic energy T of the ion arriving at the
 *   spacecraft (the argument of the Matthiä flux), on 10 … 1e5 MeV/n.
 *   shieldedSpectrum is differential in the RESIDUAL kinetic energy E_out with which the ion
 *   reaches the tissue scoring point, on 1 … 1e5 MeV/n — the variable the shielded integral is
 *   actually taken over (see the E_out substitution in shieldedDose.ts / multiLayerDose.ts).
 * They are NOT the same abscissa and are never drawn on a shared axis: the incident spectrum is
 * not re-projected into residual coordinates, nor the reverse. Each curve is shown on the axis its
 * own integral is defined over.
 *
 * The grids sit on the ENGINES' OWN Simpson nodes, so summing a returned curve with composite
 * Simpson in log₁₀E reproduces the corresponding engine result at the same `perDecade` to
 * floating-point precision — that identity is the point, and test/spectrum.test.ts asserts it.
 */

import { WATER, MATERIALS } from '../physics/materials.js';
import { ionStopping } from '../physics/ionStopping.js';
import { kinematics, electronicMassStoppingPower } from '../physics/stoppingPower.js';
import { effectiveCharge } from '../physics/effectiveCharge.js';
import { qualityFactorICRP60, letFromMassStopping } from '../physics/qualityFactor.js';
import { interactionMFP, fragmentYield } from '../physics/fragmentation.js';
import { GCR_SPECIES, differentialFluxMatthia } from '../../data/gcr/matthia2013.js';
import { getRangeTable } from '../physics/ionRange.js';
import { M_U_C2, MEV_PER_G_TO_GY, SECONDS_PER_DAY } from '../physics/constants.js';
import type { ShieldLayer } from '../dose/multiLayerDose.js';

const FOUR_PI = 4 * Math.PI;
/** MeV/(g·s) → mSv/day (the same unit chain the engines apply to their integral). */
const UNIT = MEV_PER_G_TO_GY * SECONDS_PER_DAY * 1000;

/** Incident-energy grid: the free-space integration bounds (doseModel.ts). */
export const T_INCIDENT_LO = 10; // MeV/n — Matthiä model validity floor
export const T_INCIDENT_HI = 1e5; // MeV/n
/** Residual-energy grid: the shielded integration bounds (shieldedDose.ts / multiLayerDose.ts). */
export const E_RESIDUAL_LO = 1; // MeV/n — below this an exiting ion carries negligible energy
export const E_RESIDUAL_HI = 1e5; // MeV/n
/** Incident energies below this carry no Matthiä flux (same guard as the engines). */
const SPECTRUM_FLOOR = 10;

/** Ions traced individually in the overlays (all 28 species are always folded into `total`). */
export const SPEC_IONS = [
  { key: 'H', Z: 1 }, { key: 'He', Z: 2 }, { key: 'C', Z: 6 }, { key: 'O', Z: 8 }, { key: 'Fe', Z: 26 },
] as const;

/** Display sampling density: 30 nodes/decade → 121 incident / 151 residual points. */
export const SPEC_PER_DECADE = 30;

export interface SpectrumData {
  /** kinetic-energy grid, MeV/n (log-spaced, on the engine's own Simpson nodes) */
  T: number[];
  /** dH/dlog₁₀E summed over all species, mSv/day per decade of energy */
  total: number[];
  /** dH/dlog₁₀E for the tracked ions (H, He, C, O, Fe) */
  perIon: Record<string, number[]>;
  /** energy of the peak per-decade contribution, MeV/n */
  peakT: number;
  /** ∫ total d(log₁₀E) over the plotted grid, mSv/day — must equal the engine's dose rate */
  integral: number;
}

/** Composite-Simpson node set at `perDecade` samples per decade between lo and hi. */
function grid(lo: number, hi: number, perDecade: number): { T: number[]; h: number } {
  const uLo = Math.log(lo);
  const uHi = Math.log(hi);
  let n = Math.max(2, Math.ceil((perDecade * (uHi - uLo)) / Math.LN10));
  if (n % 2 === 1) n += 1;
  const h = (uHi - uLo) / n;
  const T: number[] = [];
  for (let i = 0; i <= n; i++) T.push(Math.exp(uLo + i * h));
  return { T, h };
}

/** Composite Simpson over a log₁₀ abscissa whose natural-log step is `h`. */
function simpsonLog10(values: number[], h: number): number {
  const n = values.length - 1;
  let acc = 0;
  for (let i = 0; i <= n; i++) {
    const w = i === 0 || i === n ? 1 : i % 2 === 1 ? 4 : 2;
    acc += w * values[i]!;
  }
  return (acc * (h / Math.LN10)) / 3;
}

function assemble(T: number[], h: number, totals: number[], perIon: Record<string, number[]>): SpectrumData {
  let peakT = T[0]!;
  let peakV = -1;
  for (let i = 0; i < T.length; i++) {
    if (totals[i]! > peakV) { peakV = totals[i]!; peakT = T[i]!; }
  }
  return { T, total: totals, perIon, peakT, integral: simpsonLog10(totals, h) };
}

/**
 * dH/dlog₁₀T of the INCIDENT (pre-shield) GCR field, mSv/day per decade:
 *   ln10 · T · Σ_Z 4π·J_Z(T,W) · S_water(Z,T) · Q(LET_water(Z,T))
 * Integrating it over log₁₀T reproduces computeFreeSpaceDose(W, perDecade).
 */
export function incidentSpectrum(W: number, perDecade = SPEC_PER_DECADE): SpectrumData {
  const { T, h } = grid(T_INCIDENT_LO, T_INCIDENT_HI, perDecade);
  const total: number[] = [];
  const perIon: Record<string, number[]> = {};
  for (const io of SPEC_IONS) perIon[io.key] = [];

  for (const Tn of T) {
    let sum = 0;
    const byZ: Record<number, number> = {};
    for (const sp of GCR_SPECIES) {
      const phi = FOUR_PI * differentialFluxMatthia(sp.Z, Tn, W); // /(cm²·s·(MeV/n))
      const { massStopping } = ionStopping(Tn, sp.Z, sp.A, WATER); // MeV·cm²/g (incl. z_eff²)
      const Q = qualityFactorICRP60(letFromMassStopping(massStopping, WATER.density));
      const perDec = Math.LN10 * Tn * phi * massStopping * Q * UNIT;
      sum += perDec;
      byZ[sp.Z] = perDec;
    }
    total.push(sum);
    for (const io of SPEC_IONS) perIon[io.key]!.push(byZ[io.Z] ?? 0);
  }
  return assemble(T, h, total, perIon);
}

/**
 * dH/dlog₁₀E_out BEHIND the shield stack, mSv/day per decade of RESIDUAL energy.
 *
 * The integrand of the shielded dose exactly as the engine forms it: for each residual energy
 * E_out the incident energy is chained back through the stack, the Jacobian dE_in/dE_out is
 * accumulated in the same innermost→outermost order, the flux is read at the incident energy and
 * the deposit is taken at the residual energy. Integrating over log₁₀E_out reproduces
 * computeMultiLayerDose / computeMultiLayerFragmentedDose at the same `perDecade`.
 *
 * `fragment` mirrors the engine's Bradt–Peters branch; fragment dose is attributed to the PARENT
 * species, as the engine does.
 */
export function shieldedSpectrum(
  layers: ShieldLayer[],
  W: number,
  fragment = false,
  perDecade = SPEC_PER_DECADE,
): SpectrumData {
  const active = layers.filter((l) => l.thickness > 0);
  // Empty stack: the engine short-circuits to free space, so the residual field IS the incident one.
  if (active.length === 0) return incidentSpectrum(W, perDecade);

  const { T, h } = grid(E_RESIDUAL_LO, E_RESIDUAL_HI, perDecade);
  const total: number[] = [];
  const perIon: Record<string, number[]> = {};
  for (const io of SPEC_IONS) perIon[io.key] = [];

  // Per-species transport state, built once per species exactly as the engine does.
  const prep = GCR_SPECIES.map((sp) => {
    const tables = active.map((l) => getRangeTable(sp.Z, sp.A, MATERIALS[l.material]!));
    const pSurv = fragment
      ? active.reduce((p, l) => p * Math.exp(-l.thickness / interactionMFP(sp.A, MATERIALS[l.material]!)), 1)
      : 1;
    return { sp, tables, pSurv, frags: fragment && pSurv < 1 ? fragmentYield(sp.Z, sp.A) : [] };
  });

  for (const E_out of T) {
    // velocity-dependent quantities are shared by every species at this residual energy
    const beta = Math.sqrt(kinematics(E_out, M_U_C2).beta2);
    const S_unit = electronicMassStoppingPower(E_out, WATER, 1, M_U_C2);
    const sQ = (z: number): number => {
      const S = effectiveCharge(z, beta) ** 2 * S_unit;
      return S * qualityFactorICRP60(letFromMassStopping(S, WATER.density));
    };
    let sum = 0;
    const byZ: Record<number, number> = {};
    for (const { sp, tables, pSurv, frags } of prep) {
      let E = E_out;
      let jac = 1;
      for (let i = active.length - 1; i >= 0; i--) {
        const mat = MATERIALS[active[i]!.material]!;
        const tbl = tables[i]!;
        const E_exit = E;
        const E_enter = tbl.energyAtRange(tbl.rangeAtEnergy(E) + active[i]!.thickness);
        jac *=
          ionStopping(E_enter, sp.Z, sp.A, mat).massStopping /
          ionStopping(E_exit, sp.Z, sp.A, mat).massStopping;
        E = E_enter;
      }
      const E_in = E;
      if (E_in < SPECTRUM_FLOOR || E_in > E_RESIDUAL_HI) { byZ[sp.Z] = 0; continue; }
      const phi = FOUR_PI * differentialFluxMatthia(sp.Z, E_in, W);

      let doseEq = pSurv * sQ(sp.Z);
      const fragW = 1 - pSurv;
      if (fragW > 0) for (const fr of frags) doseEq += fragW * fr.multiplicity * sQ(fr.Z);

      const perDec = Math.LN10 * E_out * phi * jac * doseEq * UNIT;
      sum += perDec;
      byZ[sp.Z] = perDec;
    }
    total.push(sum);
    for (const io of SPEC_IONS) perIon[io.key]!.push(byZ[io.Z] ?? 0);
  }
  return assemble(T, h, total, perIon);
}
