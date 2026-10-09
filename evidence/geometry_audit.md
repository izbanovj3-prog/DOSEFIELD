# Geometry audit — what the dose integral actually implements

Audit date: 2026-10-09. Tree audited: `0130722` (paper-1 freeze). Read-only — no code changed.

## 1. Findings from the code

| question | answer | evidence (file:line, tree 0130722) |
|---|---|---|
| Where is the solid-angle factor applied? | **4π**, in every dose engine, multiplying the Matthiä differential intensity J [/(cm²·s·sr·MeV/n)] to give the omnidirectional fluence rate. No 2π factor exists anywhere in `src/`. | `src/dose/doseModel.ts:6,23,71` · `src/dose/shieldedDose.ts:13–14,30,75` · `src/dose/fragmentedDose.ts:29,70` · `src/dose/multiLayerDose.ts:34,94` · `src/ui/spectrum.ts:39,120,194` · METHODS.md:133–136 |
| Is any cos θ / slant-path weighting used? | **No.** `grep -i "cos(\|slant\|hemisphere"` over `src/` finds nothing in any dose path. The shield thickness enters only as the range shift `R(E_in) = R(E_out) + t`, the same `t` for every particle. | `src/dose/shieldedDose.ts:72` · `src/dose/fragmentedDose.ts:67` · `src/dose/multiLayerDose.ts:88` · `src/ui/spectrum.ts:186` |
| Fragmentation path length | Survival `exp(−t/λ)` uses the same normal `t` for every particle (no `t/cos θ`). | `src/dose/fragmentedDose.ts:56` · `src/dose/multiLayerDose.ts:68–70` · `src/ui/spectrum.ts:163–164` |
| Is the shield a spherical shell around the target? | **Yes, mathematically.** The full isotropic fluence 4π·J (all directions) is attenuated by the same areal density `t`, so every direction from the target crosses exactly `t`. That is the dose at the centre of a uniform spherical shell of areal density `t`, with straight-ahead CSDA transport along each ray. It is **not** a point behind a planar slab: there, one hemisphere would see slant paths `t/cos θ` (and the other hemisphere would be unshielded, or shielded by something else). | as above |
| What does the RAD comparison assume? | A uniform 16 g/cm² aluminium shell (central case), and the same shell at 10 and 20 g/cm² for the bracket. | `src/dose/radComparison.ts:33,40–42` · `data/rad/zeitlin2013.ts:34–38` |
| The three-bin check | A weighted sum of three uniform shells (2.5 / 9 / 54 g/cm², heavy bin also 20 and 80) with weights 0.3 / 0.5 / 0.2, at W = 47.50. Mean depth 16.05 g/cm² with the 54 g/cm² heavy bin. | `scripts/reproduce_paper1.ts:83–91` |

### What Guo et al. 2015 actually states (retrieved 2026-10-09)

Source: Guo et al., *A&A* 577, A58 (2015), arXiv:1503.06631, PDF retrieved from https://arxiv.org/pdf/1503.06631 on 2026-10-09 and text-extracted locally.

- §2 (p. 2), paraphrased: most of the solid angle around RAD was lightly shielded (column density below 10 g/cm²); the rest was spread over depths up to about 100 g/cm².
- §3 (p. 5), paraphrased: about 30% of incoming trajectories, specified as those "within the field of view of RAD from above" (A∩B coincidence), were lightly shielded (< 5 g cm⁻²). A 50% fraction from below saw 8–10 g cm⁻², and the remaining 20% saw ≥ 20 g cm⁻², averaging roughly 16 g cm⁻². Read the original at this location for exact wording.

**Consequence for the three-bin check.** The 0.3 / 0.5 / 0.2 weights are fractions of particle trajectories within RAD's field of view (as Guo et al. word it), not fractions of the full 4π solid angle. The code applies them as 4π solid-angle weights over uniform shells. Nothing in the text quoted above says whether the two are equivalent. This is an **unstated assumption** that should be labeled wherever the three-bin numbers are quoted. The 16 g/cm² central case uses Guo's average depth as a uniform shell. Because dose is non-linear in depth, the dose behind the mean depth is not the mean of the doses. That is exactly what the three-bin check probes, so the two are consistent in intent.

