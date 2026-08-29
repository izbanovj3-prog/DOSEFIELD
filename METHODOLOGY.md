# DOSEFIELD — Methodology

What this model does, where every piece of it came from, how well it agrees with independent
measurements, and where it stops. Written to be read by a physicist with the repository open.

**This is not [`METHODS.md`](METHODS.md).** That file holds the equations, the constant values, and
a worked example you can check by hand. This file holds the *provenance ledger* (what is cited
versus what is implemented here), the validation results, the honest comparison with published
numbers, and the limitations. Read `METHODS.md` for "what is the formula"; read this for
"whose formula is it, and how good is the answer".

**Every number below was produced by running the code on 2026-08-28** — `npm run validate:phase1..5`,
`npm run report`, `npm run verify:deployed`, and a per-material recomputation against the NIST PSTAR
tables in `data/pstar/`. Nothing is transcribed from an older report. If a figure here ever disagrees
with what the code prints, the code is right and this file is stale — rerun and fix the file.

---

## 1. The physical model

### 1.1 What is modelled

A deterministic, one-dimensional slab. Galactic-cosmic-ray ions enter normal to a shield of stated
areal density; each ion is slowed continuously; what emerges deposits energy in a thin water target.

| Effect | Implementation | Module |
|---|---|---|
| Electronic stopping power | Bethe formula with the Sternheimer density-effect correction δ(βγ) | `src/physics/stoppingPower.ts` |
| CSDA range | numerical ∫dE/S(E) in areal density (g/cm²) | `src/physics/range.ts`, `src/physics/ionRange.ts` |
| Heavy ions (Z = 1…28) | effective-charge z_eff²(β) scaling of the proton engine | `src/physics/effectiveCharge.ts`, `src/physics/ionStopping.ts` |
| Radiation quality | ICRP-60 Q(L), three-branch, on LET in water | `src/physics/qualityFactor.ts` |
| GCR spectrum | Matthiä et al. 2013 parametric fit, solar modulation via W ∈ [0, 130] | `data/gcr/matthia2013.ts` |
| Slab transport | CSDA slowing-down, integrated in **residual** energy so the exit-LET spike cancels | `src/dose/shieldedDose.ts` |
| Layered shields | sequential application of the same engine | `src/dose/multiLayerDose.ts` |
| Projectile fragmentation (optional mode) | Bradt–Peters charge-changing cross-section → interaction mean free path → single-collision, charge- and mass-conserving fragment yield | `src/physics/fragmentation.ts`, `src/dose/fragmentedDose.ts` |

### 1.2 What is deliberately **not** modelled, and why

These are scope decisions, not oversights. Each one is stated in the UI at the point of use, in the
generated report, and in the limitations table below.

| Omitted | Why it is omitted | What it costs (measured, §3.3) |
|---|---|---|
| Secondary **neutrons** | Neutron production and transport require a nuclear-reaction network and a 3-D geometry. That is what HZETRN and OLTARIS exist to do. | Small: measured in-cruise neutrons are 6 ± 2 µGy/day and 30 ± 10 µSv/day, ~1–2% of the total (Köhler et al. 2015). |
| Secondary charged particles and **target fragments** produced in the shield | Same reason: it is the other half of a full nuclear transport code. | This is the dominant term in the absorbed-dose gap — see §3.3. |
| Multi-generation fragmentation cascades | The fragmentation mode is deliberately single-collision, so it stays parameter-free and inspectable. | Not separately quantified in this work. |
| Three-dimensional geometry / angular distribution | The model is a 1-D slab by design. **No result here should be read as a 3-D field calculation.** | RAD sat behind an anisotropic shielding distribution; the 10–20 g/cm² bracket in §3.2 is how that uncertainty is carried. |
| Shell, Barkas (z³) and Bloch (z⁴) corrections to Bethe | Omitting them keeps the stopping-power core small enough to verify by hand — and the cost is measured rather than assumed. | ≤1.55% above 10 MeV, ≤4.03% down to 1 MeV (§3.1). It is also why only low-Z shields are offered. |
| Solar particle events (SPE) | A different source with different statistics; mixing it into a GCR result validated against RAD would contaminate the one thing that is validated. | Mission totals are snapshots at fixed W. |
| Energy-dependent nuclear cross-sections | Bradt–Peters is geometric and energy-independent. | Not separately quantified in this work. |

