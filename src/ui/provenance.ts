/**
 * Provenance footer (shared by the dosimeter page and the Methods page).
 * Every value comes from the generated BUILD_INFO (git + a real vitest run at build time)
 * — nothing here is typed by hand, so the footer cannot silently drift.
 */
import { BUILD_INFO } from './buildInfo.js';

const REPO_URL = 'https://github.com/izbanovj3-prog/DOSEFIELD';

export function renderProvenance(el: HTMLElement | null): void {
  if (!el) return;
  const b = BUILD_INFO;
  el.innerHTML =
    `Live build: commit <a href="${REPO_URL}/commit/${b.commit}" target="_blank" rel="noopener">${b.commit}</a>` +
    ` · ${b.testsPassing}/${b.testsTotal} tests passing · verified ${b.verifiedAt}`;
}
