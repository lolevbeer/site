/**
 * /jobs index lists active openings from Payload.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/jobs/payload', () => ({
  getActiveJobs: vi.fn(),
}))

vi.mock('@/components/ui/page-breadcrumbs', () => ({
  PageBreadcrumbs: () => null,
}))

vi.mock('@/components/motion', () => ({
  PageTransition: ({ children }: { children: unknown }) => children,
}))

import JobsPage from '@/src/app/(frontend)/jobs/page'
import { getActiveJobs } from '@/lib/jobs/payload'

const jobs = getActiveJobs as ReturnType<typeof vi.fn>

afterEach(cleanup)

describe('JobsPage', () => {
  beforeEach(() => {
    jobs.mockReset()
  })

  it('shows the empty copy when there are no openings', async () => {
    jobs.mockResolvedValue([])
    render(await JobsPage())
    expect(screen.getByRole('heading', { name: 'Jobs' })).toBeTruthy()
    expect(screen.getByText(/No openings right now/)).toBeTruthy()
  })

  it('lists an opening with an apply link', async () => {
    jobs.mockResolvedValue([
      {
        id: 'job-1',
        title: 'Bartender',
        slug: 'bartender',
        summary: 'Nights and weekends.',
        description: 'Pour beer.',
        employmentType: 'part-time',
        locationName: 'Lawrenceville',
        locationSlug: 'lawrenceville',
      },
    ])
    render(await JobsPage())
    expect(screen.getByText('Bartender')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Apply' }).getAttribute('href')).toBe('/jobs/bartender')
  })
})
