import js from '@eslint/js'
import prettierConfig from 'eslint-config-prettier'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default [
  {
    ignores: [
      'out/**',
      'dist/**',
      'node_modules/**',
      'src-tauri/**',
      '**/*.d.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked.map((conf) => ({
    ...conf,
    files: ['**/*.{ts,tsx}'],
  })),
  ...tseslint.configs.stylisticTypeChecked.map((conf) => ({
    ...conf,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    ...reactPlugin.configs.flat.recommended,
    files: ['src/**/*.tsx'],
  },
  {
    ...reactPlugin.configs.flat['jsx-runtime'],
    files: ['src/**/*.tsx'],
  },
  {
    ...reactHooksPlugin.configs.flat.recommended,
    files: ['src/**/*.{ts,tsx}'],
  },
  {
    files: ['src/**/*.tsx'],
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-confusing-void-expression': 'error',
    },
  },
  {
    files: ['**/*.config.{js,ts,mjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
  prettierConfig,
]
