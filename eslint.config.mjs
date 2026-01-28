import js from '@eslint/js'
import prettierConfig from 'eslint-config-prettier'
import reactPlugin from 'eslint-plugin-react'
import reactCompilerPlugin from 'eslint-plugin-react-compiler'
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
  {
    plugins: {
      'react-compiler': reactCompilerPlugin,
    },
    rules: {
      'react-compiler/react-compiler': 'error',
    },
  },
  ...tseslint.configs.recommendedTypeChecked.map((conf) => ({
    ...conf,
    files: ['**/*.{ts,tsx}'],
  })),
  ...tseslint.configs.stylisticTypeChecked.map((conf) => ({
    ...conf,
    files: ['**/*.{ts,tsx}'],
  })),
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat['jsx-runtime'],
  {
    plugins: {
      'react-hooks': reactHooksPlugin,
    },
    rules: reactHooksPlugin.configs.recommended.rules,
  },
  {
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
  },
  {
    files: ['**/*.config.{js,ts,mjs}', 'eslint.config.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
  prettierConfig,
]
