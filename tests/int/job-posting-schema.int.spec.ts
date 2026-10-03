import { describe, it, expect } from 'vitest'
import { buildEditorState } from '@payloadcms/richtext-lexical'
import { generateJobPostingSchema as generate } from '@/lib/utils/job-posting-schema'
import type { PublicJob } from '@/lib/jobs/payload'

const job = (fields: Partial<PublicJob> = {}): PublicJob => ({
  id: 'job-1',
  title: 'Bartender',
  slug: 'bartender',
  summary: 'Nights and weekends.',
  description: buildEditorState<PublicJob['description']>({ text: 'Smile <a lot>.' }),
  employmentType: 'part-time',
  locationName: 'Lawrenceville',
  locationSlug: 'lawrenceville',
  postedAt: '2026-09-01T12:00:00.000Z',
  locationAddress: { street: '5267 Butler St', city: 'Pittsburgh', state: 'PA', zip: '15201' },
  ...fields,
})

/** Non-null wrapper: these cases all use a job that qualifies for a posting. */
const generateJobPostingSchema = (j: PublicJob) => generate(j)!

describe('generateJobPostingSchema', () => {
  it('fills the fields Google requires', () => {
    const schema = generateJobPostingSchema(job())
    expect(schema['@type']).toBe('JobPosting')
    expect(schema.title).toBe('Bartender')
    expect(schema.datePosted).toBe('2026-09-01')
    expect(schema.url).toBe('https://lolev.beer/jobs/bartender')
    expect(schema.hiringOrganization.name).toBe('Lolev Beer')
    expect(schema.jobLocation.address).toMatchObject({
      streetAddress: '5267 Butler St',
      addressLocality: 'Pittsburgh',
      addressRegion: 'PA',
      postalCode: '15201',
    })
    expect(schema.directApply).toBe(true)
  })

  it('sets validThrough only when the job has a closing date', () => {
    expect(generateJobPostingSchema(job()).validThrough).toBeUndefined()
    expect(
      generateJobPostingSchema(job({ closesOn: '2026-10-15T12:00:00.000Z' })).validThrough,
    ).toBe('2026-10-15')
  })

  it('renders the description as escaped HTML paragraphs', () => {
    expect(generateJobPostingSchema(job()).description).toBe('<p>Smile &lt;a lot&gt;.</p>')
  })

  it('emits nothing when the description is empty', () => {
    expect(generate(job({ description: null }))).toBeNull()
  })

  it.each([
    ['full-time', 'FULL_TIME'],
    ['part-time', 'PART_TIME'],
    ['seasonal', 'TEMPORARY'],
  ])('maps %s to %s', (employmentType, expected) => {
    expect(generateJobPostingSchema(job({ employmentType })).employmentType).toBe(expected)
  })

  it('emits nothing when the location has no street or city', () => {
    expect(generate(job({ locationAddress: undefined }))).toBeNull()
    expect(generate(job({ locationAddress: { city: 'Pittsburgh' } }))).toBeNull()
  })

  it('emits nothing once closesOn has passed', () => {
    expect(generate(job({ closesOn: '2020-01-01T12:00:00.000Z' }))).toBeNull()
  })
})
