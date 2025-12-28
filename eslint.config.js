import eslint from '@eslint/js'
import globals from 'globals'
import { defineConfig, globalIgnores } from 'eslint/config'
import convexPlugin from '@convex-dev/eslint-plugin'
import pluginRouter from '@tanstack/eslint-plugin-router'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier/flat'
import oxlint from 'eslint-plugin-oxlint'

export default defineConfig([
  globalIgnores(['convex/_generated']),
  {
    settings: {
      react: {
        version: 'detect'
      }
    },
    languageOptions: {
      globals: globals.browser
    }
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  reactHooks.configs.recommended,
  reactRefresh.configs.recommended,
  jsxA11y.flatConfigs.recommended,
  {
    rules: {
      'jsx-a11y/media-has-caption': 'off'
    }
  },
  pluginRouter.configs['flat/recommended'],
  convexPlugin.configs.recommended,
  prettier,
  // or buildFromOxlintConfigFile
  oxlint.buildFromOxlintConfigFile('./.oxlintrc.json')
])
