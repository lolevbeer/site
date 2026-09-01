# Production Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all eight production-audit findings with test-first security, release, operational, and accessibility changes while retaining Vercel Git auto-deploy.

**Architecture:** One remediation branch owns eight independently reviewable tasks. Shared boundary helpers enforce Untappd URL safety and server environment requirements; Radix Dialog owns mobile modal behavior; a typed migration recovery manifest and operations runbook constrain the retained build-time migration model; disposable MongoDB and Playwright exercise the production build and critical browser journey in CI.

**Tech Stack:** Next.js 16.3.3 App Router, React 19, Payload CMS 3.88 with MongoDB, Vitest 4, Testing Library, Radix Dialog, Framer Motion, Playwright, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-01-production-audit-remediation-design.md`

## Global Constraints

- Work only in `/Users/tedslesinski/Repos/site/.agents/worktrees/production-audit-remediation` on `fix/production-audit-remediation`.
- Read the installed Next.js 16 guides under `node_modules/next/dist/docs/` before changing route handlers or environment behavior.
- Preserve Vercel Git auto-deploy and the current `migrate:prod` build hook; document the accepted partial-mutation residual risk rather than claiming it is eliminated.
- Untappd fetches use a 10-second timeout, a 5 MiB response-body ceiling, `redirect: 'manual'`, and exact-host HTTPS validation.
- Do not add an environment-schema dependency; keep server environment validation in a small server-only module.
- Use `@radix-ui/react-dialog`, already installed, for modal focus containment and restoration.
- Every new source file needs a module-level purpose comment. Update stale TSDoc/comments in modified files.
- Write the named failing test first for every behavioral task. Run the targeted test red, implement minimally, then run it green.
- After every code task run `pnpm type-check` and the named targeted tests before committing.
- Never use production credentials, production URLs, or a non-disposable database in Playwright or seed scripts.
- Do not add co-author attribution to commits.

## File and Interface Map

- `src/utils/untappd.ts`: owns `normalizeUntappdBeerUrl`, bounded response reading, and Untappd failure classification.
- `src/app/api/untappd/route.ts`: validates interactive rating URLs and returns HTTP 400 before outbound I/O.
- `lib/config/server-env.ts`: owns typed server environment validation without exposing values.
- `src/utils/health.ts`: owns the lightweight Payload/MongoDB dependency probe.
- `src/app/api/health/route.ts`: maps the health probe to generic 200/503 JSON responses.
- `components/layout/header.tsx` and `components/layout/mobile-menu.tsx`: share one controlled Radix Dialog context.
- `components/map/map-controls.tsx`: labels both responsive search inputs.
- `src/migrations/recovery.ts`: typed, ordered recovery metadata for every registered migration.
- `docs/operations/production-deploy.md`: production backup, migration, rollback/roll-forward, and verification runbook.
- `scripts/seed-e2e.ts`: idempotent disposable database seed guarded against production writes.
- `playwright.config.ts` and `tests/e2e/release-smoke.spec.ts`: production-server release journeys.
- `.github/workflows/ci.yml`: Node-24-capable actions, MongoDB-backed build, and browser gate.

---

### Task 1: Restrict Untappd outbound requests

**Files:**
- Modify: `src/utils/untappd.ts:1-212`
- Modify: `src/app/api/untappd/route.ts:1-204`
- Create: `tests/int/untappd-url-security.int.spec.ts`

**Interfaces:**
- Produces: `normalizeUntappdBeerUrl(input: string): URL | null`
- Produces: `UNTAPPD_FETCH_TIMEOUT_MS = 10_000`
- Produces: `UNTAPPD_MAX_BODY_BYTES = 5 * 1024 * 1024`
- Preserves: `fetchUntappdData(url: string): Promise<UntappdData>` and existing retryable/permanent failure shape.
- Consumes: the route calls `normalizeUntappdBeerUrl` before `fetchUntappdData`.

- [ ] **Step 1: Write parser and fetch-boundary tests that fail against the current unrestricted implementation**

Create `tests/int/untappd-url-security.int.spec.ts` with table-driven parser cases and mocked fetch behavior:

```ts
/** Untappd URL validation and bounded fetch behavior prevent authenticated SSRF. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchUntappdData,
  normalizeUntappdBeerUrl,
  UNTAPPD_MAX_BODY_BYTES,
} from '@/src/utils/untappd'

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('normalizeUntappdBeerUrl', () => {
  it.each([
    ['/b/lolev-beer-lupula/123456', 'https://untappd.com/b/lolev-beer-lupula/123456'],
    ['https://untappd.com/b/lolev-beer-lupula/123456?source=test#reviews', 'https://untappd.com/b/lolev-beer-lupula/123456'],
    ['https://www.untappd.com/b/lolev-beer-lupula/123456', 'https://untappd.com/b/lolev-beer-lupula/123456'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeUntappdBeerUrl(input)?.toString()).toBe(expected)
  })

  it.each([
    'http://untappd.com/b/beer/1',
    'https://untappd.com:444/b/beer/1',
    'https://user:pass@untappd.com/b/beer/1',
    'https://untappd.com.evil.example/b/beer/1',
    'https://127.0.0.1/b/beer/1',
    'http://169.254.169.254/latest/meta-data',
    'https://untappd.com/search?q=lolev',
    '/b/not-enough-segments',
    'not a url',
  ])('rejects %s', (input) => {
    expect(normalizeUntappdBeerUrl(input)).toBeNull()
  })
})

describe('fetchUntappdData network boundary', () => {
  it('does not fetch an invalid destination', async () => {
    global.fetch = vi.fn()
    await expect(fetchUntappdData('http://169.254.169.254/latest/meta-data')).resolves.toMatchObject({
      failure: 'permanent',
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('uses the canonical URL and disables redirects', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('', { status: 302 }))
    await expect(fetchUntappdData('/b/lolev-beer-lupula/123456')).resolves.toMatchObject({
      failure: 'permanent',
    })
    expect(global.fetch).toHaveBeenCalledWith(
      'https://untappd.com/b/lolev-beer-lupula/123456',
      expect.objectContaining({ redirect: 'manual', signal: expect.any(AbortSignal) }),
    )
  })

  it('rejects a declared oversized response', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response('small', {
        status: 200,
        headers: { 'content-length': String(UNTAPPD_MAX_BODY_BYTES + 1) },
      }),
    )
    await expect(fetchUntappdData('/b/lolev-beer-lupula/123456')).resolves.toMatchObject({
      failure: 'permanent',
    })
  })
})
```

- [ ] **Step 2: Run the test and confirm the red state**

Run:

```bash
pnpm test -- tests/int/untappd-url-security.int.spec.ts
```

Expected: FAIL because `normalizeUntappdBeerUrl` and the exported limits do not exist, and the current implementation calls arbitrary URLs.

- [ ] **Step 3: Implement canonical URL validation and bounded body reading**

In `src/utils/untappd.ts`, add the constants and pure parser immediately after the imports:

```ts
export const UNTAPPD_FETCH_TIMEOUT_MS = 10_000
export const UNTAPPD_MAX_BODY_BYTES = 5 * 1024 * 1024

const UNTAPPD_BEER_PATH = /^\/b\/[a-z0-9][a-z0-9-]*\/\d+\/?$/i
const UNTAPPD_HOSTS = new Set(['untappd.com', 'www.untappd.com'])

/** Returns a canonical Untappd beer URL, or null without performing I/O. */
export function normalizeUntappdBeerUrl(input: string): URL | null {
  try {
    const parsed = input.startsWith('/') ? new URL(input, 'https://untappd.com') : new URL(input)
    if (parsed.protocol !== 'https:') return null
    if (!UNTAPPD_HOSTS.has(parsed.hostname)) return null
    if (parsed.username || parsed.password || parsed.port) return null
    if (!UNTAPPD_BEER_PATH.test(parsed.pathname)) return null
    return new URL(parsed.pathname.replace(/\/$/, ''), 'https://untappd.com')
  } catch {
    return null
  }
}
```

Add this private bounded reader:

```ts
async function readBoundedText(response: Response): Promise<string | null> {
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > UNTAPPD_MAX_BODY_BYTES) return null
  if (!response.body) return response.text()

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > UNTAPPD_MAX_BODY_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const body = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(body)
}
```

Change `fetchUntappdData` to:

```ts
const canonicalUrl = normalizeUntappdBeerUrl(url)
if (!canonicalUrl) return failed('permanent')

