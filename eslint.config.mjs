import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Shared ESLint configuration for the MehrWearing monorepo.
 *
 * The TypeScript compiler is the strict gate (`bun run typecheck`); ESLint
 * focuses on risky JavaScript patterns across all workspaces.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      'apps/api/src/generated/**',
      'packages/api-client/src/generated/**',
      'apps/mobile/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      // Jest configs, setup helpers and scripts run in Node.
      globals: {
        module: 'readonly',
        exports: 'writable',
        require: 'readonly',
        process: 'readonly',
        global: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
    rules: {
      // CommonJS files are, by definition, full of require() calls.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
