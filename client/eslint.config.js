import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // Core no-unused-vars doesn't count JSX usage, so anything only ever
      // used as a tag reads as unused. Capitalised names cover components
      // (<Foo />); `motion` is the one lowercase case, used as <motion.div>.
      // Without it every animated page was falsely flagged — and "fixing"
      // those by deleting the import would have crashed the page.
      'no-unused-vars': ['error', { varsIgnorePattern: '^([A-Z_]|motion$)' }],
    },
  },
])
