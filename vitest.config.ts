/**
 * Vitest configuration for ZenMoney
 * Tests the domain layer (pure business logic) without React Native dependencies
 */
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/domain/**/*.test.ts', 'src/shared/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts'],
      exclude: ['src/domain/**/index.ts', 'src/domain/**/*.test.ts'],
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@domain': path.resolve(__dirname, './src/domain'),
      '@data': path.resolve(__dirname, './src/data'),
      '@presentation': path.resolve(__dirname, './src/presentation'),
      '@infrastructure': path.resolve(__dirname, './src/infrastructure'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
});
