# Manuscript number check

Manuscript: `C:/Users/User/Downloads/DOSEFIELD_manuscript_draft_r6.md`
Results: `paper1_results.json`

| claim | status | manuscript | results (rounded) | results path | ms line |
|---|---|---|---|---|---|
| PSTAR max |dev| >=10 MeV [%] | OK | 1.554 | 1.554 | `summary.pstarMaxDevPct_ge10MeV` | 11 |
| W headline (SEP-masked) | OK | 47.50 | 47.50 | `summary.W.headline` | 11 |
| W unmasked (Zeitlin window) | OK | 49.50 | 49.50 | `summary.W.headlineUnmasked` | 11 |
| W check (SEP-masked full cruise) | OK | 49.88 | 49.88 | `summary.W.full` | 121 |
| W unmasked full cruise | OK | 51.47 | 51.47 | `summary.W.fullUnmasked` | 121 |
| Oulu mean, masked Zeitlin window [cpm] | NOT FOUND |  | 6357.04 | `summary.W.ouluZeitlinMasked` |  |
| Oulu mean, unmasked Zeitlin window [cpm] | NOT FOUND |  | 6335.48 | `summary.W.ouluZeitlin` |  |
| Oulu mean, masked full cruise [cpm] | NOT FOUND |  | 6331.36 | `summary.W.ouluFullMasked` |  |
| Oulu mean, unmasked full cruise [cpm] | NOT FOUND |  | 6314.30 | `summary.W.ouluFull` |  |
| D headline [mGy/d] (abstract) | OK | 0.264 | 0.264 | `summary.headline.D` | 11 |
| H headline [mSv/d] (abstract) | OK | 1.318 | 1.318 | `summary.headline.H` | 11 |
| ratio D (abstract) | OK | 0.58 | 0.58 | `summary.headline.ratioD` | 11 |
| ratio H (abstract) | OK | 0.75 | 0.75 | `summary.headline.ratioH` | 11 |
| <Q> headline (abstract) | OK | 4.995 | 4.995 | `summary.headline.Q` | 11 |
| D headline §3.2 | OK | 0.264 | 0.264 | `summary.headline.D` | 123 |
| H headline §3.2 | OK | 1.318 | 1.318 | `summary.headline.H` | 123 |
| <Q> headline §3.2 | OK | 4.995 | 4.995 | `summary.headline.Q` | 123 |
| ratio D §3.2 | OK | 0.58 | 0.58 | `summary.headline.ratioD` | 123 |
| ratio H §3.2 | OK | 0.75 | 0.75 | `summary.headline.ratioH` | 123 |
| ratio Q §3.2 | OK | 1.31 | 1.31 | `summary.headline.ratioQ` | 123 |
| ratio D vs Zeitlin original | OK | 0.55 | 0.55 | `summary.headline.ratioD_zeitlin` | 123 |
| ratio H vs Zeitlin original | OK | 0.72 | 0.72 | `summary.headline.ratioH_zeitlin` | 123 |
| bracket D low | OK | 0.251 | 0.251 | `summary.headline.D_lo` | 123 |
| bracket D high | OK | 0.277 | 0.277 | `summary.headline.D_hi` | 123 |
| bracket H low | OK | 1.214 | 1.214 | `summary.headline.H_lo` | 123 |
| bracket H high | OK | 1.477 | 1.477 | `summary.headline.H_hi` | 123 |
| uncertainty total [%] | OK | 20.5 | 20.5 | `summary.uncertainty.total` | 125 |
| uncertainty eps_H | OK | 0.20455 | 0.20455 | `summary.uncertainty.total` | 125 |
| H ± abs [mSv/d] | OK | 0.270 | 0.270 | `summary.uncertainty.H_abs` | 125 |
| H band upper | OK | 1.587 | 1.587 | `summary.uncertainty.H_band.1` | 131 |
| D band low | OK | 0.210 | 0.210 | `summary.uncertainty.D_band.0` | 131 |
| D band high | OK | 0.318 | 0.318 | `summary.uncertainty.D_band.1` | 131 |
| frag D | OK | 0.221 | 0.221 | `summary.frag.D` | 133 |
| frag H | OK | 1.017 | 1.017 | `summary.frag.H` | 133 |
| frag Q | OK | 4.598 | 4.598 | `summary.frag.Q` | 133 |
| frag ratio D | OK | 0.48 | 0.48 | `summary.frag.ratioD` | 133 |
| frag ratio H | OK | 0.58 | 0.58 | `summary.frag.ratioH` | 133 |
| frag ratio Q | OK | 1.20 | 1.20 | `summary.frag.ratioQ` | 133 |
| three-bin (54) prim D | OK | 0.272 | 0.272 | `threeBin.0.D` | 135 |
| three-bin (54) prim H | OK | 1.456 | 1.456 | `threeBin.0.H` | 135 |
| three-bin (54) prim Q | OK | 5.342 | 5.342 | `threeBin.0.Q` | 135 |
| three-bin (54) ratio D | OK | 0.59 | 0.59 | `threeBin.0.ratioD` | 135 |
| three-bin (54) ratio H | OK | 0.83 | 0.83 | `threeBin.0.ratioH` | 135 |
| three-bin heavy=20 ratio H | NOT FOUND |  | 0.88 | `threeBin.2.ratioH` |  |
| three-bin heavy=80 ratio H | NOT FOUND |  | 0.81 | `threeBin.4.ratioH` |  |
| D deficit [mGy/d] | OK | 0.194 | 0.194 | `summary.headline.deficitD_mGy` | 159 |
| D under-prediction [%] (§4.1) | OK | 42 | 42 | `summary.headline.deficitD_pct` | 147 |
| <Q> over-prediction [%] (§4.1) | OK | 31 | 31 | `summary.headline.excessQ_pct` | 147 |
| H under-prediction [%] (conclusion) | OK | 25 | 25 | `summary.headline.deficitH_pct` | 203 |
| D under-prediction [%] (conclusion) | OK | 42 | 42 | `summary.headline.deficitD_pct` | 203 |
| Köhler 3.8 as % of 481 | OK | 0.8 | 0.8 | `summary.neutron_Kohler2015.frac_of_481_pct` | 161 |
| Köhler 3.8 as % of 458 | OK | 0.8 | 0.8 | `summary.neutron_Kohler2015.frac_of_458_pct` | 161 |
| Köhler 6 as % of 481 | OK | 1.2 | 1.2 | `summary.neutron_Kohler2015.extrap_frac_of_481_pct` | 161 |
| Köhler 6 as % of 458 | OK | 1.3 | 1.3 | `summary.neutron_Kohler2015.extrap_frac_of_458_pct` | 161 |
| Köhler 3.8 as % of deficit | OK | 2.0 | 2.0 | `summary.neutron_Kohler2015.frac_of_deficit_pct` | 161 |
| species share Z9-28 [%] | OK | 75.68 | 75.68 | `speciesShares_W0_pct.Z9_28` | 131 |
| species share Li-O [%] | NOT FOUND |  | 14.37 | `speciesShares_W0_pct.LiO` |  |
| species share C-O [%] | NOT FOUND |  | 13.94 | `speciesShares_W0_pct.CO` |  |
| species share Li-B [%] | NOT FOUND |  | 0.43 | `speciesShares_W0_pct.LiB` |  |
| legacy W=30 ratio D | OK | 0.67 | 0.67 | `radLegacy.prim.D` | 153 |
| legacy W=30 ratio H | OK | 0.84 | 0.84 | `radLegacy.prim.H` | 153 |
| Mars preset H [mSv/d] | OK | 1.171 | 1.171 | `presets.mars.H` | 183 |
| Mars preset D [mGy/d] | OK | 0.303 | 0.303 | `presets.mars.D` | 183 |
| Mars preset 360-d H [mSv] | OK | 421.7 | 421.7 | `presets.mars.H_total_mSv` | 183 |
| Mars preset 360-d D [mGy] | OK | 109.0 | 109.0 | `presets.mars.D_total_mGy` | 183 |
| Gateway H [mSv/d] | OK | 0.698 | 0.698 | `presets.gateway.H` | 183 |
| Artemis H [mSv/d] | OK | 1.987 | 1.987 | `presets.artemis.H` | 183 |