const response = await fetch(canonicalUrl.toString(), {
  headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
  redirect: 'manual',
  signal: AbortSignal.timeout(UNTAPPD_FETCH_TIMEOUT_MS),
})

if (response.status >= 300 && response.status < 400) return failed('permanent')
// Preserve current 429, permanent status, 5xx, and circuit-breaker handling.
const html = await readBoundedText(response)
if (html === null) return failed('permanent')
```

Use `canonicalUrl.toString()` in Sentry context. Never log the original rejected input.

- [ ] **Step 4: Make the interactive route reject invalid URLs with HTTP 400 before calling fetch**

In `src/app/api/untappd/route.ts`, import `normalizeUntappdBeerUrl`. In the `rating` branch:

```ts
const url = searchParams.get('url')
if (!url) return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
const canonicalUrl = normalizeUntappdBeerUrl(url)
if (!canonicalUrl) return NextResponse.json({ error: 'Invalid Untappd beer URL' }, { status: 400 })
return fetchRating(canonicalUrl.toString())
```

Add a route test in the same file by mocking authenticated `payload.auth` and `fetchUntappdData`; assert a metadata URL returns 400 and the fetch helper is not called.

- [ ] **Step 5: Run targeted and existing Untappd tests green**

Run:

```bash
pnpm test -- tests/int/untappd-url-security.int.spec.ts tests/int/sync-untappd-batching.int.spec.ts
pnpm type-check
```

Expected: both files pass and TypeScript reports zero errors.

- [ ] **Step 6: Commit the security boundary**

```bash
git add src/utils/untappd.ts src/app/api/untappd/route.ts tests/int/untappd-url-security.int.spec.ts
git commit -m "fix(security): restrict Untappd outbound requests"
```

---

### Task 2: Add server environment validation and health endpoint

**Files:**
- Create: `lib/config/server-env.ts`
- Create: `src/utils/health.ts`
- Create: `src/app/api/health/route.ts`
- Create: `tests/int/server-env.int.spec.ts`
- Create: `tests/int/health-route.int.spec.ts`
- Modify: `src/payload.config.ts:53-223`

**Interfaces:**
- Produces: `ServerEnvironmentError extends Error`
- Produces: `readServerEnvironment(env?: NodeJS.ProcessEnv): ServerEnvironment`
- Produces: `checkApplicationHealth(): Promise<void>`
- Route contract: `GET /api/health` returns generic `{ status: 'ok' | 'unhealthy' }` and `Cache-Control: no-store`.

- [ ] **Step 1: Write failing environment-contract tests**

Create `tests/int/server-env.int.spec.ts`:

```ts
/** Core server environment validation fails closed without exposing secret values. */
import { describe, expect, it } from 'vitest'
import { readServerEnvironment, ServerEnvironmentError } from '@/lib/config/server-env'

