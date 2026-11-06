import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

/**
 * Tests de integración contra PostgreSQL efímero (ver src/integration/).
 *
 * La app NestJS depende de `emitDecoratorMetadata` (DI por tipo del
 * constructor), que esbuild/Vite NO implementa. Por eso el transform usa
 * SWC con decoradores legacy + metadata — mismo semántica que `tsc`.
 */
export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    globalSetup: './src/integration/global-setup.ts',
    include: ['src/**/*.integration.spec.ts'],
    testTimeout: 180_000,
    // El globalSetup migra+siembra desde cero; en frío puede pasar de 3 min.
    hookTimeout: 600_000,
    pool: 'forks',
    // Sin paralelismo entre archivos para evitar carreras sobre la BD compartida.
    fileParallelism: false,
  },
});
