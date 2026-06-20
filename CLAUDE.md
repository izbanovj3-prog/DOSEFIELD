## Verified current state (reconciled 2026-06-20, HEAD `98346fa` on main)

**6a–6e: ALL DONE and committed.** The old "#1 gap = 6a" is OBSOLETE — deleted.
- **Fragmentation: live.** Toggle wired `worker:32` ↔ `main:278–285`; worker calls `computeFragmentedDose`. Curves diverge, ⟨Q⟩ drops on toggle.
- **Validation panel: in-app, values COMPUTED live (not hardcoded)** — integrity bar met. NOTE: the panel is sourced from the worker's **inline `runValidation()`** (`dose.worker.ts:67/123`), **not yet** from `computeValidationSummary` (see PARTIALLY DONE).
- **CI** (typecheck + tests + validate) and **GitHub Pages deploy** committed. Site live: https://izbanovj3-prog.github.io/DOSEFIELD/
- **main verified GREEN this session:** typecheck clean, 76/76 vitest pass, build clean. `npm run report` re-run → **byte-identical output** (zero git diff).

**PARTIALLY DONE — validation single-source** (one code path for `npm run report` + the in-app panel, via `validationSummary.ts`):
- **REPORT half: LANDED on main** as `98346fa` — `validationSummary.ts` + `generateReport.ts`, two multi-layer-independent files; verified green; report output byte-identical → behavior-preserving.
- **PANEL half: PENDING.** Wiring `dose.worker.ts` + `main.ts` (`renderValidation`/`renderStrip`, shape `ValidationData`→`ValidationSummary`) is entangled with the parked WIP on `wip/multilayer`. Do NOT extract surgically — redo cleanly as a scoped phase off green main if pursued.

**PARKED (out of scope): multi-layer shield stack** on `wip/multilayer` @ `7536e88`. Incomplete beyond type errors — `main.ts` references `$('presetSelect')` but the WIP `index.html` never adds that element → runtime null even once types pass. Do NOT finish or fix in place. Revisit only as a scoped, tested phase, or drop.

**GOTCHA (bank this):** `tsconfig` includes `["src","data","test"]`, so `tsc` walks ALL of `src/` incl. untracked files. `npm test` and `npm run build` do NOT run tsc — only `npm run typecheck` catches type breakage. Plain `git stash` won't restore green; use `git stash -u` or a branch.
