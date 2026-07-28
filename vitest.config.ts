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
    include: ['src/domain/**/*.test.ts', 'src/data/**/*.test.ts', 'src/infrastructure/**/*.test.ts', 'src/shared/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts', 'src/data/models/Mapper.ts'],
      exclude: [
        'src/domain/**/index.ts',
        'src/domain/**/*.test.ts',
        'src/domain/entities/**/*.ts',
        'src/domain/repositories/**/*.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
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
