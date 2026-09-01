/** Playwright release-smoke configuration for a built local production server. */
import { defineConfig, devices } from '@playwright/test'

const releaseOrigin = 'http://127.0.0.1:3100'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: releaseOrigin,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm start --hostname 127.0.0.1 --port 3100',
    url: `${releaseOrigin}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
