# DOSEFIELD

### ▶ Live dosimeter: **https://izbanovj3-prog.github.io/DOSEFIELD/**

[![CI](https://github.com/izbanovj3-prog/DOSEFIELD/actions/workflows/ci.yml/badge.svg)](https://github.com/izbanovj3-prog/DOSEFIELD/actions/workflows/ci.yml)

A scientifically-honest **1D deep-space radiation dose & shielding model**. The goal is
to estimate the dose-equivalent an astronaut receives behind shielding on a Mars-transit
mission and validate it against the real measured dose from NASA's MSL/RAD instrument.

> Scope note: this is a **tractable deterministic 1D slab model**, not a reimplementation
> of HZETRN/OLTARIS. Every approximation is labeled in the code and the report. The
> credibility of the project is the validation, not the visuals.

## Status — Phases 1–5 complete · validated MVP + fragmentation

### Phase 1 — physics core + NIST PSTAR validation

Phase 1 builds the energy-loss engine and proves it against NIST PSTAR **before** any
dose code, per the build plan.

- **Bethe–Bloch** electronic mass stopping power `−(1/ρ)dE/dx` with the **Sternheimer
  density-effect** correction — [`src/physics/stoppingPower.ts`](src/physics/stoppingPower.ts)
- **CSDA range** via integration of inverse stopping power — [`src/physics/range.ts`](src/physics/range.ts)
- Cited material data (Al / liquid water / polyethylene) — [`src/physics/materials.ts`](src/physics/materials.ts)
- Real NIST PSTAR reference tables, pulled 2026-06-16 — [`data/pstar/`](data/pstar/)
- Headless PASS/FAIL validation harness — [`src/validation/runPhase1.ts`](src/validation/runPhase1.ts)

### The model (Phase 1)

```
−(1/ρ) dE/dx = K·z²·(Z/A)·(1/β²)·[ ½·ln(2·m_e·c²·β²·γ²·T_max / I²) − β² − δ(βγ)/2 ]   [MeV·cm²/g]
R(T) = ∫ dE / [−(1/ρ)dE/dx]                                                          [g/cm²]
```

**Approximations (labeled, Phase 1):** shell correction (−C/Z), Barkas (z³) and Bloch (z⁴)
corrections are omitted. Consequence: agreement is sub-percent above ~50 MeV and degrades to
a few percent near 1 MeV, where the Bethe formula reaches its low-energy limit. We report this
honestly rather than tuning it away. Nuclear (elastic) stopping is excluded — it is <0.1% of
the total above 1 MeV — so we compare against PSTAR's *electronic* stopping-power column.

**Result:** stopping power 30/30 within a few % (≤1.55% above 10 MeV); CSDA range 27/27.

### Phase 2 — GCR spectrum → dose → LET → Q(LET) → dose-equivalent

- **GCR differential spectrum** (Z=1..28, solar modulation W) — Matthiä et al. (2013)
  parametric fit to Badhwar–O'Neill — [`data/gcr/matthia2013.ts`](data/gcr/matthia2013.ts)
- **Heavy-ion stopping** via Barkas effective charge `z_eff²` scaling of the Phase-1 engine
  — [`src/physics/ionStopping.ts`](src/physics/ionStopping.ts), [`effectiveCharge.ts`](src/physics/effectiveCharge.ts)
- **ICRP-60 quality factor** `Q(LET)` — [`src/physics/qualityFactor.ts`](src/physics/qualityFactor.ts)
- **Free-space dose pipeline** (absorbed dose, LET, dose-equivalent, ⟨Q⟩, per-species) —
  [`src/dose/doseModel.ts`](src/dose/doseModel.ts), report [`src/validation/runPhase2.ts`](src/validation/runPhase2.ts)

```
S_ion(E/n) = z_eff(Z,β)² · S_proton(E/n)          z_eff = Z·[1 − exp(−125·β·Z^−2/3)]   (Barkas)
LET = S_water · ρ · 0.1 [keV/µm]                  Q(L): 1 (L<10), 0.32L−2.2 (10–100), 300/√L (>100)
D = 1.602e-10 · Σ_Z ∫ 4π·J_Z(E)·S_water(Z,E) dE   H = Σ Q(LET)·D
```

**Free-space solar-min result (W=0, primaries only):** absorbed dose **0.48 mGy/day** and
integral flux **5.5 /cm²/s** match well-established free-space values; iron alone carries ~27%
of dose-equivalent. Point dose-equivalent **H ≈ 2.9 mSv/day** and **⟨Q⟩ ≈ 6.1** are *upper
bounds* — they exceed shielded measurements (RAD ~1.8 mSv/day, ⟨Q⟩~3.8) precisely because there
is no shielding yet to slow HZE ions or add low-Q secondaries (Phases 3 & 5 close this gap).

**Approximations (labeled, Phase 2):** primaries only (no fragmentation/secondaries),
thin target (no self-shielding), `z_eff²` heavy-ion scaling (omits Barkas z³/Bloch z⁴).

### Phase 3 — shielding transport + interactive dosimeter UI

- **CSDA slab transport** — ion range tables per shield material with range↔energy
  inversion, residual-energy `E_out(E_in,t)` ([`src/physics/ionRange.ts`](src/physics/ionRange.ts),
  [`src/dose/shieldedDose.ts`](src/dose/shieldedDose.ts)). Integrated in residual-energy space so
  the slow-exiting-particle LET spike cancels analytically (smooth, jitter-free curves).
- **Dose-equivalent vs shield areal density** for Al / polyethylene / water —
  [`src/validation/runPhase3.ts`](src/validation/runPhase3.ts).
- **Vite dosimeter UI** ([`src/ui/`](src/ui/)) — instrument-grade controls (material, thickness,
  solar condition, mission duration), live readout vs the NASA 600 mSv career limit, an
  overlaid dose-vs-thickness chart, and a live validation suite. Heavy integrations run in a
  Web Worker.

```
R_shield(E_in) ≤ t  → stops in shield;   else  E_out = R_shield⁻¹(R_shield(E_in) − t)
H(t) = κ · Σ_Z ∫ 4π·J_Z(E_in) · S_water(Z,E_out) · Q(LET(E_out)) dE_in
```

**Result (spec validation #3):** polyethylene gives lower dose-equivalent than aluminium at
**every** areal density (poly < water < Al, matching the ⟨Z/A⟩ ordering) — by ~12% at 20 g/cm².
The range table reproduces NIST PSTAR proton ranges in Al to <0.4% (9.98 vs 10.01, 412.2 vs
412.4 g/cm²), and t=0 reduces exactly to the Phase-2 free-space dose. Aluminium shows
diminishing returns (only ~60% reduction across 40 g/cm²). **Honest caveat:** this primary-only
model *under-states* polyethylene's true advantage, which also stems from its lower nuclear
fragmentation — Phase 5.

### Phase 4 — MSL/RAD cruise-dose validation + auto-generated report

- **RAD comparison** — model dose-equivalent behind ≈16 g/cm² Al-equiv at the cruise modulation
  (φ≈550–800 MV → Matthiä W≈30), set **independently** of the measurement —
  [`src/dose/radComparison.ts`](src/dose/radComparison.ts), [`src/validation/runPhase4.ts`](src/validation/runPhase4.ts).
- **Auto-generated portfolio report** — markdown + PNG plots (NIST validation, shielding curve,
  RAD comparison) — [`src/report/generateReport.ts`](src/report/generateReport.ts) → [`report/DOSEFIELD_report.md`](report/DOSEFIELD_report.md).

| quantity | model | measured (RAD) | ratio |
|---|---|---|---|
| absorbed dose | 0.31 | 0.46 mGy/day | **0.67** |
| dose-equivalent | 1.47 | 1.75 mSv/day | **0.84** |
| mean ⟨Q⟩ | 4.78 | 3.82 | **1.25** |

**Result (spec validation #2):** within the ~2× bar, with the measured 1.75 mSv/day lying inside
the model's W/shielding bracket (1.25–1.78 mSv/day). The disagreement is physically coherent:
absorbed dose is *under*-predicted (missing spacecraft secondaries) while ⟨Q⟩ is *over*-predicted
(no fragmentation to break HZE ions into lower-LET fragments) — partly cancelling in H. Both point
to Phase 5. Measured: Zeitlin et al., *Science* 340 (2013) 1080; Guo et al., *A&A* 577 (2015) A58.

### Phase 5 — simplified nuclear fragmentation (optional, post-MVP)

A simplified projectile-fragmentation model (Bradt–Peters charge-changing cross-sections,
single-collision fragment buildup) — [`src/physics/fragmentation.ts`](src/physics/fragmentation.ts),
[`src/dose/fragmentedDose.ts`](src/dose/fragmentedDose.ts), [`src/validation/runPhase5.ts`](src/validation/runPhase5.ts).
HZE primaries attenuate (`λ = A_t/(N_A·σ)`) and break into lower-LET fragments. Two robust,
parameter-free results that move the model **toward** RAD:

- **⟨Q⟩ softens** 4.78 → 4.41 (measured 3.82) behind 16 g/cm² Al.
- **Polyethylene's advantage grows** 11.6% → **33.3%** at 20 g/cm² — iron's charge-changing mean
  free path is 6.8 g/cm² in poly vs 21.8 in Al (poly destroys ~90% of Fe behind 16 g/cm² vs ~52%),
  so fragmentation is *why* hydrogen-rich shielding wins.

**Honest limitation:** absorbed dose does *not* rise toward 0.46 mGy/day — this model omits the
secondary **neutrons** / target fragments that carry much of the shielded dose. That is HZETRN's
job and is deliberately out of scope; Phase 5 isolates the ⟨Q⟩-softening and material-ordering.

## Project structure

```
src/
  physics/          energy-loss & nuclear engine (validated first, per build plan)
    constants.ts        CODATA 2018 physical constants
    materials.ts        cited material data (Al / water / polyethylene)
    stoppingPower.ts    Bethe–Bloch + Sternheimer density effect      (Phase 1)
    range.ts            CSDA range via ∫ dE / S                        (Phase 1)
    effectiveCharge.ts  Barkas z_eff(Z,β)                              (Phase 2)
    ionStopping.ts      heavy-ion stopping via z_eff² scaling          (Phase 2)
    qualityFactor.ts    ICRP-60 Q(LET)                                 (Phase 2)
    ionRange.ts         per-material ion range tables + inversion      (Phase 3)
    fragmentation.ts    Bradt–Peters charge-changing cross-sections    (Phase 5)
  dose/             dose pipelines built on the physics engine
    doseModel.ts        free-space GCR dose / LET / H / ⟨Q⟩            (Phase 2)
    shieldedDose.ts     CSDA slab transport in residual-energy space   (Phase 3)
    radComparison.ts    model vs MSL/RAD cruise dose                   (Phase 4)
    fragmentedDose.ts   fragmentation-corrected shielded dose          (Phase 5)
  validation/       headless PASS/FAIL harnesses (runPhase1..5.ts)
  report/           generateReport.ts → markdown + PNG plots          (Phase 4)
  ui/               Vite dosimeter (main.ts, styles.css, dose.worker.ts)
data/
  pstar/            NIST PSTAR reference tables (accessed 2026-06-16)
  gcr/              Matthiä et al. (2013) GCR spectrum coefficients
  rad/              MSL/RAD measured cruise-dose values
test/               vitest regression lock (physics + phase2..5)
```

## Run it

```bash
npm install
npm run dev               # interactive dosimeter UI (Vite)
npm run validate:phase1   # PASS/FAIL table vs NIST PSTAR
npm run validate:phase2   # GCR dose / LET / Q / dose-equivalent report
npm run validate:phase3   # shielding sweep + poly<Al trend
npm run validate:phase4   # model vs measured MSL/RAD cruise dose
npm run validate:phase5   # simplified fragmentation → movement toward RAD
npm run report            # auto-generate report/ (markdown + 4 PNG plots)
npm test                  # vitest regression lock (76 tests)
```

## Data sources

- **NIST PSTAR** — stopping power & range tables for protons,
  <https://physics.nist.gov/PhysRefData/Star/Text/PSTAR.html> (accessed 2026-06-16).
- **Sternheimer density-effect parameters** — PDG Atomic & Nuclear Properties (2023),
  from R.M. Sternheimer, M.J. Berger, S.M. Seltzer, *At. Data Nucl. Data Tables* **30**, 261 (1984).
- **GCR spectrum** — D. Matthiä, T. Berger, A.I. Mrigakshi, G. Reitz, "A ready-to-use galactic
  cosmic ray model", *Adv. Space Res.* **51** (2013) 329–338, doi:10.1016/j.asr.2012.09.022
  (DLR-modified ISO 15390; coefficients via reference implementation `ssc-maire/CosRayModifiedISO`).
- **Quality factor** — ICRP Publication 60 (1991), *Annals of the ICRP* 21(1–3).
- **Effective charge** — W.H. Barkas, *Nuclear Research Emulsions* (1963).
- **MSL/RAD measurements** — C. Zeitlin et al., *Science* **340** (2013) 1080, doi:10.1126/science.1235989;
  J. Guo et al., *A&A* **577** (2015) A58, doi:10.1051/0004-6361/201525680.
- **Physical constants** — CODATA 2018.

## Status: all phases complete

The required MVP (Phases 1–4) and the optional Phase 5 are **done and validated against NIST PSTAR
and NASA MSL/RAD**. Possible future extensions (explicitly *not* attempted here): explicit neutron /
target-fragment transport (the absorbed-dose gap), multi-generation fragmentation cascades, 3-D
geometry, and energy-dependent nuclear cross-sections — i.e. the territory HZETRN/OLTARIS occupy.

## License

The code is released under the **MIT License** — see [`LICENSE`](LICENSE). This applies to
the model and tooling only; the third-party scientific data it depends on (NIST PSTAR, the
Matthiä et al. GCR model, ICRP-60, and the MSL/RAD measurements) remains under its own terms
and is credited under [Data sources](#data-sources) above.
