/**
 * Public job listings from Payload. Failures rethrow so ISR does not cache
 * an empty openings list.
 */

import { cache } from 'react'
import { getPayload } from 'payload'
import { unstable_cache } from 'next/cache'
import config from '@/src/payload.config'
import { logger } from '@/lib/utils/logger'
import { CACHE_TAGS } from '@/lib/utils/cache'

export interface PublicJob {
  id: string
  title: string
  slug: string
  summary: string
  description: string
  employmentType: string
  locationName: string
  locationSlug: string
}

const JOBS_CACHE = { tags: [CACHE_TAGS.jobs], revalidate: 300 }

type JobDoc = {
  id: string
  title?: string | null
  slug?: string | null
  summary?: string | null
  description?: string | null
  employmentType?: string | null
  location?: unknown
}

function relatedString(value: unknown, key: 'name' | 'slug'): string {
  if (typeof value !== 'object' || !value || !(key in value)) return ''
  return String((value as Record<string, unknown>)[key] || '')
}

function toPublicJob(doc: JobDoc): PublicJob | null {
  if (!doc.slug) return null
  return {
    id: doc.id,
    title: doc.title || 'Open role',
    slug: doc.slug,
    summary: doc.summary || '',
    description: doc.description || '',
    employmentType: doc.employmentType || 'full-time',
    locationName: relatedString(doc.location, 'name'),
    locationSlug: relatedString(doc.location, 'slug'),
  }
}

function toPublicJobs(docs: JobDoc[]): PublicJob[] {
  const jobs: PublicJob[] = []
  for (const doc of docs) {
    const job = toPublicJob(doc)
    if (job) jobs.push(job)
  }
  return jobs
}

/** Active openings for /jobs and the sitemap. */
export const getActiveJobs = async (): Promise<PublicJob[]> => {
  try {
    return await unstable_cache(
      async () => {
        const payload = await getPayload({ config })
        const result = await payload.find({
          collection: 'jobs',
          where: { active: { equals: true } },
          sort: 'title',
          depth: 1,
          limit: 100,
        })
        return toPublicJobs(result.docs)
      },
      ['active-jobs'],
      JOBS_CACHE,
    )()
  } catch (error) {
    logger.error('Error fetching active jobs', error)
    throw error
  }
}

export const getJobBySlug = cache(async (slug: string): Promise<PublicJob | null> => {
  return unstable_cache(
    async () => {
      const payload = await getPayload({ config })
      const result = await payload.find({
        collection: 'jobs',
        where: {
          and: [{ slug: { equals: slug } }, { active: { equals: true } }],
        },
        limit: 1,
        depth: 1,
      })
      const doc = result.docs[0]
      return doc ? toPublicJob(doc) : null
    },
    [`job-${slug}`],
    JOBS_CACHE,
  )()
})