const valid = {
  NODE_ENV: 'development',
  DATABASE_URI: 'mongodb://127.0.0.1/lolev-test',
  PAYLOAD_SECRET: 'test-secret-that-is-not-a-placeholder',
} satisfies NodeJS.ProcessEnv

describe('readServerEnvironment', () => {
  it.each(['DATABASE_URI', 'PAYLOAD_SECRET'])('requires %s', (name) => {
    const env = { ...valid, [name]: '' }
    expect(() => readServerEnvironment(env)).toThrow(ServerEnvironmentError)
    expect(() => readServerEnvironment(env)).toThrow(name)
  })

  it('rejects the documented Payload placeholder', () => {
    expect(() => readServerEnvironment({ ...valid, PAYLOAD_SECRET: 'YOUR_SECRET_HERE' })).toThrow(
      'PAYLOAD_SECRET',
    )
  })

  it('requires Blob storage in production', () => {
    expect(() => readServerEnvironment({ ...valid, NODE_ENV: 'production' })).toThrow(
      'BLOB_READ_WRITE_TOKEN',
    )
  })

  it('requires Slack credentials as a pair', () => {
    expect(() => readServerEnvironment({ ...valid, SLACK_SIGNING_SECRET: 'signing-only' })).toThrow(
      'SLACK_SIGNING_SECRET and SLACK_BOT_TOKEN',
    )
  })

  it('returns validated values without changing optional integrations', () => {
    expect(readServerEnvironment(valid)).toMatchObject({
      databaseUri: valid.DATABASE_URI,
      payloadSecret: valid.PAYLOAD_SECRET,
      blobReadWriteToken: undefined,
    })
  })
})
```

- [ ] **Step 2: Run the environment test red**

Run `pnpm test -- tests/int/server-env.int.spec.ts`.

Expected: FAIL because `lib/config/server-env.ts` does not exist.

- [ ] **Step 3: Implement the server-only environment module and wire Payload config**

Create `lib/config/server-env.ts` with a module-purpose comment and these exact public types:

```ts
export interface ServerEnvironment {
  databaseUri: string
  payloadSecret: string
  blobReadWriteToken: string | undefined
}

export class ServerEnvironmentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ServerEnvironmentError'
  }
}

