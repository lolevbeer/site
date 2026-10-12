import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/config/server-env', () => ({
  readServerEnvironment: () => ({ slackBotToken: 'xoxb-test' }),
}))

import { isAllowedSlackHostname, slackApi } from '@/src/utils/slack-api'

describe('isAllowedSlackHostname', () => {
  it('allows slack.com and subdomains only', () => {
    expect(isAllowedSlackHostname('slack.com')).toBe(true)
    expect(isAllowedSlackHostname('hooks.slack.com')).toBe(true)
    expect(isAllowedSlackHostname('notslack.com')).toBe(false)
    expect(isAllowedSlackHostname('slack.com.evil.test')).toBe(false)
  })
})

describe('slackApi method names', () => {
  afterEach(() => vi.unstubAllGlobals())

  // Every method name the codebase calls; all other specs mock slackApi away.
  it.each(['chat.postMessage', 'views.open', 'views.update'])('calls %s', async (method) => {
    const fetch = vi.fn(async () => new Response('{"ok":true}'))
    vi.stubGlobal('fetch', fetch)
    expect(await slackApi(method, {})).toBe(true)
    expect(fetch).toHaveBeenCalledWith(`https://slack.com/api/${method}`, expect.anything())
  })

  it('rejects malformed method names without calling Slack', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect(await slackApi('../chat.postMessage', {})).toBe(false)
    expect(await slackApi('chat', {})).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })
})