## 2. Plain-language statement of the implemented geometry

> **One-line description a reader needs:** the dose point sits at the centre of a uniform spherical shell of areal density *t*; the isotropic GCR field (4π·J) reaches it from every direction through exactly *t* of shield, transported straight-ahead along each ray (no slant-path cos θ weighting, no lateral scattering).

"1-D" is accurate in the sense that transport is one-dimensional along each ray and every ray is identical. "Planar slab" is not what is computed.

## 3. Repository statements containing "planar" or "slab" (tree 0130722 + untracked metadata)

Verdicts: **CONSISTENT** = correct as written; **MISLEADING** = defensible only under a reading the text doesn't state (most readers would infer planar geometry); **WRONG** = contradicts the implementation.

| location | text (abridged) | verdict | note |
|---|---|---|---|
| `.zenodo.json:5` (untracked) | "dose behind **planar shields**" | **WRONG** | Implemented geometry is a uniform shell. |
| `METHODS.md:22` | "A deterministic, one-dimensional slab. Galactic-cosmic-ray ions enter normal to a shield of stated areal density" | **MISLEADING** | "Enter normal" combined with 4π·J only holds if every direction is normal to the shield, i.e. a spherical shell. A normally incident beam on a planar slab would not use the omnidirectional 4π·J. |
| `METHODS.md:479` | "Geometry is a straight-ahead 1-D slab of one thickness" | **MISLEADING** | Should say: uniform thickness in every direction (spherical shell). |
| `README.md:31` | "A tractable deterministic 1-D slab model" | **MISLEADING** | Same issue (headline scope statement). |
| `README.md:212` | limitations row "Straight-ahead 1-D slab geometry (single thickness)" | **MISLEADING** | Same. |
| `index.html:61` | hero "Deterministic 1-D slab" | **MISLEADING** | Live UI. |
| `index.html:99–100` | geometry SVG aria-label "galactic cosmic rays arrive from the left, cross the shield slab"; caption "Straight-ahead 1-D slab" | **MISLEADING** | The figure draws a planar, unidirectional beam. The integral is isotropic. |
| `src/ui/main.ts:301,306` · `src/ui/styles.css:249` | comments describing that figure | **MISLEADING** | Follow the figure. |
| `CITATION.cff:20` (untracked) | "transported through a slab shield" | **MISLEADING** | Metadata that will be archived on Zenodo. |
| `report/DOSEFIELD_report.md:129` · `src/report/generateReport.ts:339` | "continuous-slowing-down (CSDA) slab transport — no 3-D geometry" | **CONSISTENT** | Describes per-ray transport, not the geometry. |
| `README.md:100,298` · `METHODS.md:34,143–144,252` · `src/dose/shieldedDose.ts:2` · `src/physics/ionRange.ts:3` · `src/validation/runPhase3.ts:4` | "CSDA slab transport", "exits a slab of areal density t" | **CONSISTENT** | Per-ray transport through areal density t; accurate. |
| `README.md:217,267,269` · `METHODS.md:254,468` · `JUDGE_PREP.md:93` · `src/dose/multiLayerDose.ts:6,13,38` · `src/ui/spectrum.ts:11` | "reduces to the validated single slab" | **CONSISTENT** | Refers to the one-layer case of the stack, not to geometry. |
| `JUDGE_PREP.md:100` · `src/ui/dose.worker.ts:26,168` | organ depth: "one more water slab" | **CONSISTENT** | Same per-ray meaning. |
| `METHODS.md:346` | "the headline stays the 16 g/cm² slab" | **MISLEADING** | It is a 16 g/cm² uniform shell. |
| `README.md:190` · `METHODS.md:343–345` | three-bin check "Guo et al. 2015 bins, weights 0.3/0.5/0.2" | **MISLEADING** | Accurate quote of the bins, but the weights are applied as 4π solid-angle fractions while Guo gives them as fractions of trajectories in RAD's field of view (§1 above). The assumption is unstated. |