export function readServerEnvironment(env: NodeJS.ProcessEnv = process.env): ServerEnvironment
```

Implement a private `required(name, env)` helper that trims values, rejects empty strings, and never includes values in errors. Reject `YOUR_SECRET_HERE`. Require Blob storage only for `NODE_ENV === 'production'`. Throw one pairing error when exactly one Slack credential is present.

In `src/payload.config.ts`, compute `const serverEnv = readServerEnvironment()` once and replace the empty-string fallbacks for Payload secret, database URI, and Blob token with validated values.

- [ ] **Step 4: Run the environment tests and type-check green**

Run:

```bash
pnpm test -- tests/int/server-env.int.spec.ts tests/int/payload-origins.int.spec.ts
pnpm type-check
```

Expected: PASS with zero type errors.

- [ ] **Step 5: Write failing health route tests**

Create `tests/int/health-route.int.spec.ts`:

```ts
/** The health route reports dependency readiness without exposing internals. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const checkApplicationHealth = vi.fn()
vi.mock('@/src/utils/health', () => ({
  checkApplicationHealth: () => checkApplicationHealth(),
}))
vi.mock('@/lib/utils/logger', () => ({
  logger: { error: vi.fn() },
}))

import { GET } from '@/src/app/api/health/route'

describe('GET /api/health', () => {
  beforeEach(() => checkApplicationHealth.mockReset())

  it('returns a non-cacheable healthy response', async () => {
    checkApplicationHealth.mockResolvedValue(undefined)
    const response = await GET()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({ status: 'ok' })
  })

  it('returns only a generic 503 body on failure', async () => {
    checkApplicationHealth.mockRejectedValue(new Error('mongodb://secret-host'))
    const response = await GET()
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ status: 'unhealthy' })
  })
})
```

- [ ] **Step 6: Run the health test red**

Run `pnpm test -- tests/int/health-route.int.spec.ts`.

Expected: FAIL because the health helper and route do not exist.

- [ ] **Step 7: Implement the dependency probe and route**

Create `src/utils/health.ts` with `checkApplicationHealth(): Promise<void>`. It calls `readServerEnvironment()`, obtains Payload with `getPayload({ config })`, and performs a minimal `payload.find({ collection: 'locations', limit: 1, depth: 0, pagination: false, overrideAccess: true })` to prove MongoDB reachability.

Create `src/app/api/health/route.ts`:

```ts
/** Public, non-sensitive readiness endpoint for deployment monitoring. */
import { NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'
import { checkApplicationHealth } from '@/src/utils/health'

const headers = { 'Cache-Control': 'no-store' }

export async function GET() {
  try {
    await checkApplicationHealth()
    return NextResponse.json({ status: 'ok' }, { headers })
  } catch (error) {
    logger.error('Application health check failed', error)
    return NextResponse.json({ status: 'unhealthy' }, { status: 503, headers })
  }
}
```

- [ ] **Step 8: Run health and environment tests green, then commit**

```bash
pnpm test -- tests/int/server-env.int.spec.ts tests/int/health-route.int.spec.ts tests/int/payload-origins.int.spec.ts
pnpm type-check
git add lib/config/server-env.ts src/utils/health.ts src/app/api/health/route.ts src/payload.config.ts tests/int/server-env.int.spec.ts tests/int/health-route.int.spec.ts
git commit -m "feat(ops): validate server environment and expose health"
```

---

### Task 3: Make mobile navigation a conforming modal dialog

**Files:**
- Modify: `components/layout/header.tsx:1-119`
- Modify: `components/layout/mobile-menu.tsx:1-139`
- Create: `tests/int/mobile-menu-dialog.int.spec.tsx`

**Interfaces:**
- `Header` remains prop-free.
- `MobileMenuProps` retains `isOpen`, `onClose`, and `isScrolled`; its modal context comes from the parent Radix `Dialog.Root`.
- Radix owns Escape, focus containment, outside interaction, scroll lock, and trigger focus restoration.

- [ ] **Step 1: Write a failing dialog behavior test**

Create `tests/int/mobile-menu-dialog.int.spec.tsx`. Mock `next/link`, `next/navigation`, `LocationTabs`, and Framer Motion to deterministic DOM wrappers. Test this contract:

```tsx
/** Mobile navigation delegates modal keyboard and focus behavior to Radix Dialog. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement, forwardRef, type ComponentProps, type ReactNode } from 'react'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))
vi.mock('next/link', () => ({ default: ({ children, ...props }: ComponentProps<'a'>) => createElement('a', props, children) }))
vi.mock('@/components/location/location-tabs', () => ({ LocationTabs: () => null }))
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: {
    div: forwardRef<HTMLDivElement, Record<string, unknown>>((props, ref) => {
      const { initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...domProps } = props
      return createElement('div', { ...domProps, ref })
    }),
  },
}))

import { Header } from '@/components/layout/header'

afterEach(cleanup)

describe('mobile navigation dialog', () => {
  it('closes on Escape and restores focus to its trigger', async () => {
    render(createElement(Header))
    const trigger = screen.getByRole('button', { name: 'Open menu' })
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: 'Mobile navigation menu' })).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(trigger)
  })
})
```


- [ ] **Step 2: Run the test red**

Run `pnpm test -- tests/int/mobile-menu-dialog.int.spec.tsx`.

Expected: FAIL because the current custom menu does not reliably restore focus and does not use Radix Dialog.

- [ ] **Step 3: Move controlled Radix ownership into Header**

Import `* as Dialog from '@radix-ui/react-dialog'`. Wrap the trigger and `MobileMenu` in one controlled root:

```tsx
<Dialog.Root open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
  <Dialog.Trigger asChild>
    <button
      aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
      aria-expanded={isMobileMenuOpen}
      className="flex items-center justify-center w-10 h-10 md:hidden rounded-md hover:bg-muted transition-colors"
    >
      <div className="relative w-5 h-2.5 flex flex-col justify-between">
        <span
          className={cn(
            'block h-0.5 w-full bg-foreground rounded-full transition-all duration-300 ease-out origin-center',
            isMobileMenuOpen ? 'rotate-45 translate-y-[4px]' : 'rotate-0 translate-y-0',
          )}
        />
        <span
          className={cn(
            'block h-0.5 w-full bg-foreground rounded-full transition-all duration-300 ease-out origin-center',
            isMobileMenuOpen ? '-rotate-45 -translate-y-[4px]' : 'rotate-0 translate-y-0',
          )}
        />
      </div>
    </button>
  </Dialog.Trigger>
  <MobileMenu
    isOpen={isMobileMenuOpen}
    onClose={() => setIsMobileMenuOpen(false)}
    isScrolled={isScrolled}
  />
</Dialog.Root>
```

Do not change desktop navigation or location-tab behavior.

- [ ] **Step 4: Replace custom modal mechanics in MobileMenu with Radix primitives**

Remove the `useEffect` Escape/body-overflow logic. Inside `AnimatePresence`, compose:

```tsx
<Dialog.Portal forceMount>
  <Dialog.Overlay asChild forceMount>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'fixed left-0 right-0 bottom-0 z-40 bg-black/10 backdrop-blur-xl md:hidden',
        isScrolled ? 'top-14' : 'top-16',
      )}
    />
  </Dialog.Overlay>
  <Dialog.Content asChild forceMount aria-describedby={undefined}>
    <motion.div
      initial={{ x: '100%', filter: 'blur(4px)' }}
      animate={{ x: 0, filter: 'blur(0px)' }}
      exit={{ x: '100%', filter: 'blur(4px)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={cn(
        'fixed right-0 z-50 w-full bg-background shadow-lg md:hidden overflow-hidden',
        isScrolled ? 'top-14 h-[calc(100vh-3.5rem)]' : 'top-16 h-[calc(100vh-4rem)]',
      )}
    >
      <Dialog.Title className="sr-only">Mobile navigation menu</Dialog.Title>
      {/* Move the existing lines 83-133 content block here unchanged. */}
    </motion.div>
  </Dialog.Content>
