import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// The GitHub Pages project site is served from /DOSEFIELD/, so the PRODUCTION build needs
// that base path (assets + the dose worker resolve relative to it). Dev stays at '/'.
// Deployment is automated by .github/workflows/deploy.yml — no manual build/upload.
// Two entry pages: the dosimeter (index.html) and Methods & Limitations (methods.html).
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/DOSEFIELD/' : '/',
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        methods: fileURLToPath(new URL('./methods.html', import.meta.url)),
      },
    },
  },
}));