---

## 2. Provenance — what is cited, what is implemented here

The distinction that matters at a defence: **none of the physics equations in this project are
original.** They are published results, cited below, transcribed and implemented. What is original is
the assembly, the validation discipline, and the measured statement of where the assembly stops
being trustworthy.

### 2.1 Taken verbatim from a source

| Item | Source | Where it lives |
|---|---|---|
| Bethe stopping-power formula and the Sternheimer density-effect parameterisation | PDG, *Passage of particles through matter*; parameters ultimately R.M. Sternheimer, M.J. Berger, S.M. Seltzer, *At. Data Nucl. Data Tables* **30**, 261 (1984) | `src/physics/stoppingPower.ts`, `densityEffect` block of each material |
| K = 4π·N_A·r_e²·m_e·c² = 0.307075 MeV·mol⁻¹·cm² | PDG | `src/physics/constants.ts` |
| m_e c², m_p c², u·c², N_A | CODATA 2018 | `src/physics/constants.ts` |
| ⟨Z/A⟩, density, mean excitation energy I for all five materials | NIST PSTAR composition pages (accessed 2026-06-16; H₂ and CH₄ 2026-06-27) | `src/physics/materials.ts` |
| Reference stopping powers and CSDA ranges used as the validation target | NIST PSTAR proton tables — **entered by hand**: PSTAR is a CGI form and cannot be fetched programmatically | `data/pstar/*.ts` |
| Q(L) three-branch quality function | ICRP Publication 60 (1991), *Annals of the ICRP* 21(1–3) | `src/physics/qualityFactor.ts` |
| GCR differential flux coefficients (28 species, DLR-modified ISO 15390 fit to Badhwar–O'Neill) | D. Matthiä, T. Berger, A.I. Mrigakshi, G. Reitz, *Adv. Space Res.* **51** (2013) 329, doi:10.1016/j.asr.2012.09.022 — coefficients transcribed from the reference implementation `ssc-maire/CosRayModifiedISO` | `data/gcr/matthia2013.ts` |
| Effective-charge convention z_eff(Z, β) | W.H. Barkas, *Nuclear Research Emulsions* (1963) | `src/physics/effectiveCharge.ts` |
| Bradt–Peters charge-changing cross-section (r₀ = 1.35 fm, overlap b = 0.83) | Bradt & Peters geometric form, standard parameters | `src/physics/fragmentation.ts` |
| MSL/RAD cruise measurements used as the comparison target | C. Zeitlin et al., *Science* **340** (2013) 1080, doi:10.1126/science.1235989; J. Guo et al., *A&A* **577** (2015) A58, doi:10.1051/0004-6361/201525680 | `data/rad/zeitlin2013.ts` |
| Cruise neutron component | J. Köhler et al., *Life Sci. Space Res.* **5** (2015) 6, doi:10.1016/j.lssr.2015.03.001 | quoted in §1.2 and the limitations table |
| GCR-model accuracy versus AMS-02 (±14%) | J.W. Norbury, K. Whitman, K. Lee, T.C. Slaba, F.F. Badavi, *Life Sci. Space Res.* **18** (2018) 64, Table 1 | `src/validation/uncertainty.ts` |
| Stopping-power accuracy bound (±4%, compounds) | ICRU Report 49 (1993), as quoted in the NIST STAR documentation | `src/validation/uncertainty.ts` |

### 2.2 Implemented in this work on the basis of those sources

Not new physics — new code, and the numbers it produces.

| Implemented here | Note |
|---|---|
| Numerical CSDA range by integrating 1/S, with range↔energy inversion and per-ion caching | `src/physics/range.ts`, `src/physics/ionRange.ts`; convergence asserted in `test/physics.test.ts` |
| The slab-transport integration **in residual (exit) energy** rather than incident energy | a numerical choice, not a physical one: integrating in incident energy made the slow-exiting-particle LET spike produce visible jitter in the curves |
| Convolution of the GCR spectrum with the stopping engine to absorbed dose, LET spectrum, ⟨Q⟩ and dose-equivalent | `src/dose/doseModel.ts` |
| Sequential multi-layer stack, exactly reducing to the single slab in the one-layer limit | `src/dose/multiLayerDose.ts`; reduction asserted to <0.5% in `test/phase3.test.ts` |
| Single-collision fragment yield n(Z_f) = 2/(Z_p − 1) with A_f = A_p·Z_f/Z_p | conserves both charge and mass into charged fragments by construction; asserted in `test/phase5.test.ts` |
| Quadrature combination of the three cited uncertainty components | `src/validation/uncertainty.ts` |
| The whole validation harness and the shielding-ranking result | `src/validation/`, `test/` |

### 2.3 Parameter-fitting policy

**No parameter in this project was fitted to any validation target.** Three properties make that
checkable rather than merely asserted:

1. Every constant traces to a source published before the comparison it is used in. The cruise
   solar modulation W ≈ 30 was set from the OULU neutron-monitor relation and the φ range given by
   Guo et al. 2015 — not adjusted to improve agreement.
2. There is exactly one code path for each reported number. `computeValidationSummary()`
   (`src/validation/validationSummary.ts`) feeds the in-app panel, the generated report and the
   deployed-build check alike; `npm run verify:deployed` re-derives the UI-path values and compares
   them against the report values (7 quantities + 2 physics-direction invariants — all PASS this run).
3. Test tolerances are never widened to make a failing check pass. Where the model disagrees with a
   measurement, the disagreement is reported (§3.3), not absorbed.

---

## 3. Validation — results of the 2026-08-28 run

### 3.1 Stopping power and range versus NIST PSTAR

`npm run validate:phase1` → **GATE: PASS**. Stopping power **50/50** points pass, CSDA range
increment **45/45**.

| | max \|error\|, all E (1–1000 MeV) | max \|error\|, E ≥ 10 MeV |
|---|---|---|
| stopping power | **4.03%** | **1.55%** |
| CSDA range increment ΔR | **3.83%** | **2.26%** |

Per material, recomputed this run against the tables in `data/pstar/` (10 points each):

| material | I [eV] | ⟨Z/A⟩ [mol/g] | max \|err\| all E | max \|err\| ≥10 MeV |
|---|---|---|---|---|
| hydrogen (H₂) | 19.2 | 0.99212 | **0.136%** | **0.028%** |
| methane (CH₄) | 41.7 | 0.62332 | 2.655% | 0.336% |
| polyethylene | 57.4 | 0.57034 | 3.450% | 0.431% |
| water | 75.0 | 0.55509 | 3.475% | 0.673% |
| aluminium | 166.0 | 0.48181 | 4.026% | **1.554%** |

The ordering is the physics: hydrogen has one electron and therefore a negligible shell correction,
so it is the best-reproduced material; aluminium is the worst of the five for the same reason in
reverse. The residual grows toward low energy, which is exactly the signature of the omitted shell
correction — reported, not tuned away. This is also why **only low-Z materials are offered**: the
same test rejects high-Z shields (see §5, item 4).

### 3.2 Free-space and shielding results

`npm run validate:phase2` / `phase3` → **PASS**.

Free space, solar minimum (W = 0), primaries only:
absorbed dose **0.482 mGy/day** · dose-equivalent **2.936 mSv/day** (1.072 Sv/yr) · ⟨Q⟩ **6.086** ·
iron alone carries **27%** of the dose-equivalent. Solar maximum (W = 130): **0.757 mSv/day**,
⟨Q⟩ 6.510 — solar-minimum dose is the higher of the two, as it must be.

Shielding, at equal areal density, dose-equivalent increases strictly along
**H₂ < CH₄ < polyethylene < water < aluminium** at *every* thickness tested from 5 to 40 g/cm².
The ranking is by hydrogen content (electrons per gram, ⟨Z/A⟩) and is asserted as a monotonicity
test, not an eyeballed trend. Polyethylene — the best solid — beats aluminium by **11.6%** at
20 g/cm²; hydrogen by up to **44.2%**. Shielding shows strong diminishing returns:
H(0) = **2.936** → H(40 g/cm²) = **1.170 mSv/day**, only 60% reduction across 40 g/cm², because
slowing primaries raises their LET and therefore Q.

### 3.3 MSL/RAD cruise comparison, and the absorbed-dose gap

`npm run validate:phase4` → **GATE: PASS** (within 2×). Model run at W ≈ 30 behind ≈16 g/cm²
aluminium-equivalent, both set independently of the measurement.

| quantity | model | measured (RAD) | ratio |
|---|---|---|---|
| absorbed dose [mGy/day] | **0.308** | 0.458 ± 0.032 | **0.673** |
| dose-equivalent [mSv/day] | **1.473** | 1.750 ± 0.30 | **0.842** |
| mean quality ⟨Q⟩ | **4.775** | 3.820 ± 0.25 | **1.250** |

Model dose-equivalent across the W and shielding brackets: **1.253–1.775 mSv/day** — the measured
1.750 lies inside it. With propagated input uncertainty the model value reads
**H = 1.47 ± 0.22 mSv/day (±14.6%)**: the quadrature of GCR flux ±14% (Norbury 2018) ⊕ stopping
power ±4% (ICRU-49) ⊕ this run's computed 1.55% PSTAR deviation. That band is **input uncertainty
only** — it deliberately excludes the model-form gap below and the Q(L) convention choice.

**The 0.673× absorbed-dose ratio is the model's declared limit, and it is left open on purpose.**
Three observations make it a diagnosis rather than an excuse:

1. **The structure of the disagreement matches the omission.** With no secondary production, the
   model must under-predict D. With no fragmentation to break HZE ions into lower-LET pieces, it
   must over-predict ⟨Q⟩ — and it does (1.250×). The two errors act in opposite directions and
   partially cancel in H = ⟨Q⟩·D, which is why the dose-equivalent ratio (0.842×) is closer to
   unity than the absorbed-dose ratio. A model tuned to the measurement would not reproduce that
   internal structure; it would simply match.
2. **Adding the missing physics moves the right quantity.** `npm run validate:phase5` → **PASS**:
   switching on simplified fragmentation moves ⟨Q⟩ **4.775 → 4.407** toward the measured 3.820,
   while absorbed dose *falls* **0.308 → 0.258** — because the charged-fragment channel is now
   modelled but the neutron and target-fragment channels still are not. The prediction and its
   failure both land where the omission says they should.
3. **The measured neutron component is too small to close it.** 6 ± 2 µGy/day and 30 ± 10 µSv/day,
   ~1–2% of the total (Köhler et al. 2015). The gap is therefore carried by secondary *charged*
   particles and target fragments — a specific, falsifiable attribution.

Fragmentation also widens the polyethylene-versus-aluminium advantage at 20 g/cm² from
**11.6% → 33.3%**, which is the physically expected direction for a hydrogen-rich shield.

### 3.4 Verification status of this run

```
npm run typecheck   → 0 errors
npm test            → 137/137 pass (7 files)
npm run build       → clean
npm run validate:phase1..5 → 5/5 GATE PASS
npm run report      → regenerates byte-identical output (no drift)
npm run verify:deployed → PASS, 7 quantities + 2 invariants
```

---

## 4. Where this sits relative to published work

### 4.1 Against the measurement

The only fair benchmark for this model is the published measurement itself, because that is the one
number it was built to be checked against.

| configuration | source | D [mGy/day] | H [mSv/day] |
|---|---|---|---|
| MSL cruise, ≈16 g/cm² Al-eq (2011–12) | **DOSEFIELD**, 1-D primaries — computed this run | 0.308 | 1.473 |
| MSL cruise, same | measured, MSL/RAD (Zeitlin et al. 2013; Guo et al. 2015) | 0.458 ± 0.032 | 1.750 ± 0.30 |

### 4.2 Against professional transport codes — stated, not benchmarked

**HZETRN, OLTARIS, GEANT4, PHITS, FLUKA and MCNP6 are established professional radiation-transport
codes with full three-dimensional geometry, nuclear-reaction networks and secondary-particle
transport. This project is not one of them, is not a reimplementation of one, and does not claim
comparable capability.** No performance or accuracy benchmark against those codes is presented here,
because this project has no access to them and any such comparison would be fabricated rather than
measured.

What can honestly be quoted is published context for how those codes fare against the *same
instrument*, in a *different* configuration — Mars surface, not cruise — so it is context, not a
benchmark for this model:

| configuration | model | D [mGy/day] | H [mSv/day] | source |
|---|---|---|---|---|
| Mars surface (Gale crater, GCR) | GEANT4 / PHITS / HZETRN-OLTARIS, range over codes | 0.16–0.20 (tissue) | 0.51–0.60 | Matthiä et al. 2016, *JSWSC* **6**, A13 |
| Mars surface, same | measured, MSL/RAD | 0.21 ± 0.04 | 0.64 ± 0.12 | Matthiä et al. 2016 |

On their own benchmark those full 3-D codes land at roughly 0.76–0.95× of the measurement. Separately,
the 2016 MSL/RAD modelling workshop reported that among seven such codes "differences of factors of
two are not uncommon" (Hassler & Norbury 2017, *LSSR* **14**, 1). No published per-code value for the
MSL **cruise** configuration was found, so that row is left as *not available* here and in the README
rather than estimated.

**Placement, in one sentence:** DOSEFIELD is a simplified one-dimensional model, independently
validated at two levels — micro-physics against NIST PSTAR and integral cruise dose against NASA
MSL/RAD — built for education and portfolio use, with its region of validity measured and stated
rather than assumed; it is not a substitute for HZETRN or OLTARIS and should not be used for
mission planning.

---

## 5. Known limitations

1. **Absorbed dose is under-predicted by a factor 0.673** against MSL/RAD, because secondary charged
   particles and target fragments produced in the shield are not transported. Declared scope limit;
   diagnosed in §3.3; not closed by any correction factor.
2. **⟨Q⟩ is over-predicted (1.250×)** in primaries mode for the same reason — no fragmentation
   softening of the HZE LET spectrum. The fragmentation mode reduces it to 4.407 but does not
   remove it.
3. **Stopping power carries a few-percent residual** that grows toward low energy — ≤1.55% above
   10 MeV, ≤4.03% down to 1 MeV — from the omitted shell, Barkas and Bloch corrections.
4. **Only low-Z shields qualify.** High-Z materials were tested and **rejected**, not simply
   omitted, because Bethe without shell corrections cannot reproduce PSTAR for them.
   *Caveat on this item:* the specific failure percentages quoted historically for lead and titanium
   are **not reproducible from this repository** — there is no Pb or Ti dataset in `data/pstar/` and
   no test covering them. The qualitative conclusion stands; the digits should not be quoted until
   the tables are pasted in and the check is rerun.
5. **Multi-layer stacks are unvalidated beyond the single-layer limit.** They run the same engine and
   reduce exactly to the validated single slab (<0.5%, asserted), but no NASA layered cruise
   measurement exists to validate a stack against. Labelled as such in the UI at the point of use.
6. **Organ figures are depth-dose estimates**, not organ doses: dose at 0.007 / 0.3 / 5 g/cm² of
   water behind the stack (NASA/NCRP shallow / eye / deep convention). ICRP-60 tissue weighting
   factors w_T are **not** applied as multipliers — w_T builds effective dose *from* organ doses, and
   using them the other way round would be wrong.
7. **Z ≥ 3 GCR spectra are not directly constrained** by the AMS-02 comparison that sets the ±14%
   flux uncertainty; that comparison covers H and He only. Comparable accuracy for heavier ions is a
   stated assumption, not a measured one.
8. **Geometry is a straight-ahead 1-D slab of one thickness**, while RAD sat behind an anisotropic
   distribution with most of the solid angle under 10 g/cm². This is carried as the 10–20 g/cm²
   bracket, not as a correction.
9. **The GCR rate is constant over a mission** — no solar-cycle variation and no solar particle
   events. Mission totals are snapshots at a fixed W.
10. **ICRP-60 Q(L) is used rather than ICRP-103 w_R.** A convention choice, made to match how
    MSL/RAD reports dose-equivalent; stated in the UI, not an error.
11. **The five live self-checks shown in the app run only in the browser worker** and are therefore
    not covered by the `vitest` suite. The same physics invariants are separately asserted in
    `test/phase3.test.ts` and `test/phase5.test.ts`.

---

## 6. Reproducing everything in this document

```
npm ci
npm run typecheck
npm test
npm run validate:phase1     # NIST PSTAR stopping power + CSDA range
npm run validate:phase2     # GCR spectrum → dose → LET → Q(L)
npm run validate:phase3     # shielding transport + material ranking
npm run validate:phase4     # MSL/RAD cruise comparison
npm run validate:phase5     # simplified fragmentation
npm run report              # regenerates report/DOSEFIELD_report.md + plots
npm run verify:deployed     # UI-path values vs report values
```

Everything except `npm run report` runs in CI on every push (`.github/workflows/ci.yml`), including
`verify:deployed` — so a number that drifts between the app and the report fails the build rather
than waiting to be noticed.
