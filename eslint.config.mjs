// eslint-config-next 16 ships native flat config, so these are spread directly.
// Older versions needed the @eslint/eslintrc FlatCompat shim, which threw
// "Converting circular structure to JSON" under ESLint 9 — the reason linting
// was previously skipped during builds.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    // Disable html-link-for-pages in Payload admin components (they use their own routing)
    files: ['src/components/AdminLogo.tsx', 'src/components/SyncNavLink.tsx'],
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  {
    ignores: ['.next/'],
  },
]

export default eslintConfig
