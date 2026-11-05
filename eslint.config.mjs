import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['**/node_modules/**', '**/dist/**', '**/.next/**', '**/coverage/**', '**/next-env.d.ts']),

  // Backend and shared packages
  {
    files: ['apps/api/**/*.ts', 'packages/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['error', { allow: ['error'] }],
      eqeqeq: ['error', 'smart'],
    },
  },

  // Frontend
  {
    files: ['apps/web/**/*.{ts,tsx,mjs}'],
    extends: [...nextVitals, ...tseslint.configs.recommended],
    settings: { next: { rootDir: 'apps/web/' } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },

  {
    files: ['**/*.test.ts', '**/test/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
]);
