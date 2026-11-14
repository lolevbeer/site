/**
 * Admin preview for Beers and Menus (#376): the preview link is a full URL, the
 * live preview pane loads the staff-only draft page, that page reads the draft
 * as the signed-in viewer, and it is the only page allowed inside a frame.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
// @ts-expect-error -- Next ships its compiled path-to-regexp without types
import { pathToRegexp } from 'next/dist/compiled/path-to-regexp'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: vi.fn(),
}))
vi.mock('@/lib/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const find = vi.fn()
const auth = vi.fn()
vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  getPayload: vi.fn(async () => ({ find, auth })),
}))
vi.mock('@/src/payload.config', () => ({ default: {} }))

import nextConfig from '../../next.config.mjs'
import { getDraftMenuForViewer } from '@/lib/utils/payload-api'
import { getBaseUrl } from '@/lib/utils/get-base-url'
import { Beers } from '@/src/collections/Beers'
import { Menus } from '@/src/collections/Menus'

type HeaderRule = { source: string; headers: { key: string; value: string }[] }

/** Values of `key` from every rule whose source matches `path`, in rule order. */
function headerValues(rules: HeaderRule[], path: string, key: string): string[] {
  return rules
    .filter((rule) => pathToRegexp(rule.source).test(path))
    .flatMap((rule) => rule.headers.filter((h) => h.key === key).map((h) => h.value))
}

beforeEach(() => {
  find.mockReset()
  auth.mockReset()
})

describe('preview links', () => {
  // Payload's copy button puts this string on the clipboard, so it must be a full URL.
  it('are full URLs on the site the admin is being used on', () => {
    const preview = (collection: typeof Beers, doc: Record<string, unknown>, origin?: string) =>
      (
        collection.admin!.preview as (
          doc: Record<string, unknown>,
          options: { req: { origin?: string } },
        ) => string
      )(doc, { req: { origin } })
    const origin = 'https://preview.example'
    expect(preview(Beers, { slug: 'lupula' }, origin)).toBe(`${origin}/beer/lupula`)
    expect(preview(Menus, { url: 'l-draft' }, origin)).toBe(`${origin}/m/l-draft`)
    // No request origin: fall back to the configured site address.
    expect(preview(Menus, { url: 'l-draft' })).toBe(`${getBaseUrl()}/m/l-draft`)
    expect(preview(Beers, {}, origin)).toBe('')
    expect(preview(Menus, {}, origin)).toBe('')
  })

  it('point the live preview pane at the draft page on the same origin', () => {
    const url = Menus.admin!.livePreview!.url as (args: {
      data: Record<string, unknown>
    }) => unknown
    expect(url({ data: { url: 'l-draft' } })).toBe('/m/l-draft/preview')
    expect(url({ data: {} })).toBeNull()
  })
})

describe('getDraftMenuForViewer', () => {
  it('returns nothing to anonymous visitors without querying', async () => {
    auth.mockResolvedValue({ user: null })
    expect(await getDraftMenuForViewer('l-draft', new Headers())).toBeNull()
    expect(find).not.toHaveBeenCalled()
  })

  it('reads the latest draft as the signed-in viewer, under access control', async () => {
    const user = { id: 'u1' }
    const menu = { id: 'm1', url: 'l-draft' }
    auth.mockResolvedValue({ user })
    find.mockResolvedValue({ docs: [menu] })
    const headers = new Headers({ cookie: 'payload-token=x' })

    expect(await getDraftMenuForViewer('l-draft', headers)).toBe(menu)
    expect(auth).toHaveBeenCalledWith({ headers })
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'menus',
        draft: true,
        overrideAccess: false,
        user,
        where: { url: { equals: 'l-draft' } },
      }),
    )
  })
})

describe('framing', () => {
  const { headers: vercelRules } = JSON.parse(
    readFileSync(join(process.cwd(), 'vercel.json'), 'utf8'),
  ) as { headers: HeaderRule[] }

  it.each(['/', '/admin', '/m/l-draft', '/m/l-draft/preview/more', '/beer/lupula'])(
    'is denied on %s',
    (path) => {
      expect(headerValues(vercelRules, path, 'X-Frame-Options')).toEqual(['DENY'])
    },
  )

  it('is same-origin only on the draft menu page, so the admin can frame it', async () => {
    expect(headerValues(vercelRules, '/m/l-draft/preview', 'X-Frame-Options')).toEqual([
      'SAMEORIGIN',
    ])
    // Next sends the last matching value for a repeated key.
    const nextRules = (await nextConfig.headers!()) as HeaderRule[]
    const csp = headerValues(nextRules, '/m/l-draft/preview', 'Content-Security-Policy-Report-Only')
    expect(csp.at(-1)).toContain("frame-ancestors 'self'")
    expect(csp.at(-1)).not.toContain("frame-ancestors 'none'")
  })
})
