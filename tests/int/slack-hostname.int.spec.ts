import { describe, expect, it } from 'vitest'
import { isAllowedSlackHostname } from '@/src/utils/slack-api'

describe('isAllowedSlackHostname', () => {
  it('allows slack.com and subdomains only', () => {
    expect(isAllowedSlackHostname('slack.com')).toBe(true)
    expect(isAllowedSlackHostname('hooks.slack.com')).toBe(true)
    expect(isAllowedSlackHostname('notslack.com')).toBe(false)
    expect(isAllowedSlackHostname('slack.com.evil.test')).toBe(false)
  })
})
