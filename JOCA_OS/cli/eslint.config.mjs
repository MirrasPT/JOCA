// O `cli/joca.mjs` é .mjs puro: nem tsc nem Vite o verificam. Foi aqui que viveu o
// `rel(c.ts)` indefinido (ReferenceError em runtime com build verde) — o no-undef fecha isso.
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
