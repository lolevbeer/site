// eslint-config-next 16 ships native flat config, so these are spread directly.
// Older versions needed the @eslint/eslintrc FlatCompat shim, which threw
// "Converting circular structure to JSON" under ESLint 9 — the reason linting
// was previously skipped during builds.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

// Identity fence for the Payload Local API (see "Access control" in AGENTS.md).
// An omitted `overrideAccess` defaults to `false` on Payload 4 (it was `true` on
// Payload 3), so a silent default either bypasses or enforces access depending on
// the version. Every call must say which identity it runs as:
//   - acting for a person → `overrideAccess: false` plus their `user` or `req`;
//   - user-less system code → `overrideAccess: true`, allowed only in
//     SYSTEM_OVERRIDE_FILES or behind
//     `// eslint-disable-next-line no-restricted-syntax -- system: <reason>`.
// Flat config replaces (not merges) a rule's options per block, so the
// allowlist block re-declares no-restricted-syntax with only the omitted-flag check.
// Matches `payload` and any `<expr>.payload` (req.payload, this.payload).
const isPayload = (path) => `:matches([${path}.name='payload'], [${path}.property.name='payload'])`
const LOCAL_API_CALLS = [
  // payload.find(...), req.payload.update(...), ...
  `CallExpression[callee.property.name=/^(find|findByID|findGlobal|count|create|update|delete|updateGlobal|findDistinct|findVersions|findGlobalVersions|duplicate)$/]${isPayload('callee.object')}`,
  // payload.jobs.run(...), payload.jobs.queue(...)
  `CallExpression[callee.property.name=/^(run|queue)$/][callee.object.property.name='jobs']${isPayload('callee.object.object')}`,
]
const omittedOverrideAccess = {
  selector: `:matches(${LOCAL_API_CALLS.join(', ')}) > ObjectExpression:first-child:not(:has(> Property[key.name='overrideAccess']))`,
  message:
    'Payload Local API call must set overrideAccess (an omitted flag defaults to false on Payload 4, true on Payload 3). Acting for a person: `overrideAccess: false` plus `user` or `req`. User-less system code: `overrideAccess: true` in an allowlisted path or behind `// eslint-disable-next-line no-restricted-syntax -- system: <reason>`.',
}
const overrideAccessTrue = {
  selector: "Property[key.name='overrideAccess'][value.value=true]",
  message:
    '`overrideAccess: true` bypasses access control. Pass `overrideAccess: false` with `user`/`req`, or fence a user-less system call with `// eslint-disable-next-line no-restricted-syntax -- system: <reason>`.',
}
const SYSTEM_OVERRIDE_FILES = [
  'src/migrations/**',
  'scripts/**',
  'src/jobs/**',
  'src/app/api/cron/**',
  'lib/public-forms/**',
  'lib/slack/notify.ts',
  'src/actions/donation-request.ts',
  'src/actions/job-application.ts',
  'src/utils/beer-reviews.ts',
  'src/utils/revalidate-beer-page.ts',
  'src/collections/utils/generateUniqueSlug.ts',
]

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
      'no-restricted-syntax': ['error', overrideAccessTrue, omittedOverrideAccess],
    },
  },
  {
    // User-less system code may override; tests assert on the flag's value.
    // Omitting the flag is still an error in both.
    files: [...SYSTEM_OVERRIDE_FILES, 'tests/**'],
    rules: {
      'no-restricted-syntax': ['error', omittedOverrideAccess],
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
