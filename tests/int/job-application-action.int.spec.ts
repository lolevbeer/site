/**
 * Public job apply: inactive slug is rejected; honeypot does not write.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const afterFns: Array<() => Promise<void>> = []
const create = vi.fn()
const find = vi.fn()
const update = vi.fn()
const slackApi = vi.fn()

vi.mock('next/server', () => ({
  after: (fn: () => Promise<void>) => {
    afterFns.push(fn)
  },
}))

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (name: string) => (name === 'x-forwarded-for' ? '203.0.113.9' : null),
  }),
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({ find, create, update })),
}))

vi.mock('@/src/payload.config', () => ({ default: {} }))

vi.mock('@/src/utils/slack-api', () => ({
  slackApi: (...args: unknown[]) => slackApi(...args),
}))

vi.mock('@/lib/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock('@/lib/config/server-env', () => ({
  readServerEnvironment: () => ({ payloadSecret: 'test-secret' }),
}))

import { submitJobApplication } from '@/src/actions/job-application'
import { emptyJobApplication } from '@/lib/jobs/application'
import { resetPublicFormRateLimit } from '@/lib/public-forms/rate-limit'

function valid() {
  return {
    ...emptyJobApplication('bartender'),
    name: 'Alex Rivera',
    email: 'alex@example.com',
    phone: '412-555-0100',
    message: 'I have poured at two taprooms and want to work nights on Butler Street.',
  }
}

describe('submitJobApplication', () => {
  beforeEach(() => {
    afterFns.length = 0
    create.mockReset()
    find.mockReset()
    update.mockReset()
    slackApi.mockReset()
    resetPublicFormRateLimit()
    create.mockResolvedValue({ id: 'app-1' })
    update.mockResolvedValue({})
    slackApi.mockResolvedValue(true)
  })

  it('does not write when the honeypot is filled', async () => {
    find.mockResolvedValue({ docs: [{ id: 'job-1', title: 'Bartender', location: { name: 'Lawrenceville' } }] })
    const result = await submitJobApplication({ ...valid(), companyUrlHp: 'bot' })
    expect(result).toEqual({ ok: true })
    expect(create).not.toHaveBeenCalled()
  })

  it('rejects an inactive or missing opening', async () => {
    find.mockResolvedValue({ docs: [] })
    const result = await submitJobApplication(valid())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/no longer listed/)
    expect(create).not.toHaveBeenCalled()
  })
})
