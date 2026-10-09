#!/usr/bin/env python3
"""Diff the numerical claims in the Paper-1 manuscript against paper1_results.json.

    python scripts/check_manuscript_numbers.py MANUSCRIPT.md paper1_results.json [report.md]

Each claim = (label, regex that captures the number as printed in the manuscript, path into the
results file, number of decimals the manuscript prints). The manuscript value is compared with the
results value ROUNDED to the printed precision. Mismatches are REPORTED, never fixed. A claim whose
regex does not match the manuscript is reported as NOT FOUND (the text may have changed).
Exit code 1 if any mismatch or NOT FOUND.
"""
import json, re, sys

def g(d, path):
    for k in path.split('.'):
        d = d[int(k)] if isinstance(d, list) else d[k]
    return d

# label, regex (group 1 = number), results path, decimals, scale
CLAIMS = [
 ("PSTAR max |dev| >=10 MeV [%]", r"within (\d\.\d{3}) % at and above 10 MeV for all five", "summary.pstarMaxDevPct_ge10MeV", 3, 1),
 ("W headline (SEP-masked)", r"giving W = (\d+\.\d\d)\. Behind", "summary.W.headline", 2, 1),
 ("W unmasked (Zeitlin window)", r"Without the SEP mask \(W = (\d+\.\d\d)\)", "summary.W.headlineUnmasked", 2, 1),
 ("W check (SEP-masked full cruise)", r"The full-cruise mean with the same exclusion, W = (\d+\.\d\d)", "summary.W.full", 2, 1),
 ("W unmasked full cruise", r"\(W = 49\.50 and (\d+\.\d\d)\) are reported alongside", "summary.W.fullUnmasked", 2, 1),
 ("Oulu mean, masked Zeitlin window [cpm]", r"- (\d{4}\.\d\d) counts min⁻¹ over the averaging window", "summary.W.ouluZeitlinMasked", 2, 1),
 ("Oulu mean, unmasked Zeitlin window [cpm]", r"- (\d{4}\.\d\d) counts min⁻¹ over the same window without", "summary.W.ouluZeitlin", 2, 1),
 ("Oulu mean, masked full cruise [cpm]", r"- (\d{4}\.\d\d) counts min⁻¹ over the full cruise, 26 November", "summary.W.ouluFullMasked", 2, 1),
 ("Oulu mean, unmasked full cruise [cpm]", r"- (\d{4}\.\d\d) counts min⁻¹ over the full cruise without", "summary.W.ouluFull", 2, 1),
 ("D headline [mGy/d] (abstract)", r"model then predicts (\d\.\d{3}) mGy d⁻¹", "summary.headline.D", 3, 1),
 ("H headline [mSv/d] (abstract)", r"mGy d⁻¹ and (\d\.\d{3}) mSv d⁻¹\. The measured cruise", "summary.headline.H", 3, 1),
 ("ratio D (abstract)", r"ratios are therefore (\d\.\d\d) \(absorbed dose\)", "summary.headline.ratioD", 2, 1),
 ("ratio H (abstract)", r"\(absorbed dose\) and (\d\.\d\d) \(dose equivalent\)", "summary.headline.ratioH", 2, 1),
 ("<Q> headline (abstract)", r"over-predicted \((\d\.\d{3}) versus 3\.82", "summary.headline.Q", 3, 1),
 ("D headline §3.2", r"At W = 47\.50, the primaries-only model gives D = (\d\.\d{3})", "summary.headline.D", 3, 1),
 ("H headline §3.2", r"primaries-only model gives D = 0\.\d{3} mGy d⁻¹, H = (\d\.\d{3})", "summary.headline.H", 3, 1),
 ("<Q> headline §3.2", r"H = 1\.\d{3} mSv d⁻¹ and ⟨Q⟩ = (\d\.\d{3}) \(Fig\. 2a", "summary.headline.Q", 3, 1),
 ("ratio D §3.2", r"are (\d\.\d\d) \(D\), 0\.\d\d \(H\) and 1\.\d\d \(⟨Q⟩\)\. Against", "summary.headline.ratioD", 2, 1),
 ("ratio H §3.2", r"are 0\.\d\d \(D\), (\d\.\d\d) \(H\) and 1\.\d\d \(⟨Q⟩\)\. Against", "summary.headline.ratioH", 2, 1),
 ("ratio Q §3.2", r"are 0\.\d\d \(D\), 0\.\d\d \(H\) and (\d\.\d\d) \(⟨Q⟩\)\. Against", "summary.headline.ratioQ", 2, 1),
 ("ratio D vs Zeitlin original", r"the D and H ratios are (\d\.\d\d) and 0\.\d\d\.", "summary.headline.ratioD_zeitlin", 2, 1),
 ("ratio H vs Zeitlin original", r"the D and H ratios are 0\.\d\d and (\d\.\d\d)\.", "summary.headline.ratioH_zeitlin", 2, 1),
 ("bracket D low", r"the model ranges from (\d\.\d{3}) to 0\.\d{3} mGy d⁻¹", "summary.headline.D_lo", 3, 1),
 ("bracket D high", r"the model ranges from 0\.\d{3} to (\d\.\d{3}) mGy d⁻¹", "summary.headline.D_hi", 3, 1),
 ("bracket H low", r"mGy d⁻¹ and from (\d\.\d{3}) to 1\.\d{3} mSv d⁻¹\. The measured", "summary.headline.H_lo", 3, 1),
 ("bracket H high", r"mGy d⁻¹ and from 1\.\d{3} to (\d\.\d{3}) mSv d⁻¹\. The measured", "summary.headline.H_hi", 3, 1),
 ("uncertainty total [%]", r"input uncertainty of the model dose equivalent is ±(\d+\.\d) % \(ε_H", "summary.uncertainty.total", 1, 100),
 ("uncertainty eps_H", r"ε_H = (0\.\d{5})", "summary.uncertainty.total", 5, 1),
 ("H ± abs [mSv/d]", r"H = 1\.\d{3} ± (0\.\d{3}) mSv d⁻¹", "summary.uncertainty.H_abs", 3, 1),
 ("H band upper", r"upper edge of the model band \((\d\.\d{3}) mSv", "summary.uncertainty.H_band.1", 3, 1),
 ("D band low", r"the model band \((0\.\d{3})–0\.\d{3} mGy", "summary.uncertainty.D_band.0", 3, 1),
 ("D band high", r"the model band \(0\.\d{3}–(0\.\d{3}) mGy", "summary.uncertainty.D_band.1", 3, 1),
 ("frag D", r"In fragmentation mode at W = 47\.50, the model gives D = (\d\.\d{3})", "summary.frag.D", 3, 1),
 ("frag H", r"In fragmentation mode at W = 47\.50, the model gives D = 0\.\d{3} mGy d⁻¹, H = (\d\.\d{3})", "summary.frag.H", 3, 1),
 ("frag Q", r"H = 1\.\d{3} mSv d⁻¹ and ⟨Q⟩ = (\d\.\d{3})\. The ratios become", "summary.frag.Q", 3, 1),
 ("frag ratio D", r"The ratios become (\d\.\d\d) \(D\)", "summary.frag.ratioD", 2, 1),
 ("frag ratio H", r"The ratios become 0\.\d\d \(D\) and (\d\.\d\d) \(H\)", "summary.frag.ratioH", 2, 1),
 ("frag ratio Q", r"toward the measurement \(ratio (\d\.\d\d)\)", "summary.frag.ratioQ", 2, 1),
 ("three-bin (54) prim D", r"primaries-only model gives D = (0\.\d{3}) mGy d⁻¹, H = 1\.\d{3} mSv d⁻¹ and ⟨Q⟩ = 5\.\d{3}; the ratios", "threeBin.0.D", 3, 1),
 ("three-bin (54) prim H", r"primaries-only model gives D = 0\.\d{3} mGy d⁻¹, H = (1\.\d{3}) mSv d⁻¹ and ⟨Q⟩ = 5\.\d{3}; the ratios", "threeBin.0.H", 3, 1),
 ("three-bin (54) prim Q", r"H = 1\.\d{3} mSv d⁻¹ and ⟨Q⟩ = (5\.\d{3}); the ratios", "threeBin.0.Q", 3, 1),
 ("three-bin (54) ratio D", r"⟨Q⟩ = 5\.\d{3}; the ratios are (0\.\d\d) \(D\)", "threeBin.0.ratioD", 2, 1),
 ("three-bin (54) ratio H", r"⟨Q⟩ = 5\.\d{3}; the ratios are 0\.\d\d \(D\), (0\.\d\d) \(H\)", "threeBin.0.ratioH", 2, 1),
 ("three-bin heavy=20 ratio H", r"the H ratio is (0\.\d\d) or 0\.\d\d", "threeBin.2.ratioH", 2, 1),
 ("three-bin heavy=80 ratio H", r"the H ratio is 0\.\d\d or (0\.\d\d)", "threeBin.4.ratioH", 2, 1),
 ("D deficit [mGy/d]", r"The deficit of (0\.\d{3}) mGy d⁻¹ at W = 47\.50", "summary.headline.deficitD_mGy", 3, 1),
 ("D under-prediction [%] (§4.1)", r"under-predicts D by about (\d\d) %", "summary.headline.deficitD_pct", 0, 1),
 ("<Q> over-prediction [%] (§4.1)", r"over-predicts ⟨Q⟩ by about (\d\d) %", "summary.headline.excessQ_pct", 0, 1),
 ("H under-prediction [%] (conclusion)", r"under-predicts the measured dose equivalent by (\d\d) %", "summary.headline.deficitH_pct", 0, 1),
 ("D under-prediction [%] (conclusion)", r"and the absorbed dose by (\d\d) % \(ratio", "summary.headline.deficitD_pct", 0, 1),
 ("Köhler 3.8 as % of 481", r"The directly measured value is ≈(\d\.\d) % of the originally reported", "summary.neutron_Kohler2015.frac_of_481_pct", 1, 1),
 ("Köhler 3.8 as % of 458", r"and also ≈(\d\.\d) % of the re-evaluated", "summary.neutron_Kohler2015.frac_of_458_pct", 1, 1),
 ("Köhler 6 as % of 481", r"the extrapolated full-spectrum value is (\d\.\d) % and", "summary.neutron_Kohler2015.extrap_frac_of_481_pct", 1, 1),
 ("Köhler 6 as % of 458", r"full-spectrum value is \d\.\d % and (\d\.\d) %, respectively", "summary.neutron_Kohler2015.extrap_frac_of_458_pct", 1, 1),
 ("Köhler 3.8 as % of deficit", r"account for about (\d\.\d) % of the absorbed-dose deficit", "summary.neutron_Kohler2015.frac_of_deficit_pct", 1, 1),
 ("species share Z9-28 [%]", r"which carry (\d\d\.\d\d) %", "speciesShares_W0_pct.Z9_28", 2, 1),
 ("species share Li-O [%]", r"These species carry (\d\d\.\d\d) % of the free-space", "speciesShares_W0_pct.LiO", 2, 1),
 ("species share C-O [%]", r"C–O (\d\d\.\d\d) %\)", "speciesShares_W0_pct.CO", 2, 1),
 ("species share Li-B [%]", r"\(Li–B (\d\.\d\d) %", "speciesShares_W0_pct.LiB", 2, 1),
 ("legacy W=30 ratio D", r"At W = 30 the primaries-only ratios would be (\d\.\d\d) \(D\)", "radLegacy.prim.D", 2, 1/0.458),
 ("legacy W=30 ratio H", r"would be 0\.\d\d \(D\) and (\d\.\d\d) \(H\)", "radLegacy.prim.H", 2, 1/1.75),
 ("Mars preset H [mSv/d]", r"Mars Cruise preset, the model gives D = 0\.\d{3} mGy d⁻¹, H = (\d\.\d{3})", "presets.mars.H", 3, 1),
 ("Mars preset D [mGy/d]", r"Mars Cruise preset, the model gives D = (0\.\d{3})", "presets.mars.D", 3, 1),
 ("Mars preset 360-d H [mSv]", r"this is \d+\.\d mGy and (\d+\.\d) mSv", "presets.mars.H_total_mSv", 1, 1),
 ("Mars preset 360-d D [mGy]", r"this is (\d+\.\d) mGy and", "presets.mars.D_total_mGy", 1, 1),
 ("Gateway H [mSv/d]", r"Lunar Gateway preset gives (\d\.\d{3}) mSv", "presets.gateway.H", 3, 1),
 ("Artemis H [mSv/d]", r"Artemis Transit preset gives (\d\.\d{3}) mSv", "presets.artemis.H", 3, 1),
]

