// @vitest-environment node
// (jsdom's TextEncoder makes byte arrays the JWT signer does not recognise.)
/**
 * Single sign-on for our other apps (src/plugins/sso.ts). Walks the sign-in
 * end to end through the real endpoint handlers with a stand-in request, so a
 * Payload upgrade that changes the OAuth flow fails here instead of in an app.
 */
import { createHash, createHmac, randomBytes } from 'node:crypto'
import type { PayloadRequest, SanitizedConfig } from 'payload'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const SECRET = 'sso-test-signing-secret'
const CALLBACK = 'https://staff.example.com/auth/callback'
/** A callback that is not on the allowlist. */
const EVIL_CALLBACK = 'https://evil.example/callback'
const ORIGIN = 'https://lolev.test'
const staff = {
  id: 'u1',
  collection: 'users',
  email: 'pat@example.com',
  name: 'Pat',
  roles: ['bartender'],
}

let config: SanitizedConfig

beforeAll(async () => {
  // Building the config only validates these; nothing connects to the database.
  vi.stubEnv('DATABASE_URI', process.env.DATABASE_URI || 'mongodb://127.0.0.1:27017/config-test')
  vi.stubEnv('PAYLOAD_SECRET', process.env.PAYLOAD_SECRET || 'config-test-secret')
  config = await (await import('@/src/payload.config')).default
}, 60_000)

beforeEach(() => {
  vi.stubEnv('SSO_REDIRECT_URIS', CALLBACK)
  vi.stubEnv('SSO_TOKEN_SECRET', SECRET)
})

type CallInit = {
  body?: string
  headers?: Record<string, string>
  search?: string
  user?: typeof staff | null
}

/** Runs one endpoint handler the way Payload would, minus the database and real encryption. */
function call(method: 'get' | 'post', path: string, init: CallInit = {}) {
  const endpoint = config.endpoints.find((e) => e.method === method && e.path === path)
  if (!endpoint) throw new Error(`No ${method} ${path} endpoint`)
  const req = Object.assign(
    new Request(`${ORIGIN}/api${path}${init.search ?? ''}`, {
      method: method.toUpperCase(),
      body: init.body,
      headers: init.headers,
    }),
    {
      // The plugin seals what it hands the client with these; the cipher is Payload's concern.
      payload: {
        config,
        encrypt: (text: string) => `v1:${Buffer.from(text).toString('base64url')}`,
        decrypt: (value: string) => Buffer.from(value.slice(3), 'base64url').toString(),
      },
      user: init.user ?? null,
      context: {},
      t: (key: string) => key,
    },
  )
  return endpoint.handler(req as unknown as PayloadRequest)
}

/** An app registers itself, then sends a signed-in staff member to the authorize endpoint. */
async function startSignIn({
  redirectURI = CALLBACK,
  omitRedirectURI = false,
  headers,
  params,
}: {
  redirectURI?: string
  /** Register the callback but leave it out of the authorize request. */
  omitRedirectURI?: boolean
  headers?: Record<string, string>
  params?: Record<string, string>
} = {}) {
  const registered = await call('post', '/mcp/oauth/register', {
    body: JSON.stringify({ client_name: 'Staff app', redirect_uris: [redirectURI] }),
  })
  const { client_id } = (await registered.json()) as { client_id: string }
  const verifier = randomBytes(32).toString('base64url')
  const search = new URLSearchParams({
    client_id,
    response_type: 'code',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    state: 'xyz',
    ...(omitRedirectURI ? {} : { redirect_uri: redirectURI }),
    ...params,
  })
  const authorize = await call('get', '/mcp/oauth/authorize', {
    headers,
    search: `?${search}`,
    user: staff,
  })
  return { authorize, client_id, verifier }
}

/** The staff member clicks Allow on the consent page. */
function clickAllow(authorize: Response) {
  const consent = new URL(authorize.headers.get('Location')!, ORIGIN).searchParams.get('consent')!
  return call('post', '/mcp/oauth/authorize', {
    body: new URLSearchParams({ consent, decision: 'allow' }).toString(),
    user: staff,
  })
}

