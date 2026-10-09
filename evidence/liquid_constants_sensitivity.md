# Liquid-H₂ / liquid-CH₄ constants: side calculation (defaults unchanged)

Date: 2026-10-09. Code: tree `0130722`-equivalent physics (no physics commit since). Data: `evidence/liquid_constants_sensitivity.csv`.

## 5-line summary

1. Swapping the hydrogen shield's constants to PDG **liquid** H₂ (I 19.2 → 21.8 eV, δ ≡ 0 → Sternheimer x₀ 0.44) **raises** the H₂ dose at W = 0, because lower stopping power in the shield means less energy is lost. Primaries-only: H +0.44% (5 g/cm²) to +0.89% (40 g/cm²), D +0.22% to +0.47%. Fragmentation: H +0.46% to +1.01%, D +0.21% to +0.59%.
2. At 20 g/cm² the H₂ shift is +0.73% H / +0.37% D (primaries) and +0.78% H / +0.41% D (fragmentation). All shifts are positive and grow monotonically with thickness.
3. The strict ordering H₂ < CH₄ < PE < water < Al holds at every thickness from 5 to 40 g/cm² in both modes with the liquid-H₂ constants, so the §5.1 ranking claim is unaffected.
4. The Mars-cruise preset (Al 10 + PE 5, W = 0) contains no H₂ or CH₄. Its shift is exactly 0 in both modes.
5. **Liquid CH₄: NOT RETRIEVED.** PDG lists only gaseous methane, and NIST STAR has no liquid entry. Methane therefore stays at its current (gas) constants in both variants, and its shift is 0 by construction, not by measurement.

Baseline check: the "current" variant equals `paper1_results.json` (`sweep`, `presets.mars`) exactly (max relative difference 0). Method: hydrogen's `I_eV` and `densityEffect` were patched **in memory** in a separate Node process before any range table was built. No repo file was modified (scratch script `liquid.mts`, not committed).

## Constants used (C1)

| material | source (retrieved 2026-10-09T18:12Z) | I [eV] | a | m (k) | x₀ | x₁ | C̄ | δ₀ | density [g/cm³] |
|---|---|---|---|---|---|---|---|---|---|
| liquid H₂, PDG | https://pdg.lbl.gov/2024/AtomicNuclearProperties/MUE/muE_hydrogen_liquid.txt (index 85, "hydrogen liquid"); landing page https://pdg.lbl.gov/2024/AtomicNuclearProperties/HTML/hydrogen_liquid.html | 21.8 | 0.1348 | 5.6249 | 0.4400 | 1.8856 | 3.0977 | 0.00 | 7.080e-2 |
| liquid CH₄, PDG | not listed: the PDG 2024 index (https://pdg.lbl.gov/2024/AtomicNuclearProperties/index.html) has only "Methane (CH₄)", which is gas, density 6.672e-4 (`muE_methane.txt`) | NOT RETRIEVED | | | | | | | |
| H₂, current repo | `src/physics/materials.ts:117–126` | 19.2 | δ ≡ 0 (x₀ = x₁ = 99 sentinel) | | | | | | 0.0708 |

PDG prints `a` to 4 decimals in the `.txt` table; the PDF version may carry more. The PDG 2024 values are identical to the 2020 file used in Round 1.

## Which NIST entries the hydrogen and methane comparisons used (C3)

| comparison | repo file | NIST entry (as returned by NIST) | NIST density / I | phase |
|---|---|---|---|---|
| PSTAR hydrogen | `data/pstar/hydrogen.ts` (matno 001) | "HYDROGEN" | 8.37480E-05 g/cm³ / 19.2 eV | **gas** |
| ASTAR hydrogen | `data/nist/astar/astar_001_hydrogen.html` | "HYDROGEN" (matno 001) | same | **gas** |
| PSTAR methane | `data/pstar/methane.ts` (matno recorded as `CH4`; the number was not in the export) | "METHANE" (per file header) | n/a in file | **gas**: NIST's only methane entry |
| ASTAR methane | `data/nist/astar/astar_197_methane.html` | "METHANE" (matno 197) | 6.67151E-04 g/cm³ / 41.7 eV | **gas** |

Sources: NIST composition pages https://physics.nist.gov/cgi-bin/Star/compos.pl?ap001 and `?ap197` (retrieved 2026-10-09T18:13:58Z). The NIST ASTAR/PSTAR material lists contain no liquid hydrogen or liquid methane entry ("Hydrogen", "Methane", "Tissue-Equivalent GAS (Methane based)" only).

**Consequence:** every H₂ and CH₄ stopping-power check in the repo validates gas-phase data. The `references.bib` NISTSTAR note "Data retrieved … 2026-06-27 (LH2, LCH4)" labels these as liquid. That label is wrong: NIST has no liquid entries, and the data are the gas tables.
