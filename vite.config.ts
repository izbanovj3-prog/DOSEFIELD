import { defineConfig } from 'vite';

// The GitHub Pages project site is served from /DOSEFIELD/, so the PRODUCTION build needs
// that base path (assets + the dose worker resolve relative to it). Dev stays at '/'.
// Deployment is automated by .github/workflows/deploy.yml — no manual build/upload.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/DOSEFIELD/' : '/',
}));