### Manuscript statements (r6, `DOSEFIELD_manuscript_draft_r6.md`, checked 2026-10-09)

| r6 line | text (abridged) | verdict |
|---|---|---|
| 9 (abstract) | "a thin water target behind **planar shields**" | **WRONG** |
| 203 (conclusion) | "an open 1-D model of GCR dose behind **planar shields**" | **WRONG** |
| 179 (Fig. 3 caption) | "Thin water target behind a **single planar slab**." | **WRONG** |
| 57 (§2.5 title) | "Slab transport" | CONSISTENT (per-ray transport) |
| 59 | "transported through a slab of areal density t in the straight-ahead CSDA"; "reduces to the single-slab result" | CONSISTENT (per-ray / one-layer meaning) |
| 119 | "The model represents this as a single aluminium slab of 16 g cm⁻²"; "A single slab at the mean depth … underestimates the direction-averaged dose" | **MISLEADING**: it is a uniform 16 g/cm² shell. "Direction-averaged" is the right concept, but a planar slab is not what is computed. |
| 135 | "the slab dose was evaluated at one representative depth per bin … headline … remains the single 16 g cm⁻² slab" | **MISLEADING** (same) |
| 165 | "a single slab at the mean depth for a skewed shielding distribution" | **MISLEADING** (same) |
| 197 | "published HZETRN results for the same slab configurations" | **MISLEADING**: HZETRN's own geometry choices would differ. The comparison needs the shell (sphere-centre) configuration. |
| 21, 161, 241, 243, 251 | "Slaba" (author name) | not applicable |

## 5. Round 2 follow-up (2026-10-09): field of view vs 4π

**Guo et al. (2015a), A&A 577, A58, §3 "Discussions and conclusions", page 5 of 6** (arXiv:1503.06631 PDF, page-by-page extraction):

The sentence describing the shielding as highly non-uniform gives the 30% fraction for trajectories "within the field of view of RAD from above" (A∩B coincidence, their Fig. 1). It gives the 50% fraction as "from below" at 8–10 g cm⁻² and the remaining 20% at ≥ 20 g cm⁻², for an average depth of roughly 16 g cm⁻². (Paraphrased apart from the quoted fragments; see the original for the full sentence.)

§2, page 2 of 6, paraphrased: most of the solid angle was lightly shielded (< 10 g/cm²), and the rest was spread over depths up to about 100 g/cm².

**Reading:** the 30% is explicitly qualified as trajectories **within the field of view of RAD from above** (the A∩B coincidence). The 50% is "from below", and the 20% is the remainder. The fractions are stated for trajectories, not as fractions of 4π. Guo does not state whether they also equal 4π solid-angle fractions. The only 4π-type statement (§2) is the qualitative "most of the solid angle … < 10 g/cm²".

**r6 drops the qualifier.** Line 119 reads "Nearly 30 % of trajectories were shielded by less than 5 g cm⁻², 50 % by 8–10 g cm⁻², and 20 % by 20 g cm⁻² or more", without "within the field of view of RAD from above" or "from below". That makes the fractions read as all-sky.

**Cone variant:** the code has **no cone / restricted-solid-angle option**. A search of `src/` for cone, solid angle, field of view or steradian finds nothing, and every engine integrates the full 4π·J. So "how much the three-bin H and D change if the fractions apply only to a cone" **cannot be computed with the existing code**, and no option was added (as instructed). For the record, the three-bin results with the fractions applied over 4π (W = 47.50, primaries only) are: heavy bin 54 → H ratio 0.832, D 0.594; heavy 20 → 0.879; heavy 80 → 0.813 (`paper1_results.json` → `threeBin`).

## 4. What this audit does NOT do

- It does not change any code or number. The implemented geometry is a legitimate, common approximation; what is at issue is the **label**, not the result.
- It does not quantify how a true planar-slab geometry (hemispherical `t/cos θ`) would change the RAD ratios. That would be a new calculation and is an author decision.
