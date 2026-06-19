# DOSEFIELD — live-UI integrity check (Step 3)

Method: drove the **actual rendered DOM** of the running Vite app (the local dev build,
confirmed byte-identical to the deployed GitHub Pages bundle in Step 4 — same asset hashes
`dose.worker-DdYpzk07.js` / `index-CDuGWzG-.js` / `index-DrNQOxmn.css`). Values below are read
from the on-screen elements, not from the source.

## Toggle behaviour — solar min, Aluminium, 16 g/cm²

| on-screen readout | Primaries only | + Fragmentation | check |
|---|---|---|---|
| Dose-equivalent [mSv/day] | 1.70 | 1.32 | — |
| Absorbed dose [mGy/day] | 0.381 | 0.319 | (gap preserved, not touched) |
| **Mean ⟨Q⟩** | **4.47** | **4.14** | ✅ fragmentation LOWERS ⟨Q⟩ |
| footnote | "primaries only (no nuclear fragmentation)" | "Bradt–Peters … no secondary neutrons, not HZETRN" | ✅ routes, not just a label |

## Curve ordering — solar min, 20 g/cm² (on-screen dose-equivalent)

| | Aluminium | Polyethylene | poly < Al |
|---|---|---|---|
| Primaries | 1.58 | 1.39 | ✅ |
| + Fragmentation | 1.16 | 0.77 | ✅ (gap widens) |

→ polyethylene curve is below aluminium in BOTH modes, and the gap widens with fragmentation.

## RUN VALIDATION panel (on-screen) vs report

Clicked the in-app **RUN VALIDATION** button; the panel text contained, verbatim:
- NIST PSTAR: `max err ≥10 MeV 1.55% · all energies 4.03%` ✅
- RAD absorbed dose: `0.308 / 0.458 ± 0.032 / 0.67×` ✅
- RAD dose-equivalent: `1.47 / 1.75 ± 0.3 / 0.84×` ✅
- RAD ⟨Q⟩: `4.78 / 3.82 ± 0.25 / 1.25×` ✅
- Limitations block ("no secondary-neutron / target-fragment transport") shown ✅

All match `report/DOSEFIELD_report.md` to the digit.

## Result: Step 3 PASS
Fragmentation ON lowers ⟨Q⟩ and the polyethylene curve; the on-screen validation numbers equal
the report. The deployed UI behaves consistently with the validated physics core.

> Note on screenshots: the preview tool returns captures inline (shown in the verification
> session), not to disk, so PNGs are not committed here. The numeric record above is the
> persisted artifact; committed PNGs would require Playwright (Step 3 option B).
