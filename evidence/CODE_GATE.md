# CODE GATE — Paper 1 preprint (code side)

Updated 2026-10-09, Round 2. Numeric freeze `0130722` (unchanged). Round-2 commits: `e946a32` (verify snapshot), `405f38e` (UI W display), then metadata and evidence.

| gate | status | basis |
|---|---|---|
| tests green | **PASS** | vitest 190/190; tsc 0/0; `validate:phase1..5` all exit 0; `verify:deployed` **7/7 PASS** after `e946a32`. The 3 rows (H_model, ⟨Q⟩_model, ⟨Q⟩ + frag) are a **model regression snapshot**, not a measurement: W = 30-era values replaced by W = 47.50 values from `paper1_results.json`. The measured-H row (1.75) is unchanged. `npm run build` exit 0. |
| HEAD SHA recorded | **PASS** | Numeric freeze `0130722f5357448becf35f9cb40c2eb5a6bad2da` (`evidence/freeze.md`). The reproduction at Round-2 HEAD is identical to the freeze, field by field, apart from provenance. |
| reproduction deterministic | **PASS** | Only `provenance.generatedUTC` differs between runs. `gitHead` = `unknown` without `.git/` (e.g. a Zenodo zip). |
| manuscript numbers match | **PASS** | r6 (`Downloads/DOSEFIELD_manuscript_draft_r6.md`, identical to the Claude Science artifact): **0 value mismatches**, 58/67 OK. The 9 NOT FOUND are stale checker entries whose numbers are absent from r6. Line 151 was hand-checked and matches. `evidence/manuscript_check_r6.md`. |
| geometry audit done + verdict | **PASS** | Implemented geometry: **uniform spherical shell** (4π·J, normal t in every direction). r6 "planar shields" (l. 9, 203) and "single planar slab" (Fig. 3 caption, l. 179) are **WRONG**; "single slab at the mean depth" (l. 119, 135, 165) is MISLEADING. Guo's 30% fraction is FOV-qualified ("within the field of view of RAD from above", §3 p. 5); r6 l. 119 drops the qualifier. The code has no cone option, so no cone variant was computed. |
| high-energy exposure reported | **PASS** | 48–57% of D and 52–74% of H from E_in > 1 GeV/n at W = 47.50, 20 g/cm² (`high_energy_exposure.md`). |
| references resolve | **PASS** | r6 `references.bib` (Claude Science `va6a53c72`, newest): **18 Y / 0 N / 3 manual** (Barkas 1963, ICRP 60, ICRU 49). Davis 2026 = v1.2.12 (version DOI), and the concept DOI resolves to the same record. Findings: (i) NISTSTAR's DataCite metadata (Seltzer, 1993) differ from the bib (Berger et al., 2017); NIST's own landing page matches the bib authors, and the year is NOT RETRIEVED; (ii) the NISTSTAR note "LH2, LCH4" is wrong because the data are NIST gas tables; (iii) Hassler & Norbury 2017 is cited in the repo (literature-context quote, added `a21f2a5`) but is not in the r6 bib. |
| ASTAR re-derived | **PASS** | 1.437% (Al, 10 MeV/n) and −4.517% (H, 1 MeV/n) from the raw NIST exports (sha256 in `data/nist/astar/README.md`). ASTAR "HYDROGEN" (matno 001) and "METHANE" (matno 197) are gas entries. |
| CITATION/.zenodo valid | **HUMAN-ONLY** | Both valid (CFF schema 1.2.0; JSON plus Zenodo vocabularies). Author is "Izbanov, Zhanbolat" only. The affiliation and ORCID placeholders, and the preprint-DOI placeholder in .zenodo.json, must be filled or removed by the author before release. The e-mail was dropped from CFF (not in the author spec). |
| README consistent | **FAIL** | Numbers are consistent (round 1). Geometry is still described as a "1-D slab" in README/METHODS/UI while the code is a shell. That's an author wording decision, not changed here. |
| site in sync | **FAIL (until push)** | Live = `34b35a9` (W ≈ 30, 0.84×, ±14.6%). A local build of the current tree shows "W = 47.50 (Oulu NM, SEP days excluded)", φ as context only, 0.75× and ±20.5%, which is in sync with the manuscript once pushed and deployed. |

## Liquid-constants side calculation (defaults unchanged)

PDG liquid H₂ (2024, index 85: I 21.8 eV, a 0.1348, k 5.6249, x₀ 0.4400, x₁ 1.8856, C̄ 3.0977, δ₀ 0; retrieved 2026-10-09) vs current (I 19.2 eV, δ ≡ 0). Effect at W = 0, 5–40 g/cm²: H₂ dose equivalent **+0.44% to +0.89%** (primaries) and **+0.46% to +1.01%** (fragmentation); D +0.21% to +0.59%. The ranking H₂ < CH₄ < PE < water < Al holds everywhere. The Mars-cruise preset shift is 0 (no H₂/CH₄). Liquid CH₄: **NOT RETRIEVED**, because PDG and NIST list gas only. Details: `liquid_constants_sensitivity.{csv,md}`.

## HUMAN-ONLY steps, in order

0. Fill or remove the placeholders (affiliation, ORCID, preprint DOI); see `release_steps.md` §0. Fix the manuscript wording (planar → shell; Guo's FOV qualifier; NISTSTAR "LH2/LCH4" note).
1. Push the commits (`git push origin main`, which also redeploys the site) and the tag `paper1-v1.0.0` (draft command in `release_steps.md`).
2. Enable the repository in Zenodo, create the GitHub release `paper1-v1.0.0`, and wait for the DOI.
3. Paste the DOI into CITATION.cff and the manuscript and commit that; **do not move the tag**. The archive is the tag's content, without the DOI line.

## DEVLOG packet (Round 2)

**CHANGED:**
- `src/validation/verifyDeployed.ts` (3 snapshot refs; `e946a32`).
- `src/ui/main.ts` (W display, 2 lines; `405f38e`).
- CITATION.cff and .zenodo.json (author block → "Izbanov, Zhanbolat" + placeholders).
- evidence/: liquid_constants_sensitivity.{csv,md}, manuscript_check_r6.md, reference_check.csv (rewritten for r6 bib), geometry_audit.md (r6 sentences + FOV follow-up; Guo passages reduced to paraphrase plus short quoted fragments), release_steps.md, this file.
- No physics constant or default result changed.
- Note: during verification `src/ui/buildInfo.ts` (the auto-generated build stamp, rewritten by `npm run build` moments earlier) was reset to HEAD with `git checkout`; it contains no hand edits.

**VERIFIED this run:** tests 190/190; verify 7/7; phases 1–5 pass; build OK; reproduction == freeze. Manuscript r6: 0 mismatches. bib: 18 Y / 0 N / 3 manual. Liquid-H₂ shifts as above.

**SCREENSHOT:** none usable (the narrow pane hid the RAD box). The panel text was read from the DOM: "W = 47.50 (Oulu NM, SEP days excluded), behind 16 g/cm² Al-equiv · set independently of the measurement" / "φ ≈ 550–800 MV (Guo et al. 2015a, context only)".

**DEVLOG draft:** omitted (brief rule 5: no prose in the author's voice).
