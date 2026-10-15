import eslint from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import typescript from 'typescript-eslint';

const eslintConfig = [
  {
    ignores: ['.next/**', '.next-*/**', '.vercel/**', 'node_modules/**', 'next-env.d.ts']
  },
  eslint.configs.recommended,
  ...typescript.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' }
    },
    settings: { react: { version: 'detect' } }
  },
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  {
    ...jsxA11y.flatConfigs.recommended,
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      'jsx-a11y/label-has-associated-control': ['error', { depth: 4 }],
      // Assessment headings and question legends are deliberate keyboard stops.
      'jsx-a11y/no-noninteractive-tabindex': ['error', { tags: ['h2', 'legend'] }]
    }
  },
  reactHooks.configs.flat.recommended
];

export default eslintConfig;
