# ASTAR (helium) provenance and re-derivation

Date: 2026-10-09. Tree: `0130722` (code) plus the raw exports added in `data/nist/astar/`.

## Where the data live

- Transcribed table used by the code: `data/astar/helium.ts`. Its header states it was retrieved 2026-10-01 by POST to `https://physics.nist.gov/cgi-bin/Star/ap_table.pl`. Before today there was **no raw NIST export and no checksum** in the repo.
- Raw exports retrieved today: `data/nist/astar/*.html`, byte-exact, with SHA-256, URL, form fields, timestamp 2026-10-09T17:51:06Z and grid, documented in `data/nist/astar/README.md`.
- Transcription check: all 40 rows (5 materials × 8 energies) of `helium.ts` equal the raw exports in T, electronic, nuclear, total and CSDA range. **0 mismatches.**

## Recomputed deviations (model `ionStopping(E/n, Z = 2, A = 4)` vs ASTAR electronic stopping)

| quantity | recomputed from the raw exports | manuscript (per brief) | match |
|---|---|---|---|
| max \|dev\| at E/n ≥ 10 MeV/n | **1.437%**, aluminium at 10 MeV/n (+1.437%) | 1.437% Al at 10 MeV/n | yes |
| max \|dev\| over the whole grid | **4.517%**, hydrogen at 1 MeV/n (−4.517%, model below ASTAR) | 4.517% H at 1 MeV/n | yes (the sign is negative) |

Per material, max \|dev\| at ≥ 10 MeV/n, all at 10 MeV/n: Al 1.437%, water 0.673%, PE 0.464%, H 0.115%, CH₄ 0.378%. These are identical to `paper1_results.json` → `astarHelium.perMaterial_ge10MeVn`.

Note: ASTAR "HYDROGEN" (matno 001) is NIST's gaseous-hydrogen entry. As with PSTAR, this validates the gas-phase constants, not a liquid-H₂ shield (see `evidence/high_energy_exposure.md`, finding F-δ).

## What the He check does and does not test (z_eff from the code's own `effectiveCharge`, via `ionStopping`)

**z_eff (code):** He at 1 / 10 / 100 MeV/n = 1.9478 / 2.0000 / 2.0000 (z_eff/Z = 0.974 / 1.000 / 1.000). Fe at 10 / 100 / 1000 MeV/n = 22.720 / 25.943 / 26.000 (z_eff/Z = 0.874 / 0.998 / 1.000).

So at E/n ≥ 10 MeV/n the He comparison tests the Bethe stopping kernel with Z² = 4 at the alpha's velocity, i.e. the proton kernel plus mass/velocity scaling. It does **not** test the effective-charge model, which differs from Z only below about 10 MeV/n for He and about 100 MeV/n for Fe. Only the He points below 10 MeV/n can touch z_eff (at 1 MeV/n it is 2.6% below Z; 2 and 5 MeV/n were not evaluated), and the heavy-ion z_eff regime (Fe: −12.6% at 10 MeV/n) has no reference table in this repo.
