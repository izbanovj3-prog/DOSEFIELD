# CODE GATE — Paper 1 preprint (code side)

Date: 2026-10-09. Numeric freeze `0130722`; release-prep commits up to `ea8bd00` plus the evidence commit.

| gate | status | basis |
|---|---|---|
| tests green | **FAIL** | `vitest` 190/190 PASS and `validate:phase1..5` PASS, but `verify:deployed`, which CI runs (`ci.yml:57`), **fails 3/7**: hardcoded W = 30-era references at `src/validation/verifyDeployed.ts:45,46,48` (1.47 / 4.78 / 4.41 vs computed 1.318 / 4.995 / 4.598). Not edited, per brief rule 6. |
| HEAD SHA recorded | **PASS** | `evidence/freeze.md`: numeric freeze `0130722f5357448becf35f9cb40c2eb5a6bad2da`; later commits change no computed value (field-by-field check). |
| reproduction deterministic | **PASS** | Two clean-checkout runs are identical except `provenance.generatedUTC`. `provenance.gitHead` = `unknown` when there is no `.git/` directory, e.g. in a Zenodo zip. |
| manuscript numbers match | **HUMAN-ONLY** | Not run: manuscript path not provided (asked once). Command in `evidence/release_steps.md` §0.4. |
| geometry audit done + verdict | **PASS** | `evidence/geometry_audit.md`. Implemented geometry: **uniform spherical shell** (4π·J, the same normal t in every direction, no cos θ). "Planar" is WRONG; "1-D slab" as a geometry statement is MISLEADING. Manuscript sentences pending the path. |
| high-energy exposure reported | **PASS** | `evidence/high_energy_exposure.{csv,md}`: at W = 47.50 behind 20 g/cm², 48–57% of D and 52–74% of H come from E_in > 1000 MeV/n (H₂ highest). Closure vs the engine ≤ 8e-15. |
| references resolve | **HUMAN-ONLY** | `evidence/reference_check.csv`: **11 Y / 0 N / 3 manual** (Barkas 1963, ICRP 60, ICRU 49). Guo 2015b and Slaba 2010 could not be identified, and the rest of `references.bib` is unchecked: bib path not provided. Davis 2026 version DOI = CosRayModifiedISO **v1.2.12** (matches); the concept DOI currently resolves to the same record. |
| ASTAR re-derived | **PASS** | Raw NIST exports archived with SHA-256 (`data/nist/astar/`); transcription matches (0/40 mismatches); recomputed **1.437%** (Al, 10 MeV/n) and **−4.517%** (H, 1 MeV/n), equal to the manuscript figures. z_eff note in `evidence/astar_note.md`. |
| CITATION/.zenodo valid | **HUMAN-ONLY** | CFF valid against schema 1.2.0 (cffconvert 2.0.0); .zenodo.json valid JSON with Zenodo vocabulary IDs checked. The **author block is pending confirmation** and the **preprint identifier is a placeholder**, so both need the author before release. |
| README consistent | **FAIL** | Fixed (`f002e99`): stale 1.67 → 1.48 mSv/day; the neutron row (measured vs extrapolated); "not effective dose"; JUDGE_PREP 0.33× → 0.42×. The items from the validation plan (units comment, zeitlin naming, radComparison comment, UI min duration, uncertainty.ts) were already in the committed edits. **Still inconsistent:** README/METHODS/UI describe the geometry as a "1-D slab" while the code implements a shell (author wording decision). Not checked against the manuscript (no path). |
| site in sync | **FAIL** | Live = `34b35a9`: W ≈ 30, 0.84×, ±14.6% vs manuscript W = 47.50, ε_φ = 0.20. A local build of the frozen code gives 0.75× and ±20.5% (in sync) but prints `φ≈550–800 MV → Matthiä W≈47.49528000000009, behind 16 g/cm² Al-equiv` (`src/ui/main.ts:979`): unformatted, and framed as derived from φ. |

## HUMAN-ONLY steps, in order

0. Clear the blockers in `evidence/release_steps.md` §0: the `verify:deployed` decision, the authors, the `.zenodo.json` placeholder, the manuscript check.
1. Push the commits (`git push origin main`) and the tag (`git tag -a paper1-v1.0.0 …` as drafted in `release_steps.md`, then `git push origin paper1-v1.0.0`). Pushing `main` redeploys the site.
2. Enable the repository in Zenodo (GitHub integration), create the GitHub release `paper1-v1.0.0`, and wait for the DOI.
3. Paste the DOI into CITATION.cff and the manuscript and commit that; **do not move the tag**. The archived version is the tag's content, which does not include the DOI line added afterwards.

## DEVLOG packet

**CHANGED (this session):**
- Committed the pending W/ε_φ correction as 8 logical commits (`899ee1d`…`0130722`).
- `f002e99`: README.md, JUDGE_PREP.md, src/ui/main.ts (comment).
- `37115a3`: .gitattributes, data/nist/astar/* (5 raw exports + README).
- `ea8bd00`: CITATION.cff, .zenodo.json.
- evidence/: freeze.md, geometry_audit.md, high_energy_exposure.{csv,md}, reference_check.csv, astar_note.md, release_steps.md, CODE_GATE.md, paper1_results_0130722.json.
- No physics, constant or test was changed by this session.

**VERIFIED this run:**
- Tests 190/190; tsc 0/0; phases 1–5 PASS; verify:deployed FAIL 3/7.
- W = 47.4953; D 0.2638 mGy/d; H 1.3178 mSv/d; ⟨Q⟩ 4.995; ratios 0.576 / 0.753; ε_H 0.20455; PSTAR 1.554%.
- He ASTAR 1.437% / −4.517%; high-energy share (H₂, 20 g/cm², W = 47.50) 57.0% D / 73.7% H above 1 GeV/n.
- z_eff He 1.948 / 2.000 / 2.000; z_eff Fe 22.72 / 25.94 / 26.00.

**SCREENSHOT:** none taken. The live-site and local-build checks were DOM reads (values quoted in the table above).

**DEVLOG draft:** omitted. The brief (rule 5) forbids prose in the author's voice; the facts above are the material for it.
