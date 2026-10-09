# NIST ASTAR raw exports (helium ions)

Byte-exact HTML responses from NIST Standard Reference Database 124 (ESTAR/PSTAR/ASTAR),
doi:10.18434/T4NC7P, ASTAR program.

- **Retrieved:** 2026-10-09T17:51:06Z (UTC)
- **Request:** HTTP POST to `https://physics.nist.gov/cgi-bin/Star/ap_table.pl` with form fields
  `prog=ASTAR`, `matno=<NIST material number>`, `GraphType=None`,
  `Energies=4␤8␤20␤40␤80␤200␤400␤1000` (newline-separated; MeV total alpha kinetic energy).
  Form page: https://physics.nist.gov/PhysRefData/Star/Text/ASTAR.html
- **Energy grid:** T = 4, 8, 20, 40, 80, 200, 400, 1000 MeV total, i.e. 1, 2, 5, 10, 20, 50, 100,
  250 MeV/n (E/n = T/4).
- **Columns in each table:** kinetic energy; electronic, nuclear and total stopping power
  [MeV·cm²/g]; CSDA range and projected range [g/cm²]; detour factor.

| file | NIST matno | NIST material name (as returned) | SHA-256 |
|---|---|---|---|
| `astar_013_aluminum.html` | 013 | ALUMINUM | `5b5c6c91801763f2283aead655042dd279487a41d2144372ff8dd5f35ffbc693` |
| `astar_276_water.html` | 276 | WATER, LIQUID | `0522f09bf08e069ca02b028c468cc59eac0d86a8437c7075755f884593f9ad4b` |
| `astar_221_polyethylene.html` | 221 | POLYETHYLENE | `3758cef064432ed19878f91353ce42255e730efa19f5f035c1c86ef1aaf68774` |
| `astar_001_hydrogen.html` | 001 | HYDROGEN (NIST gaseous-hydrogen entry) | `896025091d03c47ec780c877b56b8794c9ac306fcf45c5288499d284b6d5bf9f` |
| `astar_197_methane.html` | 197 | METHANE | `f60645e17149325f28402a493870223fbc909b91692de519a138762cea43cf42` |

Verify: `sha256sum data/nist/astar/*.html`. These files are marked `-text` in `.gitattributes`
so line-ending conversion cannot change them.

**Relation to `data/astar/helium.ts`:** that file is the hand transcription (retrieved
2026-10-01) used by `scripts/reproduce_paper1.ts`. All 40 rows × 5 columns (T, electronic,
nuclear, total, CSDA range) in it are identical to these raw exports (checked 2026-10-09).
Validation data only — no dose calculation reads either file.
