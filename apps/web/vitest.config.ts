import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Los tests de playwright (e2e/) NO son unitarios — se ejecutan con
    // `pnpm e2e` (ver playwright.config.ts), nunca aquí.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
