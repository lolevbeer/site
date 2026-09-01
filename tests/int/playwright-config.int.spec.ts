/** Verifies that the release smoke server owns an isolated loopback port. */
import { describe, expect, it } from 'vitest'
import config from '@/playwright.config'

describe('Playwright release configuration', () => {
  it('uses the dedicated loopback release port without reusing another server', () => {
    expect(config.use?.baseURL).toBe('http://127.0.0.1:3100')
    expect(config.webServer).toMatchObject({
      command: 'pnpm start --hostname 127.0.0.1 --port 3100',
      url: 'http://127.0.0.1:3100/api/health',
      reuseExistingServer: false,
    })
  })
})
