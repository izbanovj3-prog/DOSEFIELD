# Judge prep — hard questions, honest answers

Internal preparation document (in the repo, deliberately not linked from the site UI).
Every number below is either computed by this repo's code (reproducible via the commands in
README §Run it) or carries a citation. If a claim here ever drifts from what the code
computes, the code wins — rerun it.

---

**Q: Your absorbed dose is 0.67× of what NASA measured. Why doesn't that disqualify the model?**

Because the gap is *the finding*, not a defect I failed to fix. The model transports GCR
primaries (plus simplified projectile fragmentation) and deliberately omits the secondary
particles produced inside the spacecraft shell. The measured gap tells you the size of that
omission: 0.31 vs 0.46 mGy/day. Its structure confirms the explanation — the dose-equivalent
gap is *smaller* (1.47 vs 1.75 mSv/day, 0.84×) because the model *over*-predicts ⟨Q⟩ (4.78 vs
3.82) for the same physical reason (no fragmentation softening), and the two errors partially
cancel in H = ⟨Q⟩·D. A tuned model would not have that coherent structure; it would just match.
For context: at the 2016 NASA MSL/RAD modeling workshop, seven full 3-D transport codes
(GEANT4, PHITS, HZETRN, FLUKA, MCNP6, …) were compared against RAD surface data, and
"differences of factors of two are not uncommon" (Hassler & Norbury 2017, LSSR 14:1–2). A 1-D
primary-particle model at 0.84× on dose-equivalent is exactly where it should be.

**Q: How do I know you didn't tune anything to the RAD measurement?**

Three structural defenses, all checkable in the repo history:
1. Every physical constant traces to a citation that predates the comparison (CODATA,
   ICRU/NIST, ICRP-60, Matthiä 2013 coefficients transcribed verbatim from the reference
   implementation). The cruise modulation W≈30 was set from the OULU neutron-monitor relation
   and Guo 2015's φ range — not adjusted to fit.
2. The CI pipeline reruns the *entire* validation (NIST stopping power, shielding trend,
   RAD comparison) on every push; the validation panel on the site, the generated report, and
   the deployed-build check all read one function (`computeValidationSummary`) — there is no
   second copy of any number to quietly edit.
3. The git history contains three *rejected* "improvements" that would have closed gaps
   dishonestly (ICRP-60 wT as organ-dose multipliers; a force-field φ(MV) reparametrization
   requiring endpoint tuning; a parametric "neutron correction" table whose factors were
   reverse-engineered to land on the RAD number and whose material ordering was physically
   inverted). Each rejection is documented in the commit history with the physics reason.

**Q: Norbury et al. 2018 says your GCR model differs from AMS-02 by up to 14%. Why trust the dose?**

That 14% is exactly what the uncertainty band on the site propagates — it IS the input error
budget, not a hidden flaw (hydrogen, <1.5 GeV/n, the range carrying ~50% of dose behind
20 g/cm² Al; helium is ≤2.8% everywhere in the same comparison). Propagated in quadrature with
the ICRU-49 stopping-power accuracy, the dose-equivalent carries ±14.6%. The honest caveat I
state myself: AMS constrained H and He only; I *assume* Z≥3 spectra carry comparable error.
The measured 1.75 mSv/day sits inside my W/shielding bracket (1.25–1.78) — consistent with an
input-limited, untuned model.

**Q: Why a 1-D deterministic model instead of Monte Carlo?**

Scope, on purpose. The research question is: *how much of the deep-space dose problem is
explained by primary slowing-down alone, and how much genuinely requires secondary transport?*
A 1-D CSDA model answers that cleanly and transparently — every equation fits in METHODS.md
and a judge can verify a number by hand. The remaining 0.33× of absorbed dose is the measured
answer to "how much requires more". Reimplementing HZETRN badly would answer neither question.

**Q: You omit shell, Barkas and Bloch corrections. How is Bethe-Bloch valid?**

Quantified, not assumed: against NIST PSTAR the implementation stays within 1.55% above
10 MeV (integration floor) and 4.03% down to 1 MeV — the omitted corrections are exactly why
the error grows at low energy, and the report says so. The same test rejected high-Z shield
materials during selection (lead and titanium failed by a wide margin) — that's why the
material list is low-Z only. Careful with the exact figure: no Pb/Ti dataset ships in
`data/pstar/`, so those percentages cannot be recomputed from this repository. Say "failed by
a wide margin"; if a judge presses for the number, say it needs the PSTAR tables pasted in and
the check rerun.

**Q: Why ICRP-60 Q(L) instead of ICRP-103?**

To compare like with like: MSL/RAD reports dose-equivalent via LET-based Q, and ⟨Q⟩ = 3.82 ±
0.25 (Zeitlin 2013) is a Q(L) number. Using ICRP-103 radiation weighting would make the
headline comparison apples-to-oranges. It's a convention choice, stated in the UI.

**Q: The two-layer feature is unvalidated. Why ship it?**

Because it's labeled as exactly that, in the UI, at the point of use. It runs the same CSDA
engine and reduces to the validated single slab at the one-layer limit (tested to 0.05%);
there is simply no NASA layered cruise measurement to validate a stack against. Shipping it
unlabeled would be dishonest; not shipping it would hide a genuinely useful engineering view.

**Q: How can a 1-D model claim organ doses?**

It claims organ *depth-dose estimates*, which is what they are: NASA's own shallow/eye/deep
convention (0.007 / 0.3 / 5 g/cm² water) — the body is one more slab through the same engine.
The panel's footnote states the approximation and points to HZETRN/OLTARIS for real organ
planning. Notably, the physically wrong shortcut (multiplying by ICRP wT) was proposed and
rejected — wT builds effective dose from organ doses, not the other way around.

**Q: What would falsify this model?**

Concrete things, all monitored: stopping power drifting outside the few-percent PSTAR
envelope (CI fails); the material ranking H₂<CH₄<PE<water<Al breaking at any tested areal
density (test #3b fails); dose-equivalent landing outside ~2× of MSL/RAD at the independently
set cruise parameters; the five live self-checks (thick-shield reduction, W-monotonicity,
duration linearity, material ordering, unit consistency) going red. Any of these is a real
falsification, not a tolerance to loosen — the integrity rules forbid widening a test to
hide a failure.

**Q: What is the actual contribution here?**

A fully transparent, CI-gated measurement of how far first-principles primary transport gets
you on deep-space dose: stopping power to ≤1.55% of NIST, dose-equivalent to 0.84× of MSL/RAD
with the discrepancy structure explained and quantified (the missing piece is secondary
charged particles and target fragments; measured neutrons are only ~1–2% — Köhler 2015), an
input-uncertainty budget built from published comparisons, and a validated, monotonic
material-ranking result (hydrogen content decides shielding quality; H₂ beats Al by up to
44.2% at equal mass). Plus a reproducibility standard — every number on the site is computed
in the browser from the same code the tests gate.
