import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Varning, inte fel: kodbasen använder setState i effects medvetet (djuplänkar
      // som konsumeras en gång, filter som nollställs vid källbyte m.m.) och kör inte
      // React Compiler, där regeln annars är som viktigast. Nya fall syns ändå.
      'react-hooks/set-state-in-effect': 'warn',
      // Påverkar bara hot reload i dev. Contexts exporterar sin hook från samma fil
      // (useAuth, useFlags …) — att dela upp dem är inte värt det.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Konventionen _namn = medvetet oanvänd (t.ex. en prop som ännu inte används).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
])
