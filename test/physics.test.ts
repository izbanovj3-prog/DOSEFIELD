import { describe, it, expect } from 'vitest';
import { MATERIALS } from '../src/physics/materials.js';
import {
  electronicMassStoppingPower,
  densityEffect,
  kinematics,
  maxEnergyTransfer,
} from '../src/physics/stoppingPower.js';
import { csdaRangeIncrement } from '../src/physics/range.js';
import { PSTAR_DATASETS } from '../data/pstar/index.js';

const relErr = (a: number, b: number) => Math.abs(a - b) / b;

describe('kinematics', () => {
  it('gives β²→0 at low T and β²→1 at ultra-relativistic T', () => {
    expect(kinematics(0.001, 938.272).beta2).toBeLessThan(1e-5);
    expect(kinematics(1e6, 938.272).beta2).toBeGreaterThan(0.999);
  });
  it('T_max is positive and grows with energy', () => {
    const lo = maxEnergyTransfer(...kin(10));
    const hi = maxEnergyTransfer(...kin(1000));
    expect(lo).toBeGreaterThan(0);
    expect(hi).toBeGreaterThan(lo);
  });
});

function kin(T: number): [number, number, number] {
  const k = kinematics(T, 938.272);
  return [k.beta2, k.gamma, 938.272];
}

describe('Sternheimer density effect', () => {
  const al = MATERIALS.aluminum!.densityEffect;
  it('is exactly 0 below x0 for a non-conductor (water)', () => {
    // βγ = 0.05 → x ≈ -1.3, far below x0
    const d = densityEffect(0.05, MATERIALS.water!.densityEffect);
    expect(d).toBe(0);
  });
  it('grows into the relativistic rise region (x0 < x < x1)', () => {
    const dLow = densityEffect(1.0, al); // x = 0
    const dHigh = densityEffect(5.0, al); // x ≈ 0.7
    expect(dHigh).toBeGreaterThan(dLow);
  });
});

/**
 * The conductor branch δ = δ0·10^(2(x−x0)) is the only part of the density effect acting on
 * aluminium below 739 MeV. Nothing else pins it: at 10 MeV, where the PSTAR comparison peaks,
 * it moves dE/dx by 0.012%, far inside that tolerance. So it is checked here directly, against
 * the same aluminium with the branch forced off (δ = 0 below x0, everything else identical).
 *
 * PROVENANCE OF THE REFERENCE VALUES: computed independently from PDG Eq. 34.5 and 34.7
 * (I = 166 eV, Z/A = 0.4818, K = 0.307075 MeV mol⁻¹ cm²) by someone who had not seen this code.
 * They are an external cross-check of the implementation, not expectations derived from it.
 * If this test fails, do NOT adjust the numbers to match the code until it has been worked out
 * which side is wrong. (K and Z/A cancel in the ratio; I and the kinematics do not.)
 */
describe('Sternheimer conductor branch (aluminium)', () => {
  const al = MATERIALS.aluminum!;
  const alNoBranch = { ...al, densityEffect: { ...al.densityEffect, conductor: false, delta0: 0 } };
  const changePct = (T: number) => {
    const off = electronicMassStoppingPower(T, alNoBranch);
    return ((electronicMassStoppingPower(T, al) - off) / off) * 100;
  };

  const REFERENCE: [T_MeV: number, changePct: number][] = [
    [1, -0.0023],
    [10, -0.012],
    [100, -0.087],
    [400, -0.3426],
    [600, -0.535],
    [738, -0.6788],
  ];
  for (const [T, ref] of REFERENCE) {
    it(`T = ${T} MeV: lowers dE/dx by ${-ref}% (external reference, ±0.001 pp)`, () => {
      expect(Math.abs(changePct(T) - ref)).toBeLessThanOrEqual(0.001);
    });
  }

  it('lowers dE/dx everywhere below the branch point', () => {
    for (const T of [1, 2, 5, 10, 20, 50, 100, 200, 400, 600, 700, 738, 739.06]) {
      expect(changePct(T)).toBeLessThan(0);
    }
  });

  /**
   * x0 = 0.1708 ⇒ βγ = 1.48184 ⇒ T = 739.0678 MeV. In the function's own variable the branch
   * point x = x0 is exact, so it is tested there. In energy, converting that T back to x lands
   * one ulp below x0 and correctly takes the conductor branch, so the energy grid starts at
   * 739.068 MeV (the first value on the x ≥ x0 side) and runs past x1 to cover both upper branches.
   */
  it('is bit-identical at and above the branch point', () => {
    const bg0 = Math.pow(10, al.densityEffect.x0);
    expect(densityEffect(bg0, al.densityEffect)).toBe(densityEffect(bg0, alNoBranch.densityEffect));
    for (const T of [739.068, 739.1, 740, 800, 1000, 1e4, 1e5, 1e6, 1e7]) {
      expect(electronicMassStoppingPower(T, al)).toBe(electronicMassStoppingPower(T, alNoBranch));
    }
  });
});

describe('electronic stopping power vs NIST PSTAR', () => {
  for (const key of Object.keys(PSTAR_DATASETS) as (keyof typeof PSTAR_DATASETS)[]) {
    const ds = PSTAR_DATASETS[key];
    const mat = MATERIALS[key]!;
    describe(ds.material, () => {
      for (const p of ds.points) {
        // Bethe is solidly valid >=10 MeV (tight 2.5%); 1-5 MeV looser (5%, shell-corr omitted)
        const tol = p.T_MeV >= 10 ? 0.025 : 0.05;
        it(`${p.T_MeV} MeV within ${(tol * 100).toFixed(1)}%`, () => {
          const model = electronicMassStoppingPower(p.T_MeV, mat);
          expect(relErr(model, p.electronic)).toBeLessThan(tol);
        });
      }
    });
  }
});

describe('stopping power is monotonically decreasing over 10–1000 MeV', () => {
  it('water', () => {
    const w = MATERIALS.water!;
    const s10 = electronicMassStoppingPower(10, w);
    const s100 = electronicMassStoppingPower(100, w);
    const s1000 = electronicMassStoppingPower(1000, w);
    expect(s100).toBeLessThan(s10);
    expect(s1000).toBeLessThan(s100);
  });
});

describe('CSDA range increment vs NIST PSTAR', () => {
  for (const key of Object.keys(PSTAR_DATASETS) as (keyof typeof PSTAR_DATASETS)[]) {
    const ds = PSTAR_DATASETS[key];
    const mat = MATERIALS[key]!;
    const E0 = ds.points[0]!.T_MeV;
    const R0 = ds.points[0]!.csdaRange;
    it(`${ds.material}: ΔR(1→1000 MeV) within 5%`, () => {
      const last = ds.points[ds.points.length - 1]!;
      const model = csdaRangeIncrement(E0, last.T_MeV, mat);
      const ref = last.csdaRange - R0;
      expect(relErr(model, ref)).toBeLessThan(0.05);
    });
  }
  it('integrator is convergent (doubling node density changes result < 0.1%)', () => {
    const al = MATERIALS.aluminum!;
    const coarse = csdaRangeIncrement(10, 1000, al, { pointsPerDecade: 100 });
    const fine = csdaRangeIncrement(10, 1000, al, { pointsPerDecade: 800 });
    expect(relErr(coarse, fine)).toBeLessThan(0.001);
  });
});
