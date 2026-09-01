/** Core server environment validation fails closed without exposing secret values. */
import { describe, expect, it } from 'vitest'
import { readServerEnvironment, ServerEnvironmentError } from '@/lib/config/server-env'

const valid = {
  NODE_ENV: 'development',
  DATABASE_URI: 'mongodb://127.0.0.1/lolev-test',
  PAYLOAD_SECRET: 'test-secret-that-is-not-a-placeholder',
} satisfies NodeJS.ProcessEnv

describe('readServerEnvironment', () => {
  it.each(['DATABASE_URI', 'PAYLOAD_SECRET'])('requires %s', (name) => {
    const env = { ...valid, [name]: '' }
    expect(() => readServerEnvironment(env)).toThrow(ServerEnvironmentError)
    expect(() => readServerEnvironment(env)).toThrow(name)
  })

  it('rejects the documented Payload placeholder', () => {
    expect(() => readServerEnvironment({ ...valid, PAYLOAD_SECRET: 'YOUR_SECRET_HERE' })).toThrow(
      'PAYLOAD_SECRET',
    )
  })

  it('requires Blob storage in production', () => {
    expect(() => readServerEnvironment({ ...valid, NODE_ENV: 'production' })).toThrow(
      'BLOB_READ_WRITE_TOKEN',
    )
  })

  it.each([
    { SLACK_SIGNING_SECRET: 'signing-only' },
    { SLACK_BOT_TOKEN: 'bot-only' },
  ])('requires Slack credentials as a pair', (partialSlackEnvironment) => {
    expect(() => readServerEnvironment({ ...valid, ...partialSlackEnvironment })).toThrow(
      'SLACK_SIGNING_SECRET and SLACK_BOT_TOKEN',
    )
  })

  it('never includes configured secret values in validation errors', () => {
    const databaseUri = 'mongodb://user:database-secret@127.0.0.1/lolev-test'
    const payloadSecret = 'payload-secret-value'

    expect(() =>
      readServerEnvironment({ ...valid, DATABASE_URI: databaseUri, PAYLOAD_SECRET: '' }),
    ).toThrow(/^(?!.*database-secret)(?!.*payload-secret).*PAYLOAD_SECRET/)
  })

  it('returns validated values without changing optional integrations', () => {
    expect(readServerEnvironment(valid)).toMatchObject({
      databaseUri: valid.DATABASE_URI,
      payloadSecret: valid.PAYLOAD_SECRET,
      blobReadWriteToken: undefined,
    })
  })
})