def main():
    ms, res = sys.argv[1], sys.argv[2]
    out = sys.argv[3] if len(sys.argv) > 3 else None
    text = open(ms, encoding='utf-8').read(); lines = text.splitlines()
    R = json.load(open(res, encoding='utf-8'))
    rows, bad = [], 0
    for label, rx, path, nd, scale in CLAIMS:
        m = re.search(rx, text)
        try: val = g(R, path) * scale
        except Exception as e: val = None
        if not m:
            rows.append((label, 'NOT FOUND', '', f'{val:.{nd}f}' if val is not None else 'n/a', path, '')); bad += 1; continue
        line = text.count('\n', 0, m.start()) + 1
        ms_v = m.group(1); exp = f'{round(val, nd):.{nd}f}' if val is not None else 'n/a'
        st = 'OK' if exp == ms_v else 'MISMATCH'
        bad += st != 'OK'
        rows.append((label, st, ms_v, exp, path, line))
    md = ['| claim | status | manuscript | results (rounded) | results path | ms line |', '|---|---|---|---|---|---|']
    md += [f'| {a} | {b} | {c} | {d} | `{e}` | {f} |' for a, b, c, d, e, f in rows]
    rep = '\n'.join(md)
    print(rep); print(f'\n{len(rows)} claims, {bad} not OK')
    if out: open(out, 'w', encoding='utf-8').write(f'# Manuscript number check\n\nManuscript: `{ms}`\nResults: `{res}`\n\n{rep}\n\n{len(rows)} claims checked; {bad} not OK.\n')
    sys.exit(1 if bad else 0)

if __name__ == '__main__':
    main()
