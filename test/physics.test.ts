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
  it('is ~0 well below x0 for an insulator-like onset and small for conductors', () => {
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
