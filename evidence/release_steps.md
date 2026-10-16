# Release steps — paper1-v1.0.0 (HUMAN-ONLY; nothing here has been executed)

## 0. Blockers to clear before tagging

1. ~~CI red on push~~ **RESOLVED** in `e946a32`: the `verify:deployed` model-snapshot references were updated to the W = 47.50 values (the measured row was unchanged); it now passes 7/7.
2. **Placeholders in the author metadata.** The sole author "Izbanov, Zhanbolat" is confirmed. Before release, replace the affiliation placeholder in CITATION.cff and both `PLACEHOLDER-AFFILIATION…` / `PLACEHOLDER-ORCID…` values in .zenodo.json, or delete the `orcid` key if there is none. An invalid ORCID string will make the Zenodo metadata fail.
3. **.zenodo.json preprint placeholder.** The `related_identifiers[1].identifier` value `PLACEHOLDER-PREPRINT-DOI-REPLACE-OR-DELETE-BEFORE-RELEASE` is not a valid DOI. Replace it with the preprint DOI, or delete that entry before creating the release.
4. ~~Manuscript number check~~ **DONE on r6**: 0 value mismatches. Nine checker entries are stale (their numbers no longer appear in r6); see `evidence/manuscript_check_r6.md`. Re-run on the final manuscript text.
5. ~~UI W display~~ **RESOLVED** in `405f38e`.
6. Manuscript wording (Claude Science side): "planar shields" / "single planar slab" (r6 lines 9, 179, 203) are WRONG for the implemented shell geometry. Line 119 drops Guo's field-of-view qualifier. The bib NISTSTAR note labels the H₂/CH₄ data as liquid, but they are NIST gas tables. See `geometry_audit.md` and `liquid_constants_sensitivity.md`.

## 1. Tag (draft — do NOT run until §0 is resolved)

Tag the commit that contains the final CITATION.cff / .zenodo.json; at the moment that is the evidence commit on top of `ea8bd00`. Replace `<SHA>` with `git rev-parse HEAD` after the blocker fixes.

```
git tag -a paper1-v1.0.0 <SHA> -m "DOSEFIELD paper1-v1.0.0 — code archived for Paper 1 (Zenodo preprint).

Numbers: scripts/reproduce_paper1.ts regenerates paper1_results.json; numeric freeze at
0130722 (W = 47.50 SEP-masked OULU headline, eps_phi = 0.20). Later commits change no computed
value (verified field-by-field, evidence/freeze.md). Tests 190/190."
```

## 2. Push (HUMAN)

```
git push origin main
git push origin paper1-v1.0.0
```

Pushing `main` also triggers `.github/workflows/deploy.yml`, so the live site moves from `34b35a9` (W ≈ 30, ±14.6%) to the W = 47.50 / ±20.5% build.

## 3. Zenodo (HUMAN)

1. In Zenodo → GitHub, enable the repository `izbanovj3-prog/DOSEFIELD`.
2. On GitHub, create the release from the existing tag `paper1-v1.0.0`. Zenodo archives the tag's content and mints a version DOI plus a concept DOI.
3. Wait for the DOI to appear on the Zenodo record and check its metadata against `.zenodo.json`.

## 4. After the DOI exists (HUMAN)

1. Put the version DOI into `CITATION.cff` (uncomment `doi:` and `date-released:`) and into the manuscript.
2. Commit that on `main`. **Do not move the tag.** The Zenodo archive is the content of `paper1-v1.0.0`, which does not contain its own DOI; the DOI line exists only in the later commit.
3. Push `main`.

---

# Site sync + paper1-v1.0.1 (prepared 2026-10-17; HUMAN-ONLY; nothing here has been executed)

Branch `site-sync`, started from `e38c9fc` (= `paper1-v1.0.0`, which is not moved). It adds text-only commits: `1b4ca48` (UI wording) and `1844850` (METHODS/README limitations wording), plus this evidence commit. Reproduction at `1844850` is identical to `0130722` field by field (provenance excluded). Tests 190/190; phases 1–5, verify:deployed and build pass.

## 1. Publish the site (pushing `main` triggers CI and "Deploy to GitHub Pages" in parallel)

The working copy holds the uncommitted README AI-disclosure draft, so don't switch branches. Push the branch head as `main` (fast-forward only; it is refused if not a fast-forward):

```
git fetch origin
git log --oneline origin/main..site-sync
git push origin site-sync:main
git branch -f main site-sync
```

Then check the live site (https://izbanovj3-prog.github.io/DOSEFIELD/): the footer shows the new commit; the RAD panel shows "W = 47.50 (Oulu NM, SEP days excluded)", 0.58× / 0.75× / 1.31×, ±20.5%; methods.html shows ε_φ = 20%.

## 2. Tag paper1-v1.0.1 (optional; numbers identical to v1.0.0)

```
git tag -a paper1-v1.0.1 site-sync -m "DOSEFIELD v1.0.1 — site and METHODS text synced with Paper 1.

Text-only changes since paper1-v1.0.0 (e38c9fc): wording ('compared with', shell geometry, r0/b
provenance, neutron share computed live). scripts/reproduce_paper1.ts output is identical to
paper1-v1.0.0 / 0130722 (provenance excluded). Tests 190/190."
git push origin paper1-v1.0.1
```

Create the GitHub release from that tag (title e.g. "DOSEFIELD v1.0.1 (Paper 1 code, site text sync)"). As of 2026-10-17 Zenodo shows **no record** for v1.0.0: no search hits for DOSEFIELD, and `zenodo.org/badge/latestdoi/1272094482` returns 404. Check the repository page under zenodo.org → GitHub before relying on v1.0.1 to be archived.
