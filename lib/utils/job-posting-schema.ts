/**
 * JobPosting JSON-LD for /jobs/[slug], so openings can appear in Google for Jobs.
 * @see https://developers.google.com/search/docs/appearance/structured-data/job-posting
 */

import type { PublicJob } from '@/lib/jobs/payload'
import { postalAddressFromLocation, type PostalAddressJsonLd } from './json-ld'
import { LOLEV_BASE_URL, LOLEV_OG_IMAGE_URL } from './schema-shared'

export interface JobPostingJsonLd {
  '@context': 'https://schema.org'
  '@type': 'JobPosting'
  title: string
  description: string
  datePosted: string
  validThrough?: string
  employmentType: string
  url: string
  directApply: true
  hiringOrganization: {
    '@type': 'Organization'
    name: string
    sameAs: string
    logo: string
  }
  jobLocation: { '@type': 'Place'; address: PostalAddressJsonLd }
}

/** Schema.org enum for our select values; Google has no "seasonal", so it is TEMPORARY. */
const EMPLOYMENT_TYPES: Record<string, string> = {
  'full-time': 'FULL_TIME',
  'part-time': 'PART_TIME',
  seasonal: 'TEMPORARY',
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Google collapses plain-text newlines, so blank-line-separated paragraphs become <p>. */
function paragraphsToHtml(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('')
}

/**
 * Returns null when Google would reject the posting: the location has no street/city
 * (an empty PostalAddress is invalid) or `closesOn` has passed (the page stays up until
 * an editor unticks Active, but the expired posting must not keep being advertised).
 */
// ponytail: no baseSalary; the CMS has no pay fields. Google recommends it, so add pay fields to Jobs when wanted.
export function generateJobPostingSchema(job: PublicJob): JobPostingJsonLd | null {
  const address = job.locationAddress
  if (!address?.street || !address.city) return null
  if (job.closesOn && job.closesOn.slice(0, 10) < new Date().toISOString().slice(0, 10)) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: paragraphsToHtml(job.description),
    datePosted: job.postedAt.slice(0, 10),
    ...(job.closesOn ? { validThrough: job.closesOn.slice(0, 10) } : {}),
    employmentType: EMPLOYMENT_TYPES[job.employmentType] ?? 'OTHER',
    url: `${LOLEV_BASE_URL}/jobs/${job.slug}`,
    directApply: true,
    hiringOrganization: {
      '@type': 'Organization',
      name: 'Lolev Beer',
      sameAs: LOLEV_BASE_URL,
      logo: LOLEV_OG_IMAGE_URL,
    },
    jobLocation: {
      '@type': 'Place',
      address: postalAddressFromLocation({ address }),
    },
  }
}
