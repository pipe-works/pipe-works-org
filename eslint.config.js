// ESLint flat config for pipe-works-org
// Using CommonJS format for compatibility

module.exports = [
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        document: 'readonly',
        window: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off',
      semi: ['error', 'always'],
      quotes: ['error', 'single', { avoidEscape: true }],
      indent: ['error', 2],
      'no-multiple-empty-lines': ['error', { max: 2 }],
      'eol-last': ['error', 'always'],
    },
  },
  {
    ignores: ['assets/**', '_working/**', 'node_modules/**'],
  },
];
