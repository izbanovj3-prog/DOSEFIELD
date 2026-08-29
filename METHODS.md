# DOSEFIELD — Methods

Every equation and constant the model uses, with sources, plus one fully worked numerical
example so any single number can be verified independently, by hand, without running the code.
The equations below are transcribed from the implementation files named in each section — if
this document and the code ever disagree, the code (and its CI-gated tests) wins.

## 1. Physical constants (`src/physics/constants.ts` — CODATA 2018 / PDG)

| symbol | value | meaning |
|---|---|---|
| K | 0.307075 MeV·mol⁻¹·cm² | Bethe coefficient 4π·N_A·r_e²·m_e·c² |
| m_e·c² | 0.51099895 MeV | electron rest energy |
| m_p·c² | 938.27208816 MeV | proton rest energy |
| u·c² | 931.49410242 MeV | atomic mass unit (per-nucleon kinematics) |
| N_A | 6.02214076 × 10²³ mol⁻¹ | Avogadro constant (exact) |

Material data (`src/physics/materials.ts`): ⟨Z/A⟩, density, mean excitation energy I, and
Sternheimer density-effect parameters (a, m, x₀, x₁, C̄, δ₀) per material, from PDG (2023) /
ICRU-49; water uses I = 75 eV (the PSTAR/ICRU-49 value). Liquid hydrogen is modeled with δ ≡ 0
(labeled: its density-effect onset βγ ≳ 80 lies above the GCR range).

## 2. Stopping power (`src/physics/stoppingPower.ts` — Phase 1)

Electronic mass stopping power (PDG Eq. 34.5), in MeV·cm²/g:

    −(1/ρ)dE/dx = K·z²·(Z/A)·(1/β²)·[ ½·ln( 2·m_e c²·β²γ²·T_max / I² ) − β² − δ(βγ)/2 ]

with the full maximum energy transfer

    T_max = 2·m_e c²·β²γ² / (1 + 2γ·(m_e/M) + (m_e/M)²)

and the Sternheimer density effect δ(βγ) in its three-branch form (x = log₁₀ βγ):
δ = 2·ln10·x − C̄ for x ≥ x₁; add a·(x₁−x)^m for x₀ ≤ x < x₁; δ = 0 below x₀ (insulators).

**Labeled omissions:** shell (−C/Z), Barkas (z³), Bloch (z⁴) corrections. Consequence,
measured against NIST PSTAR every CI run: ≤ 1.55% error above 10 MeV, ≤ 4.03% down to 1 MeV.

CSDA range (`range.ts`): R(T) = ∫₀ᵀ dE / S(E), integrated numerically; validated against
PSTAR proton ranges in Al to < 0.4%.

## 3. Heavy ions (`src/physics/effectiveCharge.ts`, `ionStopping.ts` — Phase 2)

Barkas effective charge, scaling the proton engine:

    z_eff = Z·(1 − exp(−125·β·Z^(−2/3)))      S_ion(E/n) = z_eff² · S_proton(E/n)

Per-nucleon kinematics use u·c². **Labeled:** z_eff² scaling omits the same z³/z⁴ orders.

## 4. GCR spectrum (`data/gcr/matthia2013.ts` — Matthiä et al. 2013)

DLR-modified ISO-15390 parametric fit, Z = 1…28, single modulation parameter W
(0 = solar minimum / worst GCR … 130 = strong maximum). Per species (C_i, γ_i, α_i from the
paper, transcribed verbatim from the reference implementation `ssc-maire/CosRayModifiedISO`):

    R₀(W) = 0.37 + 0.0003·W^1.45        Δ(W) = 0.02·W + 4.7
    Φ(R) = C_i · β^α_i / R^γ_i · ( R/(R+R₀) )^Δ

converted rigidity→energy with the (A/Z)·1/β Jacobian and unit factors (the code returns
particles/(cm²·s·sr·(MeV/n))). Validity: E ≥ 10 MeV/n, 0 ≤ W ≤ 200.

## 5. Dose pipeline (`src/dose/doseModel.ts` — Phase 2)

Isotropic field: Φ = 4π·J. Composite Simpson integration in log-energy (E = 10 MeV/n … 100 GeV/n):

    D = c·Σ_Z ∫ 4π·J_Z(E)·S_water(Z,E) dE          [c = 1.602176634×10⁻¹⁰ Gy per MeV/g]
    H = c·Σ_Z ∫ 4π·J_Z(E)·S_water(Z,E)·Q(LET) dE    LET = S·ρ_water·0.1 [keV/µm]

