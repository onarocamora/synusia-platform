// vitest.config.mts (o vitest.config.ts)
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 30000,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.ts', '**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.next/**', '**/dist/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname || '.', './'),
    },
  },
});