</Dialog.Portal>
```

Move the existing `<div className="flex h-full flex-col">` block from `components/layout/mobile-menu.tsx:83-133` immediately after `Dialog.Title` without changing its navigation or social-link markup. Navigation links continue to call `onClose`. Do not add a second focus trap, Escape listener, or body-lock implementation.

- [ ] **Step 5: Run the component test and type-check green**

```bash
pnpm test -- tests/int/mobile-menu-dialog.int.spec.tsx
pnpm type-check
```

Expected: PASS and zero TypeScript errors.

- [ ] **Step 6: Commit the modal contract**

```bash
git add components/layout/header.tsx components/layout/mobile-menu.tsx tests/int/mobile-menu-dialog.int.spec.tsx
git commit -m "fix(a11y): contain mobile menu focus"
```

---

### Task 4: Label both map search inputs

**Files:**
- Modify: `components/map/map-controls.tsx:1-110`
- Create: `tests/int/map-controls-a11y.int.spec.tsx`

**Interfaces:**
- Both responsive inputs expose the accessible name `Search locations`.
- Existing placeholder, value, callback, responsive classes, and layout remain unchanged.

- [ ] **Step 1: Write the failing accessible-name test**

Create `tests/int/map-controls-a11y.int.spec.tsx` with the complete render contract:

```tsx
/** Both responsive location searches expose the same accessible name. */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { MapControls } from '@/components/map/map-controls'

afterEach(cleanup)

