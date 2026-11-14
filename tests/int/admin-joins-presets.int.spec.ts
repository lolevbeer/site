/**
 * Admin conveniences: a job opening lists its applications (#372) and the three
 * inbox lists have shared saved filters (#374). The join runs on every read of
 * a job unless a query opts out, so the public job reads must skip it.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Field, SanitizedConfig } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

let config: SanitizedConfig

beforeAll(async () => {
  // Building the config only validates these; nothing connects to the database.
  vi.stubEnv('DATABASE_URI', process.env.DATABASE_URI || 'mongodb://127.0.0.1:27017/config-test')
  vi.stubEnv('PAYLOAD_SECRET', process.env.PAYLOAD_SECRET || 'config-test-secret')
  config = await (await import('@/src/payload.config')).default
}, 60_000)

const collection = (slug: string) => config.collections.find((c) => c.slug === slug)!

describe('job applications on the job opening (#372)', () => {
  it('joins job-applications through their job field', () => {
    const field = collection('jobs').fields.find(
      (f): f is Extract<Field, { type: 'join' }> => f.type === 'join',
    )
    expect(field).toMatchObject({ name: 'applications', collection: 'job-applications', on: 'job' })
  })

  // Applications are admin-only, so the join returns nothing to a visitor, but
  // it would still run a lookup on every public job read.
  it.each(['lib/jobs/payload.ts', 'src/actions/job-application.ts'])(
    'every jobs read in %s skips the join',
    (file) => {
      const source = readFileSync(join(process.cwd(), file), 'utf8')
      const reads = source.split("collection: 'jobs'").slice(1)
      expect(reads.length).toBeGreaterThan(0)
      // Each read's options end at the call's closing paren.
      for (const read of reads) expect(read.slice(0, read.indexOf('})'))).toContain('joins: false')
    },
  )
})

describe('query presets (#374)', () => {
  it('are on for the three inbox lists only', () => {
    expect(
      config.collections
        .filter((c) => c.enableQueryPresets)
        .map((c) => c.slug)
        .sort(),
    ).toEqual(['donation-requests', 'event-inquiries', 'job-applications'])
  })

  it('keep no version history, like our other collections', () => {
    const presets = collection('payload-query-presets')
    expect(presets).toBeDefined()
    expect(presets.versions).toBeFalsy()
  })
})
