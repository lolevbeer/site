/**
 * The check beside a Location's Google place ID: admins only; asks Google
 * Business Profile which profiles the signed-in manager can see and reports
 * the one with that place ID (name and address), or why none was found.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.fn()
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ auth })) }))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@payload-config', () => ({ default: {} }))

import { checkGooglePlaceId } from '@/src/actions/google-place-check'

const ENV = [
  'GOOGLE_BUSINESS_CLIENT_ID',
  'GOOGLE_BUSINESS_CLIENT_SECRET',
  'GOOGLE_BUSINESS_REFRESH_TOKEN',
]
const saved = Object.fromEntries(ENV.map((key) => [key, process.env[key]]))
const fetchMock = vi.fn()

const profiles = [
  {
    title: 'Lolev Beer',
    metadata: { placeId: 'place-1' },
    storefrontAddress: { addressLines: ['5247 Butler St', ''], locality: 'Pittsburgh' },
    regularHours: { periods: [{ openDay: 'MONDAY', closeDay: 'MONDAY' }] },
  },
  {
    title: 'Lolev Zelienople',
    metadata: { placeId: 'place-2' },
    regularHours: { periods: [{ openDay: 'MONDAY', closeDay: 'MONDAY' }] },
  },
  { title: 'No hours yet', metadata: { placeId: 'place-3' } },
]

/** Google signs the action in, then answers the locations call with `status`. */
const googleReplies = (status = 200) =>
  fetchMock.mockImplementation(async (url: string) =>
    url.startsWith('https://oauth2.googleapis.com/')
      ? new Response(JSON.stringify({ access_token: 'access' }))
      : new Response(JSON.stringify({ locations: profiles }), { status }),
  )

beforeEach(() => {
  auth.mockReset()
  auth.mockResolvedValue({ user: { id: 'a', roles: ['admin'] } })
  for (const key of ENV) process.env[key] = 'set'
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  googleReplies()
})

afterEach(() => {
  vi.unstubAllGlobals()
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('checkGooglePlaceId', () => {
  it('rejects anonymous callers and non-admins without calling Google', async () => {
    auth.mockResolvedValueOnce({ user: null })
    expect(await checkGooglePlaceId('place-1')).toEqual({ ok: false, reason: 'forbidden' })
    auth.mockResolvedValueOnce({ user: { id: 'b', roles: ['bartender'] } })
    expect(await checkGooglePlaceId('place-1')).toEqual({ ok: false, reason: 'forbidden' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns the name and address of the profile with that place ID', async () => {
    expect(await checkGooglePlaceId(' place-1 ')).toEqual({
      ok: true,
      title: 'Lolev Beer',
      address: '5247 Butler St, Pittsburgh',
    })
  })

  it('returns a profile that has no address', async () => {
    expect(await checkGooglePlaceId('place-2')).toEqual({
      ok: true,
      title: 'Lolev Zelienople',
      address: '',
    })
  })

  it('says when no managed profile has that place ID', async () => {
    expect(await checkGooglePlaceId('ChIJ-someone-else')).toEqual({
      ok: false,
      reason: 'not-found',
    })
  })

  it('says when the Google sign-in is not set up on this server', async () => {
    delete process.env.GOOGLE_BUSINESS_REFRESH_TOKEN
    expect(await checkGooglePlaceId('place-1')).toEqual({ ok: false, reason: 'not-configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('says when the profile has no regular hours for the nightly check to read', async () => {
    expect(await checkGooglePlaceId('place-3')).toEqual({ ok: false, reason: 'no-hours' })
  })

  it("passes on Google's reason when it rejects the request", async () => {
    fetchMock.mockResolvedValue(new Response('{"error":"invalid_grant"}', { status: 400 }))
    expect(await checkGooglePlaceId('place-1')).toEqual({
      ok: false,
      reason: 'rejected',
      detail: 'HTTP 400: invalid_grant',
    })
  })

  it('says when Google cannot be reached', async () => {
    googleReplies(503)
    expect(await checkGooglePlaceId('place-1')).toEqual({ ok: false, reason: 'unreachable' })
    fetchMock.mockRejectedValue(new Error('timeout'))
    expect(await checkGooglePlaceId('place-1')).toEqual({ ok: false, reason: 'unreachable' })
  })
})
