// `cli/joca.mjs` is pure .mjs: neither tsc nor Vite check it. This is where the undefined
// `rel(c.ts)` lived (ReferenceError at runtime with a green build) — no-undef closes that.
export default [
  {
    files: ['**/*.mjs'],
    ignores: ['eslint.config.mjs'],
    languageOptions: {
      ecmaVersion: 2024, sourceType: 'module',
      globals: { console: 'readonly', process: 'readonly', fetch: 'readonly', URL: 'readonly', URLSearchParams: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly', Buffer: 'readonly', AbortController: 'readonly', TextDecoder: 'readonly', TextEncoder: 'readonly' },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-dupe-keys': 'error', 'no-unreachable': 'error', 'no-fallthrough': 'error',
    },
  },
];
