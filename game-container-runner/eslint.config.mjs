import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(js.configs.recommended, {
  files: ['**/*.ts'],
  extends: [tseslint.configs.recommended],
  languageOptions: {
    parserOptions: { project: './tsconfig.json', tsconfigRootDir: import.meta.dirname },
  },
  rules: {
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
});