ICRP-60 quality factor (`qualityFactor.ts`): Q = 1 (L < 10); 0.32·L − 2.2 (10 ≤ L ≤ 100);
300/√L (L > 100 keV/µm).

## 6. Shielded dose (`src/dose/shieldedDose.ts` — Phase 3)

Slab transport in the continuous-slowing-down approximation, integrated in RESIDUAL-energy
space: a particle entering with E_in exits a slab of areal density t with

    E_out = R⁻¹( R(E_in) − t ),   stops if R(E_in) ≤ t

and the integrand carries the Jacobian dE_in/dE_out = S(E_in)/S(E_out) (chained layer-by-layer
for multi-layer stacks in `multiLayerDose.ts`, innermost→outermost — the order matters for
heterogeneous stacks). Fragmentation (Phase 5, `fragmentation.ts`): Bradt–Peters
charge-changing cross-sections σ = π·r₀²·(A_p^⅓ + A_t^⅓ − b)², r₀ = 1.35 fm, b = 0.83, giving
per-material interaction mean free paths λ; primary survival exp(−t/λ) with a single-collision,
charge-conserving fragment yield. **Labeled:** no neutrons/target fragments, no multi-generation
cascade.

## 7. Propagated input uncertainty (`src/validation/uncertainty.ts` — Phase A)

    ε_H = √( ε_φ² + ε_S² + ε_impl² )

ε_φ = 14% — DLR-model |relative difference| vs AMS-02 hydrogen in the dose-dominant
< 1.5 GeV/n range (Norbury et al. 2018, LSSR 18:64, Table 1; He ≤ 2.8%; Z ≥ 3 assumed
comparable — stated assumption). ε_S = 4% — ICRU-49 compound bound (NIST STAR docs).
ε_impl = this run's computed max PSTAR deviation (≤ 1.55%), passed as a parameter — never a
stale copy. Total ≈ 14.6%. The band is **input uncertainty only**: it excludes un-modeled
secondary production (the documented 0.67× absorbed-dose scope gap) and the ICRP-60 Q(L)
convention (definitional).

## 8. Worked example — one number, by hand

**Proton, T = 100 MeV, in water** (Z/A = 0.55509, I = 75 eV, ρ = 1 g/cm³;
Sternheimer x₀ = 0.24). Every intermediate below was printed by the same functions the app
calls (`scratch` run of `electronicMassStoppingPower` and its parts) — check any line with a
calculator:

| step | expression | value |
|---|---|---|
| γ | 1 + 100/938.27208816 | 1.1065789 |
| β² | 1 − 1/γ² | 0.1833514 |
| βγ | √(β²)·γ | 0.4738321 |
| T_max | 2·m_e c²·β²γ²/(1+2γr+r²), r = m_e/m_p | 0.2291794 MeV |
| x = log₁₀ βγ | −0.3244 < x₀ = 0.24 | δ = 0 (insulator branch) |
| ln arg | 2·m_e c²·β²γ²·T_max/I² = 9.3487×10⁶ | ln = 16.0507 |
| L | ½·16.0507 − 0.1834 − 0 | 7.8420 |
| S | 0.307075·0.55509·(1/0.1833514)·7.8420 | **7.290 MeV·cm²/g** |
| PSTAR reference | NIST PSTAR, water, 100 MeV (electronic) | 7.289 MeV·cm²/g |
| deviation | | **+0.02%** |
| LET | 7.290·1.0·0.1 | 0.729 keV/µm |
| Q(LET) | L < 10 keV/µm | 1 (this proton is low-LET) |

The same number is asserted by the data-driven test suite (`test/physics.test.ts`) against the
full pasted PSTAR table, and the ≤ 1.55% bound over all five materials is recomputed on every
push by CI.

## 9. Reproduction commands

    npm install
    npm run typecheck && npm test      # 137 tests, incl. the PSTAR data-driven suite
    npm run validate:phase1..5         # headless PASS/FAIL validation gates
    npm run report                     # regenerates report/DOSEFIELD_report.md + plots

All numbers on the live site are computed in the browser by the same TypeScript modules the
tests import — there is no second implementation to drift.