67 claims checked; 9 not OK.

## Notes (2026-10-09)

- Manuscript checked: `C:\Users\User\Downloads\DOSEFIELD_manuscript_draft_r6.md`, SHA-256 prefix `6223ecc904a7eac4992b`, identical to the Claude Science artifact `v5841cb40_DOSEFIELD_manuscript_draft_r6.md`. Results: `paper1_results.json` regenerated at `0130722`. Checker: `scripts/check_manuscript_numbers.py`, byte-identical to the Claude Science copy `v469507ce`.
- **Value mismatches: 0.** 58 of 67 claims are OK.
- **The 9 NOT FOUND rows are not mismatches.** The four Oulu means (6357.04 / 6335.48 / 6331.36 / 6314.30 counts/min), the heavy-bin 20/80 H ratios (0.88 / 0.81) and the three species shares (Li–O 14.37%, C–O 13.94%, Li–B 0.43%) are simply absent from r6. A plain search for each number finds no occurrence. The one "0.81" hit (line 151) is a different quantity, checked below. These checker entries are stale for r6.
- Unchecked by the script but verified by hand: line 151, "W = 35.49–71.94 … H ratio at 16 g cm⁻² spans 0.63–0.81". `bracketSens` gives 0.631 at W 71.94 and 0.814 at W 35.49, so it matches. Same line, "three-bin … changes it by 0.06–0.13": the three-bin primaries H ratios are 0.832 / 0.879 / 0.813 vs the headline 0.753, i.e. +0.079 / +0.126 / +0.060, so it matches.
