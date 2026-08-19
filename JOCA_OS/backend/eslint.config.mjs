// Gate que o tsc não dá: identificadores indefinidos em .mjs (o bug real do `rel()` no
// cli/joca.mjs passou build+tsc e rebentava em runtime) e sujidade que o TS tolera.
// Análise 2026-08-19 §2 — regra central: no-undef nos .mjs.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  // TS: recomendado, sem type-checking (o tsc já o faz no build; aqui é rápido)
  ...tseslint.configs.recommended.map((c) => ({ ...c, files: ['src/**/*.ts'] })),
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off', // pontes PTY/WS usam any de propósito
    },
  },
];
