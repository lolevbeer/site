/** Exercises the disposable production release gate in a real Chromium browser. */
import { expect, test, type APIRequestContext } from '@playwright/test'

const fixtureQuestion = 'Production readiness fixture'

const publicRoutes = [
  ['/', 'Lolev Beer'],
  ['/beer-map', 'Find Lolev Beer near you'],
  ['/beer', 'Our Beers'],
  ['/food', /^Food(?: at .+)?$/],
  ['/events', /^Events(?: at .+)?$/],
  ['/about', 'About Lolev'],
  ['/faq', 'Frequently Asked Questions'],
] as const

/** Routes with no browser-heading test above; raw-HTML checks only. */
const rawOnlyRoutes = [
  ['/donate', 'Donations'],
  ['/jobs', 'Jobs'],
  ['/privacy', 'Privacy Policy'],
  ['/terms', 'Terms of Service'],
  ['/accessibility', 'Accessibility Statement'],
] as const

/** Read-only checks of the server's initial HTML (raw responses, no hydration). */
async function rawHtml(request: APIRequestContext, path: string) {
  const response = await request.get(path)
  expect(response.status(), `${path} status`).toBe(200)
  return response.text()
}

/** Every JSON-LD node, with @context and @type validated; @graph blocks are flattened. */
function jsonLdNodes(html: string, path: string) {
  const scripts = html.matchAll(
    /<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g,
  )
  return [...scripts].flatMap(([, raw]) => {
    const block = JSON.parse(raw) as { '@context'?: string; '@graph'?: object[] } & object
    expect(block['@context'], `${path} JSON-LD @context`).toBe('https://schema.org')
    const nodes = (block['@graph'] ?? [block]) as Array<{ '@type'?: string; url?: string }>
    for (const node of nodes) expect(node['@type'], `${path} JSON-LD @type`).toBeTruthy()
    return nodes as Array<{ '@type': string; url?: string }>
  })
}

/** Exactly one h1 (anchored match), valid JSON-LD, and `breadcrumbs` navs plus BreadcrumbList schemas. */
function expectPage(html: string, path: string, h1: string | RegExp, breadcrumbs: 0 | 1) {
  const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map(([, inner]) =>
    inner.replace(/<[^>]+>/g, '').trim(),
  )
  expect(headings, `${path} h1`).toHaveLength(1)
  if (typeof h1 === 'string') expect(headings[0], `${path} h1`).toBe(h1)
  else expect(headings[0], `${path} h1`).toMatch(h1)

  const types = jsonLdNodes(html, path).map((node) => node['@type'])
  expect(types.length, `${path} JSON-LD`).toBeGreaterThan(0)
  expect(
    types.filter((type) => type === 'BreadcrumbList'),
    `${path} schema`,
  ).toHaveLength(breadcrumbs)
  expect((html.match(/aria-label="breadcrumb"/gi) ?? []).length, `${path} nav`).toBe(breadcrumbs)
  return types
}

/** Location page paths, taken from the Brewery nodes the home page publishes. */
function locationPaths(html: string) {
  const urls = jsonLdNodes(html, '/')
    .filter((node) => node['@type'] === 'Brewery' && node.url)
    .map((node) => new URL(node.url!).pathname)
  return [...new Set(urls)].filter((path) => path !== '/')
}

/** Single-segment links such as /beer/aardwolf (dotted names are files). */
function linkedSlugs(html: string, prefix: string) {
  const links = html.matchAll(new RegExp(`href="${prefix}([^"/?#.]+)"`, 'g'))
  return [...new Set([...links].map(([, slug]) => slug))]
}

test.describe('raw initial HTML (read-only)', () => {
  for (const [path, h1] of [...publicRoutes, ...rawOnlyRoutes]) {
    test(`${path} ships its heading, JSON-LD and breadcrumb in the first response`, async ({
      request,
    }) => {
      expectPage(await rawHtml(request, path), path, h1, path === '/' ? 0 : 1)
    })
  }

  test('location pages listed in the home Brewery schema ship Brewery/WebPage schema and one breadcrumb', async ({
    request,
  }) => {
    const paths = locationPaths(await rawHtml(request, '/'))
    expect(paths.length, 'Brewery locations in / JSON-LD').toBeGreaterThan(0)

    for (const path of paths) {
      const types = expectPage(await rawHtml(request, path), path, /^Lolev /, 1)
      expect(types, `${path} schema`).toEqual(expect.arrayContaining(['Brewery', 'WebPage']))
    }
  })

  test('a discovered beer page ships its Product schema and one breadcrumb', async ({
    request,
  }) => {
    const [slug] = linkedSlugs(await rawHtml(request, '/beer'), '/beer/')
    expect(slug, 'beer link on /beer').toBeTruthy()

    const types = expectPage(await rawHtml(request, `/beer/${slug}`), `/beer/${slug}`, /^\S/, 1)
    expect(types).toContain('Product')
  })

  test('a discovered job page ships one breadcrumb', async ({ request }) => {
    const [slug] = linkedSlugs(await rawHtml(request, '/jobs'), '/jobs/')
    test.skip(!slug, 'Missing fixture: no job page is linked from /jobs')

    expectPage(await rawHtml(request, `/jobs/${slug}`), `/jobs/${slug}`, /^\S/, 1)
  })
})

