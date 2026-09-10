// The gate tsc does not give: undefined identifiers in .mjs (the real `rel()` bug in
// cli/joca.mjs passed build+tsc and blew up at runtime) and the sloppiness TS tolerates.
// Analysis 2026-08-19 §2 — central rule: no-undef on the .mjs files.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  // TS: recommended, without type-checking (tsc already does it in the build; here it is fast)
  ...tseslint.configs.recommended.map((c) => ({ ...c, files: ['src/**/*.ts'] })),
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off', // PTY/WS bridges use any deliberately
    },
  },
];