describe('single sign-on for other apps', () => {
  it('signs a staff member in to an allowlisted app with a short-lived identity token', async () => {
    const { authorize, client_id, verifier } = await startSignIn()
    expect(authorize.status).toBe(302)

    const back = new URL((await clickAllow(authorize)).headers.get('Location')!)
    expect(back.origin + back.pathname).toBe(CALLBACK)
    expect(back.searchParams.get('state')).toBe('xyz')

    const exchanged = await call('post', '/mcp/oauth/token', {
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id,
        code: back.searchParams.get('code')!,
        code_verifier: verifier,
      }).toString(),
    })
    const tokens = (await exchanged.json()) as Record<string, unknown>
    expect(tokens).toMatchObject({ token_type: 'Bearer', expires_in: 300 })
    expect(tokens.refresh_token).toBeUndefined()

    // The app checks the signature with the shared SSO_TOKEN_SECRET (HS256).
    const [header, body, signature] = (tokens.access_token as string).split('.')
    expect(createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url')).toBe(
      signature,
    )
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString())
    expect(claims).toMatchObject({
      sub: 'u1',
      email: 'pat@example.com',
      name: 'Pat',
      roles: ['bartender'],
    })
    expect(claims.exp - claims.iat).toBe(300)
    // Payload only accepts login tokens that name an `id` and `collection`, so
    // this one can never open the admin or the REST API.
    expect(claims).not.toHaveProperty('id')
    expect(claims).not.toHaveProperty('collection')
  })

  it('refuses a callback URL that is not on the allowlist', async () => {
    const { authorize } = await startSignIn({ redirectURI: EVIL_CALLBACK })
    expect(authorize.status).toBe(400)
    expect(authorize.headers.get('Location')).toBeNull()
  })

  it('refuses a request that leaves the callback URL out', async () => {
    // Payload would fall back to the one URL the client registered, unchecked.
    const { authorize } = await startSignIn({
      redirectURI: EVIL_CALLBACK,
      omitRedirectURI: true,
    })
    expect(authorize.status).toBe(400)
  })

  describe('arriving from the other app (a cross-site request)', () => {
    const crossSite = { 'Sec-Fetch-Site': 'cross-site' }

    it('reloads once through our own page, so the staff member’s session counts', async () => {
      // Payload ignores the session cookie on cross-site requests; a reload
      // from our own page is same-origin.
      const { authorize } = await startSignIn({ headers: crossSite })
      expect(authorize.status).toBe(200)
      expect(authorize.headers.get('Content-Type')).toContain('text/html')
      expect(authorize.headers.get('Location')).toBeNull()
      const html = await authorize.text()
      expect(html).toContain('http-equiv="refresh"')
      expect(html).toContain('url=/api/mcp/oauth/authorize?')
      expect(html).toContain('sso_reloaded=1')
    })

    it('does not reload twice', async () => {
      const { authorize } = await startSignIn({
        headers: crossSite,
        params: { sso_reloaded: '1' },
      })
      expect(authorize.status).toBe(302)
    })

    it('still refuses a callback URL that is not on the allowlist', async () => {
      const { authorize } = await startSignIn({
        redirectURI: EVIL_CALLBACK,
        headers: crossSite,
      })
      expect(authorize.status).toBe(400)
    })
  })

  it('is off until SSO_REDIRECT_URIS is set', async () => {
    vi.stubEnv('SSO_REDIRECT_URIS', '')
    expect((await startSignIn()).authorize.status).toBe(400)
  })

  it('issues nothing without SSO_TOKEN_SECRET', async () => {
    vi.stubEnv('SSO_TOKEN_SECRET', '')
    const { authorize } = await startSignIn()
    await expect(clickAllow(authorize)).rejects.toThrow('Single sign-on is not configured')
  })

  it('offers no MCP tools, even to a signed-in user', async () => {
    const response = await call('post', '/mcp', {
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      user: staff,
    })
    expect(response.status).toBe(401)
  })
})