describe('MapControls search', () => {
  it('labels both responsive search inputs', () => {
    render(
      createElement(MapControls, {
        searchTerm: '',
        onSearchChange: () => undefined,
        isSearching: false,
        hasSearchLocation: false,
        locationCount: 0,
        nearbyLocations: [],
        onNearMeClick: () => undefined,
        onNearbyLocationClick: () => undefined,
        mobileView: 'map',
        onMobileViewChange: () => undefined,
      }),
    )

    const searches = screen.getAllByRole('textbox', { name: 'Search locations' })
    expect(searches).toHaveLength(2)
    expect(searches.every((input) => input.getAttribute('placeholder') === 'Search location...')).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test red**

Run `pnpm test -- tests/int/map-controls-a11y.int.spec.tsx`.

Expected: FAIL because both inputs currently have placeholder-only names.

- [ ] **Step 3: Add the minimal labels**

Add `aria-label="Search locations"` to both `<Input>` elements and change no other props or styling.

- [ ] **Step 4: Run targeted tests and commit**

```bash
pnpm test -- tests/int/map-controls-a11y.int.spec.tsx
pnpm type-check
git add components/map/map-controls.tsx tests/int/map-controls-a11y.int.spec.tsx
git commit -m "fix(a11y): label location search inputs"
```

---

### Task 5: Define migration recovery metadata and production runbook

**Files:**
- Create: `src/migrations/recovery.ts`
- Create: `tests/int/migration-recovery.int.spec.ts`
- Create: `docs/operations/production-deploy.md`
- Modify: `README.md:140-160`

**Interfaces:**
- Produces: `MigrationRecoveryMode = 'down' | 'roll-forward' | 'restore'`
- Produces: `MigrationRecovery` with `name`, `compatibility`, `retry`, `mode`, and `verify`.
- Produces: ordered `migrationRecovery: readonly MigrationRecovery[]` matching `src/migrations/index.ts` exactly.

- [ ] **Step 1: Write the failing registry/recovery test**

Create `tests/int/migration-recovery.int.spec.ts`:

```ts
/** Every registered production migration has explicit compatibility and recovery evidence. */
import { describe, expect, it } from 'vitest'
import { migrations } from '@/src/migrations'
import { migrationRecovery } from '@/src/migrations/recovery'

describe('migration recovery manifest', () => {
  it('covers the migration registry in the same order', () => {
    expect(migrationRecovery.map(({ name }) => name)).toEqual(migrations.map(({ name }) => name))
  })

  it('contains actionable metadata for every migration', () => {
    for (const entry of migrationRecovery) {
      expect(entry.compatibility.trim().length).toBeGreaterThan(20)
      expect(entry.retry.trim().length).toBeGreaterThan(20)
      expect(entry.verify.trim().length).toBeGreaterThan(20)
      expect(['down', 'roll-forward', 'restore']).toContain(entry.mode)
    }
  })
})
```

- [ ] **Step 2: Run the test red**

Run `pnpm test -- tests/int/migration-recovery.int.spec.ts`.

Expected: FAIL because the recovery manifest does not exist.

- [ ] **Step 3: Add typed recovery metadata for all seven migrations**

Create `src/migrations/recovery.ts` with a module-purpose comment and the complete ordered manifest:

```ts
/** Recovery evidence for each production migration, in registry order. */
export type MigrationRecoveryMode = 'down' | 'roll-forward' | 'restore'

export interface MigrationRecovery {
  name: string
  compatibility: string
  retry: string
  mode: MigrationRecoveryMode
  verify: string
}

export const migrationRecovery = [
  {
    name: '20260826_210000_normalize_beer_reviews',
    compatibility: 'The deployed app continues reading embedded reviews while normalized review documents are added.',
    retry: 'Review upserts are keyed by source URL, so rerunning does not duplicate normalized reviews.',
    mode: 'down',
    verify: 'Compare normalized review counts and open representative beer detail pages before promotion.',
  },
  {
    name: '20260826_211000_normalize_recurring_food',
    compatibility: 'The legacy recurring-food global remains readable while normalized schedules and exclusions are created.',
    retry: 'Normalized markers and unique slot keys make partially completed schedule conversion safe to rerun.',
    mode: 'down',
    verify: 'Compare schedule and exclusion counts, then inspect both location food pages.',
  },
  {
    name: '20260826_212000_add_payload_jobs_indexes',
    compatibility: 'The migration adds indexes only and does not change the payload-jobs document contract.',
    retry: 'Named index creation is skipped when each target index already exists.',
    mode: 'down',
    verify: 'Inspect the expected payload-jobs indexes and run the maintenance cron once.',
  },
  {
    name: '20260827_120000_drop_menu_lines_last_cleaned',
    compatibility: 'The removed menu values are dead duplicates not read by the current or previously deployed application.',
    retry: 'MongoDB unset operations are idempotent across menu documents and versions.',
    mode: 'roll-forward',
    verify: 'Confirm menu copies are absent and location cleaning data remains authoritative.',
  },
  {
    name: '20260829_120000_scope_recurring_food_by_year',
    compatibility: 'Legacy schedules are preserved as 2026 records and remain readable while year scoping is introduced.',
    retry: 'Year assignment and named index operations tolerate a partially completed earlier run.',
    mode: 'roll-forward',
    verify: 'Confirm the year-scoped unique index and inspect the rendered 2026 food schedules.',
  },
  {
    name: '20260830_100000_drop_google_sheets_fields',
    compatibility: 'The fields are removed only after every application reader and sync endpoint was deleted.',
    retry: 'MongoDB unset operations are idempotent for live documents and stored versions.',
    mode: 'restore',
    verify: 'Confirm the fields are absent; use the recorded Atlas recovery point only if old code must be reinstated.',
  },
  {
    name: '20260830_143000_drop_legacy_recurring_food_slot_index',
    compatibility: 'The removed yearless index conflicts with the current year-scoped schema and is not required by deployed reads.',
    retry: 'The migration scans indexes and drops only a matching legacy key, so an absent index is a safe no-op.',
    mode: 'roll-forward',
    verify: 'Confirm the yearless slot index is absent and the year-scoped uniqueness index remains.',
  },
] as const satisfies readonly MigrationRecovery[]
```

- [ ] **Step 4: Run the manifest test green**

Run:

```bash
pnpm test -- tests/int/migration-recovery.int.spec.ts tests/int/recurring-food-year-migration.int.spec.ts
pnpm type-check
```

Expected: PASS.

- [ ] **Step 5: Write the production deployment runbook**

Create `docs/operations/production-deploy.md` with these executable sections:

- scope and accepted Vercel auto-deploy residual risk;
- release owner and Atlas recovery-point evidence fields;
- pre-merge commands: `pnpm type-check`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e`;
- pending migration check: `pnpm migrate:status` against the explicitly selected database;
- backup verification checklist that records recovery point ID/time and restore owner;
- backward-compatibility review against `src/migrations/recovery.ts`;
- Vercel promotion and post-deploy checks including `/api/health`, public routes, admin login, migration status, cron visibility, and Sentry;
- failure decision table: retry idempotent migration, roll forward, or Atlas restore; never run `migrate:down` unless the manifest mode is `down` and its guard conditions hold;
- release record template with commit, migration names, backup evidence, owner, health result, and rollback decision.

Do not include live credentials, cluster names, or fabricated backup evidence.

- [ ] **Step 6: Correct README migration claims and commit**

Replace the statement that a failed build cannot leave partial migration state. State instead that production builds run idempotent/resumable migrations before promotion, the old deployment may remain live after partial database mutation, and operators must follow the linked runbook.

```bash
git add src/migrations/recovery.ts tests/int/migration-recovery.int.spec.ts docs/operations/production-deploy.md README.md
git commit -m "docs(ops): define migration recovery contract"
```

---

### Task 6: Add disposable Playwright release smoke coverage

**Dependencies:** Tasks 2, 3, and 4.

**Files:**
- Modify: `package.json:15-32,71-99`
- Modify: `pnpm-lock.yaml`
- Create: `scripts/seed-e2e.ts`
- Create: `scripts/e2e-database-guard.ts`
- Create: `playwright.config.ts`
- Create: `tests/e2e/release-smoke.spec.ts`
- Create: `tests/int/e2e-seed-safety.int.spec.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces scripts: `e2e:seed`, `test:e2e`, `test:e2e:install`.
- Seed inputs: `DATABASE_URI`, `PAYLOAD_SECRET`, `E2E_DISPOSABLE_DATABASE`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`.
- Deterministic FAQ question: `Production readiness fixture`.
- Playwright base URL defaults to `http://127.0.0.1:3000`.

- [ ] **Step 1: Add Playwright as an explicit dev dependency and scripts**

Run:

```bash
pnpm add -D @playwright/test
```

Add scripts:

```json
"e2e:seed": "payload run scripts/seed-e2e.ts",
"test:e2e": "playwright test",
"test:e2e:install": "playwright install chromium"
```

- [ ] **Step 2: Write a failing seed-safety unit test before the seed implementation**

Create `tests/int/e2e-seed-safety.int.spec.ts` importing `isDisposableDatabase` from `scripts/e2e-database-guard.ts`:

```ts
expect(isDisposableDatabase('mongodb://127.0.0.1:27017/test', undefined)).toBe(true)
expect(isDisposableDatabase('mongodb://localhost:27017/test', undefined)).toBe(true)
expect(isDisposableDatabase('mongodb+srv://cluster.example/release-ci', '1')).toBe(true)
expect(isDisposableDatabase('mongodb+srv://cluster.example/test', '1')).toBe(false)
expect(isDisposableDatabase('mongodb+srv://cluster.example/release-ci', undefined)).toBe(false)
expect(isDisposableDatabase('not-a-url', '1')).toBe(false)
```

Run `pnpm test -- tests/int/e2e-seed-safety.int.spec.ts` and expect FAIL because the guard module does not exist.

- [ ] **Step 3: Implement the guarded idempotent seed**

Create `scripts/e2e-database-guard.ts` with a module-purpose comment and export:

```ts
export function isDisposableDatabase(uri: string, explicit: string | undefined): boolean
```

Return true for valid MongoDB URLs whose hostname is `localhost`, `127.0.0.1`, or `[::1]`. A remote URI is accepted only when `explicit === '1'` and its database pathname ends in `-e2e` or `-ci`. Malformed URLs always return false.

Create `scripts/seed-e2e.ts` with a module-purpose comment. Import the guard and execute the seed at module top level because `payload run` imports the script.

When executed through `payload run`, the script must:

1. validate the database target before calling `getPayload`;
2. require the test email/password without printing the password;
3. find or create the admin user with `roles: ['admin']`, updating its password when it already exists;
4. find or create the active FAQ `Production readiness fixture` with answer `Initial release fixture answer` and order `9999`;
5. log only IDs and the disposable database host classification.

Add `.playwright/`, `playwright-report/`, and `test-results/` to `.gitignore`.

Run the seed-safety unit test green and `pnpm type-check`.

- [ ] **Step 4: Write Playwright configuration**

Create `playwright.config.ts`:

```ts
/** Playwright release-smoke configuration for a built local production server. */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm start',
    url: 'http://127.0.0.1:3000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
```

- [ ] **Step 5: Write the release-smoke tests before running the production server**

Create `tests/e2e/release-smoke.spec.ts` with four tests:

1. table-driven public routes and expected headings for `/`, `/beer-map`, `/beer`, `/food`, `/events`, `/about`, `/faq`;
2. mobile viewport 375×812: open menu, tab through all dialog links without leaving the dialog, press Escape, assert trigger focus;
3. unauthenticated `/admin` reaches `/admin/login` with labeled email/password controls;
4. log in with `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD`, query the seeded FAQ through `page.context().request`, PATCH a unique answer containing `Date.now()`, poll `/faq` with reloads until the answer is visible, and assert `/api/health` returns `{ status: 'ok' }` with `no-store`.

The mutation test must fail immediately when either credential variable is absent. It must mutate only the uniquely named seeded FAQ.

- [ ] **Step 6: Run the complete disposable production journey**

With a local disposable MongoDB running, execute with explicit disposable values instead of inheriting `.env`:

```bash
export DATABASE_URI=mongodb://127.0.0.1:27017/lolev-beer-e2e
export PAYLOAD_SECRET=e2e-only-payload-secret
export BLOB_READ_WRITE_TOKEN=vercel_blob_rw_e2e_only
export E2E_DISPOSABLE_DATABASE=1
export E2E_ADMIN_EMAIL=release-smoke@example.test
export E2E_ADMIN_PASSWORD=e2e-only-release-smoke-password
pnpm e2e:seed
pnpm build
pnpm test:e2e
```

Expected: all Playwright tests pass against `pnpm start`; failure artifacts are generated only on failure.

- [ ] **Step 7: Commit the browser gate**

```bash
git add package.json pnpm-lock.yaml scripts/e2e-database-guard.ts scripts/seed-e2e.ts playwright.config.ts tests/e2e/release-smoke.spec.ts tests/int/e2e-seed-safety.int.spec.ts .gitignore
git commit -m "test(e2e): cover production release journey"
```

---

### Task 7: Upgrade GitHub Actions and enforce build/E2E gates

**Dependencies:** Task 6.

**Files:**
- Modify: `.github/workflows/ci.yml:1-32`

**Interfaces:**
- Static `checks` job remains the type/lint/Vitest gate.
- New `release-smoke` job depends on `checks`, owns disposable MongoDB, seed, production build, and Playwright.
- Uses current Node-24-capable majors verified from official repositories: `actions/checkout@v7`, `actions/setup-node@v7`, `pnpm/action-setup@v6`, and `actions/upload-artifact@v7`.

- [ ] **Step 1: Update action majors in the existing job**

Replace v4 action references with:

```yaml
- uses: actions/checkout@v7
- uses: pnpm/action-setup@v6
- uses: actions/setup-node@v7
```

Keep `node-version-file: package.json` and `cache: pnpm`.

- [ ] **Step 2: Add the MongoDB-backed release-smoke job**

Add:

```yaml
release-smoke:
  needs: checks
  runs-on: ubuntu-latest
  services:
    mongodb:
      image: mongo:8.0
      ports:
        - 27017:27017
      options: >-
        --health-cmd "mongosh --quiet --eval 'db.adminCommand({ ping: 1 }).ok'"
        --health-interval 10s
        --health-timeout 5s
        --health-retries 10
  env:
    DATABASE_URI: mongodb://127.0.0.1:27017/lolev-beer-ci
    PAYLOAD_SECRET: ci-only-payload-secret-not-for-production
    BLOB_READ_WRITE_TOKEN: vercel_blob_rw_ci_only
    NEXT_PUBLIC_SITE_URL: http://127.0.0.1:3000
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: ci-public-placeholder
    E2E_DISPOSABLE_DATABASE: "1"
    E2E_ADMIN_EMAIL: release-smoke@example.test
    E2E_ADMIN_PASSWORD: ci-only-release-smoke-password
  steps:
    - uses: actions/checkout@v7
    - uses: pnpm/action-setup@v6
    - uses: actions/setup-node@v7
      with:
        node-version-file: package.json
        cache: pnpm
    - run: pnpm install --frozen-lockfile
    - run: pnpm exec playwright install --with-deps chromium
    - run: pnpm e2e:seed
    - run: pnpm build
    - run: pnpm test:e2e
    - uses: actions/upload-artifact@v7
      if: failure()
      with:
        name: playwright-report
        path: |
          playwright-report/
          test-results/
        if-no-files-found: ignore
        retention-days: 7
```

`BLOB_READ_WRITE_TOKEN` is a test placeholder used only to satisfy production-mode configuration; tests must not upload media.

- [ ] **Step 3: Validate workflow syntax and local contracts**

Run:

```bash
pnpm type-check
pnpm test
pnpm build
```

Inspect `.github/workflows/ci.yml` for duplicated install steps, missing `needs`, or production secrets. Confirm only disposable literal credentials appear.

- [ ] **Step 4: Commit the CI gate**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: gate releases on build and browser smoke"
```

---

### Task 8: Synchronize documentation and run final release verification

**Dependencies:** Tasks 1-7.

**Files:**
- Modify: `README.md:1-160`
- Modify: `.env.example`
- Modify: relevant comments/TSDoc in every file changed by Tasks 1-7 if stale

**Interfaces:**
- Documentation describes Next.js 16, required/optional variables, health, Vitest, Playwright, and the retained migration risk exactly as implemented.

- [ ] **Step 1: Update README and environment documentation**

Make these exact content corrections:

- Change Next.js 15 references to Next.js 16.
- Add `pnpm e2e:seed`, `pnpm test:e2e`, and `pnpm test:e2e:install` to Scripts with the disposable-database warning.
- Add `/api/health` behavior and state that it returns no dependency details.
- Replace the migration safety claim with the accepted residual risk and link `docs/operations/production-deploy.md`.
- Remove the empty Google Sheets sync heading from `.env.example`.
- Group `.env.example` into required core, required in production, optional integrations, and public build-time variables.
- Add `E2E_DISPOSABLE_DATABASE`, `E2E_ADMIN_EMAIL`, and `E2E_ADMIN_PASSWORD` only under a clearly marked local/CI test section; use empty values and state they must never target production.

- [ ] **Step 2: Verify comments and docstrings match behavior**

Review only modified files. Ensure:

- Untappd comments no longer say arbitrary absolute URLs are accepted.
- mobile menu comments attribute focus/scroll/Escape behavior to Radix;
- payload config comments explain validated environment values;
- CI seed and health modules have purpose comments;
- README does not claim migrations are transactional or unable to partially apply.

- [ ] **Step 3: Run the complete release gate**

Confirm worktree and branch first:

```bash
pwd
git branch --show-current
git status --short --branch
```

Then point every data-writing command at a disposable local database and run:

```bash
export DATABASE_URI=mongodb://127.0.0.1:27017/lolev-beer-e2e
export PAYLOAD_SECRET=e2e-only-payload-secret
export BLOB_READ_WRITE_TOKEN=vercel_blob_rw_e2e_only
export E2E_DISPOSABLE_DATABASE=1
export E2E_ADMIN_EMAIL=release-smoke@example.test
export E2E_ADMIN_PASSWORD=e2e-only-release-smoke-password
pnpm e2e:seed
pnpm test
pnpm type-check
pnpm lint
pnpm build
pnpm test:e2e
```

Expected:

- 0 failing Vitest files;
- 0 TypeScript errors;
- ESLint exits 0;
- Next.js production build completes;
- all Playwright journeys pass against the built local server.

- [ ] **Step 4: Browser-check the actual local production surface**

At desktop and 375×812 mobile widths verify:

- `/api/health` is 200/no-store;
- primary routes render without overflow or failed resources;
- the mobile menu retains its approved visual layout;
- Tab never leaves the dialog while open;
- Escape closes it and returns focus to the trigger;
- map search has accessible name `Search locations`.

- [ ] **Step 5: Run specialist reviews required by the touched stack**

Request focused reviews of the final diff from:

- TypeScript reviewer for type/async correctness;
- React reviewer for Radix/Framer composition and hooks;
- security reviewer for SSRF, seed guard, health disclosure, and CI credential boundaries;
- accessibility reviewer for focus containment/restoration and accessible names.

Apply high-confidence findings, then rerun the affected targeted tests and full `pnpm type-check`.

- [ ] **Step 6: Commit documentation and any final corrections**

Re-check branch and status before committing:

```bash
git add README.md .env.example
git commit -m "docs: update production release guidance"
```

If review corrections touched earlier files, include them in the logical commit they belong to or make one narrowly named follow-up commit; never hide behavior changes in the docs commit.

- [ ] **Step 7: Confirm final repository state**

Run:

```bash
git status --short --branch
git log --oneline --decorate -8
```

Expected: clean `fix/production-audit-remediation` worktree with the specification commit and one logical commit per implementation boundary. Do not push or open a PR unless explicitly requested.

## Parallelism and dependency order

- Tasks 1, 2, 3, 4, and 5 are independently reviewable and may run in parallel only if agents own disjoint files.
- Task 6 depends on Tasks 2-4 because its browser journey verifies health and accessibility behavior.
- Task 7 depends on Task 6 because CI consumes its scripts, seed, config, and tests.
- Task 8 runs last and owns final documentation synchronization, specialist review, and complete verification.
- The integration owner resolves any shared `package.json`, README, or workflow conflicts in the remediation worktree before the full gate.
