/**
 * Single source of truth for the human-facing release label in the page headers.
 * Previously each page hardcoded its own string, which silently drifted: index.html
 * showed "v2.0" while methods.html showed "v2.2" — two copies nobody kept in sync.
 * Now one constant fills every `.version` element on the page, so the headers can never
 * disagree again. Bump it here, in one place, at each release.
 *
 * The AUTHORITATIVE build identity (commit · tests · date, computed at build time) lives
 * in the provenance footer — that number cannot be faked. This is only the friendly label.
 */
export const APP_VERSION = 'v2.3';

/** Fill every `.version` element on the current page from the single APP_VERSION constant. */
export function renderVersion(): void {
  for (const el of document.querySelectorAll<HTMLElement>('.version')) {
    el.textContent = APP_VERSION;
  }
}
