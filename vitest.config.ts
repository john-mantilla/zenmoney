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
    include: ['src/domain/**/*.test.ts', 'src/data/**/*.test.ts', 'src/infrastructure/**/*.test.ts', 'src/shared/**/*.test.ts', 'src/presentation/**/*.test.ts'],
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
    alias: [
      { find: /.*\.(png|jpg|jpeg|gif|svg)$/, replacement: path.resolve(__dirname, './src/presentation/__tests__/__mocks__/fileMock.js') },
      { find: '@', replacement: path.resolve(__dirname, './') },
      { find: '@domain', replacement: path.resolve(__dirname, './src/domain') },
      { find: '@data', replacement: path.resolve(__dirname, './src/data') },
      { find: '@presentation', replacement: path.resolve(__dirname, './src/presentation') },
      { find: '@infrastructure', replacement: path.resolve(__dirname, './src/infrastructure') },
      { find: '@shared', replacement: path.resolve(__dirname, './src/shared') },
    ],
  },
});
