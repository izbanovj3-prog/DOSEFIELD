"""Re-derive the four Oulu neutron-monitor means used for W (data/gcr/matthia2013.ts) from the
Oulu database (https://cosmicrays.oulu.fi). Data users are expected to acknowledge the Oulu
web site and the Sodankyla Geophysical Observatory (Oulu readme).
Usage: python scripts/check_oulu_db.py [out.csv]"""
import io, sys
import pandas as pd, requests

URL = "https://cosmicrays.oulu.fi/webform/onlinequery.cgi"
PARAMS = dict(station="OULU", startday="26", startmonth="11", startyear="2011", starttime="00:00",
              endday="07", endmonth="08", endyear="2012", endtime="00:00", resolution="5", outputmode="csv")
REPO = {  # data/gcr/matthia2013.ts
    "Zeitlin window, SEP-masked": ("2011-12-06 00:00", "2012-07-14 23:55", True, 6357.04),
    "Zeitlin window, unmasked": ("2011-12-06 00:00", "2012-07-14 23:55", False, 6335.48),
    "full cruise, SEP-masked": ("2011-11-26 00:00", "2012-08-06 23:55", True, 6331.36),
    "full cruise, unmasked": ("2011-11-26 00:00", "2012-08-06 23:55", False, 6314.30),
}
SEP_DAYS = [("2012-01-23", "2012-01-29"), ("2012-03-07", "2012-03-15"), ("2012-05-17", "2012-05-17")]

def main(out):
    txt = requests.get(URL, params=PARAMS, timeout=300).text
    d = pd.read_csv(io.StringIO(txt)); d["t"] = pd.to_datetime(d.Timestamp, utc=True)
    col = "CorrectedCountRate[cts/min]"; rows = []
    for name, (a, b, mask, ref) in REPO.items():
        s = d[(d.t >= pd.Timestamp(a, tz="UTC")) & (d.t <= pd.Timestamp(b, tz="UTC"))]
        if mask:
            day = s.t.dt.strftime("%Y-%m-%d")
            s = s[~pd.concat([day.between(x, y) for x, y in SEP_DAYS], axis=1).any(axis=1)]
        v = s[col][s[col] > 0]
        rows.append(dict(window=name, samples=len(v), mean_cpm=v.mean(), repo_cpm=ref, diff_cpm=v.mean() - ref,
                         W_db=-0.093 * v.mean() + 638.7, W_repo=-0.093 * ref + 638.7))
    r = pd.DataFrame(rows); r.to_csv(out, index=False); print(r.to_string())
    return 0 if (r.diff_cpm.abs() < 0.005).all() else 1

if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "oulu_db_check.csv"))
