/**
 * The admin panel's "Forgot password?" form sends the reset link two ways:
 * Users.auth.forgotPassword.generateEmailHTML DMs it over Slack and returns it
 * as the email body (sent through Resend when RESEND_API_KEY is set).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const slackApi = vi.fn()
vi.mock('@/src/utils/slack-api', () => ({
  slackApi: (...args: unknown[]) => slackApi(...args),
}))

const { Users } = await import('@/src/collections/Users')
const auth = Users.auth as Exclude<typeof Users.auth, boolean | undefined>
const generate = auth.forgotPassword!.generateEmailHTML!

describe('admin forgot password → Slack DM', () => {
  beforeEach(() => slackApi.mockReset())

  it('DMs the reset link to the linked Slack account', async () => {
    await generate({ req: {} as never, token: 'abc123', user: { slackUserId: 'U123' } })
    expect(slackApi).toHaveBeenCalledWith(
      'chat.postMessage',
      expect.objectContaining({
        channel: 'U123',
        text: expect.stringContaining('/admin/reset/abc123'),
      }),
    )
  })

  it('skips the DM but still returns the email link when no Slack user is linked', async () => {
    const html = await generate({ req: {} as never, token: 'abc123', user: { slackUserId: null } })
    expect(slackApi).not.toHaveBeenCalled()
    expect(html).toContain('/admin/reset/abc123"')
  })
})
