# High-energy exposure of the dose integral (δ ≡ 0 for liquid H₂ and CH₄)

Measured 2026-10-09 on tree `0130722`. Read-only: no code or result changed.
Data: `evidence/high_energy_exposure.csv`. Columns are the cumulative fractions of D and H from particles with incident E/n ≤ the bin edge (and, for comparison, with residual E/n ≤ the edge). Rows cover 20 g/cm² of each of the five shields, at the RAD headline W = 47.4953 and at W = 0, primaries only.

Method: the quadrature of `src/dose/shieldedDose.ts` (same nodes, Simpson weights and exported physics functions, 100 nodes/decade) is re-evaluated node by node and binned by E_in. Closure: the node sums equal `computeShieldedDose` to ≤ 8e-15 relative for all 10 cases. Script: session scratchpad `exposure.mts`, not committed.

## 5-line summary

1. PSTAR validation stops at 1000 MeV, but at W = 47.50 behind 20 g/cm² the share of dose from **incident E/n > 1000 MeV** is: D 48–57% and H 52–74% across the five shields (Al 47.8 / 51.5%, water 49.6 / 56.6%, PE 50.4 / 58.1%, CH₄ 51.6 / 61.5%, **liquid H₂ 57.0 / 73.7%**). At W = 0 it is lower: D 40–49%, H 46–69%.
2. Over half the headline dose therefore comes from energies where stopping power has **no direct PSTAR check** in this repo. That applies to all five materials, not only H₂/CH₄.
3. For H₂ the high-energy tail beyond the density-effect onset is: E_in > 5 GeV/n carries 11.7% of D and 14.7% of H; E_in > 10 GeV/n carries 4.6% of D and 5.8% of H (CSV, W = 47.50).
4. The code's δ ≡ 0 for "liquid H₂" is justified in `src/physics/materials.ts:123–126` by the **gas** plasma energy (onset βγ ≳ 80). The PDG **liquid-hydrogen** parameters (retrieved, below) put the onset at x₀ = 0.44 (βγ ≈ 2.75, ≈ 1.8 GeV/n). Omitting δ then overstates liquid-H₂ stopping by 0.09% at 2 GeV/n, 2.9% at 5 GeV/n, 6.3% at 10 GeV/n and 16% at 100 GeV/n.
5. Not computed (it would need a code change): the dose impact. Above 5 GeV/n a particle loses only a small fraction of its energy in 20 g/cm², so a few-% stopping error there should shift the dose much less than 1%. That is an argument, not a measurement.

## Finding (for the author; no correction applied)

**F-δ.** The shield called "liquid hydrogen" (density 0.0708 g/cm³) uses gas-phase constants: **I = 19.2 eV and δ ≡ 0** (`src/physics/materials.ts:122–126`). PDG lists liquid H₂ at **I = 21.8 eV** with a non-zero density effect above βγ ≈ 2.75.
- The I difference alone lowers stopping power by about 1.1% at 1 GeV/n and about 0.7% at 100 GeV/n, which is larger than the δ effect below about 4 GeV/n.
- The PSTAR check for hydrogen (matno 001) is against **gaseous** hydrogen, so its 0.11–0.14% agreement validates the gas constants, not a liquid shield.
- Both are labeling and constant-choice questions. Changing them would alter the H₂ results in `paper1_results.json`, so per the brief nothing was changed.
- Options for the author: (a) state that H₂ is modeled with gas-phase stopping constants (I = 19.2 eV, δ = 0), or (b) adopt the PDG liquid-H₂ constants as a deliberate, separately reported change.

Primary-source parameters (as needed for option b):

| material | source (retrieved 2026-10-09) | a | k | x₀ | x₁ | I [eV] | C̄ | δ₀ | density |
|---|---|---|---|---|---|---|---|---|---|
| liquid H₂ | https://pdg.lbl.gov/2020/AtomicNuclearProperties/MUE/muE_liquid_hydrogen.txt (PDG index 85) | 0.1348 | 5.6249 | 0.4400 | 1.8856 | 21.8 | 3.0977 | 0.00 | 7.080e-2 |
| H₂ gas (what is validated) | https://pdg.lbl.gov/2024/AtomicNuclearProperties/MUE/muE_hydrogen_gas.txt (index 1) | 0.1409 | 5.7273 | 1.8639 | 3.2718 | 19.2 | 9.5834 | 0.00 | 8.376e-5 |
| CH₄ gas | https://pdg.lbl.gov/2024/AtomicNuclearProperties/MUE/muE_methane.txt (index 197) | 0.0925 | 3.6257 | 1.6263 | 3.9716 | 41.7 | 9.5243 | 0.00 | 6.672e-4 |
| **liquid CH₄** | not found at pdg.lbl.gov (`muE_liquid_methane.txt` → 404 for 2017/2020/2023/2024) | NOT RETRIEVED | | | | | | | |

Also checked: https://pdg.lbl.gov/2017/AtomicNuclearProperties/HTML/liquid_hydrogen.html gives density 0.07080 g/cm³, I = 21.8 eV and plasma energy 7.64 eV, consistent with the table above. The model's methane (density 0.4226, liquid) likewise uses gas-phase δ ≡ 0; a liquid-methane Sternheimer set was not retrieved.

The δ values in item 4 come from the PDG formula (δ = 2 ln10·x − C̄ + a(x₁ − x)^k for x₀ ≤ x < x₁) with the liquid-H₂ row above. They are expressed as −(δ/2) relative to the Bethe bracket at I = 21.8 eV, evaluated in a scratch calculation and not committed.
