import { test, expect } from '@playwright/test'

test.describe('Frontend', () => {
  test('homepage loads with correct title', async ({ page }) => {
    await page.goto('http://localhost:3000')

    await expect(page).toHaveTitle(/Lolev Beer/)
  })
})
