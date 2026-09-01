/** Exercises the disposable production release gate in a real Chromium browser. */
import { expect, test } from '@playwright/test'

const fixtureQuestion = 'Production readiness fixture'

const publicRoutes = [
  ['/', 'Lolev Beer'],
  ['/beer-map', 'Where to find us'],
  ['/beer', 'Our Beers'],
  ['/food', 'Food'],
  ['/events', 'Events'],
  ['/about', 'About Lolev'],
  ['/faq', 'Frequently Asked Questions'],
] as const

test('public routes render their expected headings', async ({ page }) => {
  for (const [route, heading] of publicRoutes) {
    await page.goto(route)
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
  }
})

test('the mobile menu keeps keyboard focus inside its dialog and restores the trigger', async ({ page }) => {
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

test('the admin route redirects unauthenticated visitors to its labeled login form', async ({ page }) => {
  await page.goto('/admin')

  await expect(page).toHaveURL(/\/admin\/login/)
  await expect(page.getByLabel(/email/i)).toBeVisible()
  await expect(page.getByLabel(/password/i)).toBeVisible()
})

test('an authenticated administrator can update only the seeded FAQ and observe the revalidated page', async ({
  page,
  request: unauthenticatedRequest,
}) => {
  const email = process.env.E2E_ADMIN_EMAIL
  const password = process.env.E2E_ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error('E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required for the mutation smoke test')
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

  const currentUser = await request.get('/api/users/me')
  expect(currentUser.ok()).toBe(true)
  await expect(currentUser.json()).resolves.toMatchObject({ user: { email } })

  const updateFixture = await request.patch(`/api/faqs/${fixture.docs[0].id}`, { data: { answer } })
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
})