test('public routes render their expected headings', async ({ page }) => {
  for (const [route, heading] of publicRoutes) {
    await page.goto(route)
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
  }
})

test('the mobile menu keeps keyboard focus inside its dialog and restores the trigger', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')

  const menuTrigger = page.getByRole('button', { name: 'Open menu' })
  await menuTrigger.click()

  const dialog = page.getByRole('dialog', { name: 'Mobile navigation menu' })
  await expect(dialog).toBeVisible()
  const links = dialog.getByRole('link')
  const linkCount = await links.count()
  const focusedLinks = new Set<number>()

  for (let tab = 0; tab <= linkCount; tab += 1) {
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true)

    for (let index = 0; index < linkCount; index += 1) {
      if (await links.nth(index).evaluate((element) => element === document.activeElement)) {
        focusedLinks.add(index)
      }
    }
  }

  expect(focusedLinks).toEqual(new Set(Array.from({ length: linkCount }, (_, index) => index)))

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(menuTrigger).toBeFocused()
})

test('the admin route redirects unauthenticated visitors to its labeled login form', async ({
  page,
}) => {
  await page.goto('/admin')

  await expect(page).toHaveURL(/\/admin\/login/)
  await expect(page.getByLabel(/email/i)).toBeVisible()
  // Exact: Payload 4's login form also has a "Show password" toggle button.
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
})

test('an authenticated administrator can update only the seeded FAQ and observe the revalidated page', async ({
  page,
  request: unauthenticatedRequest,
}) => {
  const email = process.env.E2E_ADMIN_EMAIL
  const password = process.env.E2E_ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error(
      'E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required for the mutation smoke test',
    )
  }

  const request = page.context().request
  const findFixture = await request.get('/api/faqs', {
    params: { 'where[question][equals]': fixtureQuestion },
  })
  expect(findFixture.ok()).toBe(true)

  const fixture = (await findFixture.json()) as { docs: Array<{ id: string; question: string }> }
  expect(fixture.docs).toHaveLength(1)
  expect(fixture.docs[0]).toMatchObject({ question: fixtureQuestion })

  const answer = `Release-smoke answer ${Date.now()}`
  const rejectedUpdate = await unauthenticatedRequest.patch(`/api/faqs/${fixture.docs[0].id}`, {
    data: { answer },
  })
  expect([401, 403]).toContain(rejectedUpdate.status())

  const login = await request.post('/api/users/login', { data: { email, password } })
  expect(login.ok()).toBe(true)

  const { token } = (await login.json()) as { token?: string }
  if (!token) throw new Error('Payload login response did not include an authentication token')

  const authorization = { Authorization: `Bearer ${token}` }
  const currentUser = await request.get('/api/users/me', { headers: authorization })
  expect(currentUser.ok()).toBe(true)
  await expect(currentUser.json()).resolves.toMatchObject({ user: { email } })

  const updateFixture = await request.patch(`/api/faqs/${fixture.docs[0].id}`, {
    data: { answer },
    headers: authorization,
  })
  expect(updateFixture.ok()).toBe(true)

  await page.goto('/faq')
  await expect
    .poll(
      async () => {
        await page.reload()
        const question = page.getByRole('button', { name: fixtureQuestion })
        if ((await question.count()) !== 1) return false

        await question.click()
        return page.getByText(answer).isVisible()
      },
      { timeout: 30_000 },
    )
    .toBe(true)

  const health = await request.get('/api/health')
  expect(health.status()).toBe(200)
  expect(health.headers()['cache-control']).toBe('no-store')
  await expect(health.json()).resolves.toEqual({ status: 'ok' })

  const healthHead = await request.head('/api/health')
  expect(healthHead.status()).toBe(200)
  expect(healthHead.headers()['cache-control']).toBe('no-store')
  expect(await healthHead.text()).toBe('')
})
