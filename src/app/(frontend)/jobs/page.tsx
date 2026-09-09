/**
 * Public openings list. Linked from the footer, not the header.
 * getActiveJobs rethrows on Payload failure so ISR does not cache an empty list.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs'
import { PageTransition } from '@/components/motion'
import { Button } from '@/components/ui/button'
import { getActiveJobs } from '@/lib/jobs/payload'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Jobs',
  description: 'Open roles at Lolev Beer taprooms.',
  alternates: { canonical: '/jobs' },
}

export default async function JobsPage() {
  const jobs = await getActiveJobs()

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <PageBreadcrumbs className="mb-6" />
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Jobs</h1>
          <p className="text-muted-foreground text-pretty">
            Openings at our taprooms. Completing an application is not a hire.
          </p>
        </div>
        {jobs.length === 0 ? (
          <p className="text-center text-muted-foreground">No openings right now. Check back later.</p>
        ) : (
          <ul className="list-none p-0 m-0 flex flex-col gap-10 text-center">
            {jobs.map((job) => (
              <li key={job.id}>
                <h2 className="text-xl font-semibold">{job.title}</h2>
                <p className="text-sm text-muted-foreground capitalize">
                  {job.employmentType.replace('-', ' ')}
                  {job.locationName ? ` · ${job.locationName}` : ''}
                </p>
                {job.summary ? (
                  <p className="text-muted-foreground text-pretty mt-2">{job.summary}</p>
                ) : null}
                <div className="mt-4">
                  <Button asChild variant="outline">
                    <Link href={`/jobs/${job.slug}`}>Apply</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageTransition>
  )
}
