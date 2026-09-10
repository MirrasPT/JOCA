// Analysis 2026-08-19 §2. react-hooks catches wrong useEffect/useMemo dependencies;
// the rest is the recommended TS without type-checking (tsc -b already runs in the build).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  ...tseslint.configs.recommended.map((c) => ({ ...c, files: ['src/**/*.{ts,tsx}'] })),
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // The new rules (formerly React Compiler) point at real refactors but are not today's gate:
      // 15 pre-existing setState-in-effect. They stay visible as warning; the classic ones
      // (rules-of-hooks, exhaustive-deps) remain error.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
