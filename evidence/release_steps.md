# Release steps — paper1-v1.0.0 (HUMAN-ONLY; nothing here has been executed)

## 0. Blockers to clear before tagging

1. **CI will be red on push.** `npm run verify:deployed` (run by `.github/workflows/ci.yml:57`) fails 3 of 7 checks. Its reference values are hardcoded W = 30-era numbers: `src/validation/verifyDeployed.ts:45` (H 1.47), `:46` (⟨Q⟩ 4.78), `:48` (⟨Q⟩ frag 4.41). The current tree computes 1.318 / 4.995 / 4.598, and the regenerated report says the same. This is a check, so it was **not edited** (brief rule 6). The author decides whether to update the references to the regenerated report values (and say so in the commit), or to release with CI red.
2. **Authors.** CITATION.cff and .zenodo.json still carry the old author block, marked "PENDING AUTHOR CONFIRMATION". Supply the final names, affiliation and ORCID, and update both files identically.
3. **.zenodo.json preprint placeholder.** The `related_identifiers[1].identifier` value `PLACEHOLDER-PREPRINT-DOI-REPLACE-OR-DELETE-BEFORE-RELEASE` is not a valid DOI. Replace it with the preprint DOI, or delete that entry before creating the release; otherwise Zenodo will reject or mis-file the metadata.
4. **Manuscript number check not run** (manuscript path not provided):
   `python scripts/check_manuscript_numbers.py <MANUSCRIPT.md> paper1_results.json evidence/manuscript_check.md`, which must report 0 not OK.
5. Optional (UI): after deploy, the validation panel will print `W≈47.49528000000009` after `φ≈550–800 MV → Matthiä`, at `src/ui/main.ts:979`. See CODE_GATE.md.

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
