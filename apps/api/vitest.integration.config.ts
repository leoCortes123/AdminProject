import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: './src/integration/global-setup.ts',
    include: ['src/**/*.integration.spec.ts'],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    pool: 'forks',
    // Sin paralelismo entre archivos para evitar carreras sobre la BD compartida.
    fileParallelism: false,
  },
});
