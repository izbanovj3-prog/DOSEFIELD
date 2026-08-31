/**
 * Dark / light theme switch.
 *
 * Dark is the project's default and stays that way — this is an opt-in for showing the
 * instrument on a projector, under room lights, or on paper, where a dark panel loses
 * detail. The light palette is not a different design: same amber for action, same red
 * for the limit, same mono numerals, only the ground is inverted and every value
 * re-derived for it (see the `:root[data-theme="light"]` block in styles.css).
 *
 * The system `prefers-color-scheme` is deliberately NOT followed: a viewer whose OS is
 * in light mode should still meet the instrument as it is meant to look, and switch
 * only if they want to. The choice, once made, is remembered.
 *
 * Canvas charts cannot inherit CSS, so a `themechange` event is dispatched on `window`
 * for main.ts to re-read its palette and redraw.
 */

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'dosefield.theme';

/** localStorage throws in some privacy modes — a theme preference is never worth a crash. */
function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function store(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore — the theme still applies for this session */
  }
}

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'light') root.dataset.theme = 'light';
  else delete root.dataset.theme; // dark is the bare :root, not an override
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#e9e4da' : '#12110f');
  for (const btn of document.querySelectorAll<HTMLButtonElement>('.theme-toggle')) {
    btn.setAttribute('aria-pressed', String(theme === 'light'));
    btn.textContent = theme === 'light' ? 'Dark' : 'Light';
    btn.title = theme === 'light' ? 'Switch to the dark instrument panel' : 'Switch to the daylight panel (for a projector or print)';
  }
  window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
}

/** Wire every `.theme-toggle` on the page and apply the remembered choice. */
export function initTheme(): void {
  applyTheme(readStored() ?? 'dark');
  for (const btn of document.querySelectorAll<HTMLButtonElement>('.theme-toggle')) {
    btn.addEventListener('click', () => {
      const next: Theme = currentTheme() === 'light' ? 'dark' : 'light';
      applyTheme(next);
      store(next);
    });
  }
}
