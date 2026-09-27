/**
 * The admin panel's "Forgot password?" form has no email service behind it,
 * so Users.auth.forgotPassword.generateEmailHTML DMs the reset link over Slack.
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

  it('sends nothing when the account has no linked Slack user', async () => {
    await generate({ req: {} as never, token: 'abc123', user: { slackUserId: null } })
    expect(slackApi).not.toHaveBeenCalled()
  })
})
