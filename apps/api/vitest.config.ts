import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    // La suite de integración (api.integration.spec.ts) es opt-in: `pnpm test:integration`.
    exclude: ['src/**/*.integration.spec.ts'],
  },
});
