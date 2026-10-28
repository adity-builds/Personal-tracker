import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  {
    ignores: ['dist/**', 'dist-react/**', 'dist-electron/**', 'build/**', 'node_modules/**'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Core no-unused-vars does not understand JSX references.
      'react/jsx-uses-vars': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // React Compiler heuristics flag established, intentional patterns here
      // (fetch-on-mount, prop->state sync, animation prop refs).
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
    },
  },
  {
    // core.js is ESM + CommonJS-compatible for the node test runner.
    files: ['src/utils/core.js'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
]
