/**
 * Apply page for one opening. 404 if the job is missing or inactive.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs'
import { PageTransition } from '@/components/motion'
import { JobApplyForm } from '@/components/jobs/job-apply-form'
import { getJobBySlug } from '@/lib/jobs/payload'

export const revalidate = 300

interface JobPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: JobPageProps): Promise<Metadata> {
  const { slug } = await params
  const job = await getJobBySlug(slug)
  if (!job) return { title: 'Job not found' }
  return {
    title: `${job.title} — Jobs`,
    description: job.summary || `Apply for ${job.title} at Lolev Beer.`,
    alternates: { canonical: `/jobs/${job.slug}` },
  }
}

export default async function JobPage({ params }: JobPageProps) {
  const { slug } = await params
  const job = await getJobBySlug(slug)
  if (!job) notFound()

  const typeLabel = job.employmentType.replace('-', ' ')

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <PageBreadcrumbs className="mb-6" />
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight mb-2">{job.title}</h1>
          <p className="text-muted-foreground capitalize">
            {typeLabel}
            {job.locationName ? ` · ${job.locationName}` : ''}
          </p>
          <p className="mt-2">
            <Link href="/jobs" className="text-sm underline hover:text-foreground">
              All openings
            </Link>
            {job.locationSlug ? (
              <>
                {' · '}
                <Link href={`/${job.locationSlug}`} className="text-sm underline hover:text-foreground">
                  {job.locationName || 'the taproom'}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        {job.description ? (
          <div className="text-pretty whitespace-pre-wrap mb-10">{job.description}</div>
        ) : null}
        <h2 className="text-2xl font-semibold text-center mb-6">Apply</h2>
        <JobApplyForm key={job.slug} jobSlug={job.slug} />
      </div>
    </PageTransition>
  )
}
