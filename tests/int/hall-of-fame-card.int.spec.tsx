/**
 * HallOfFameCard: quote text is shown without Untappd's inline HTML, the beer
 * links to its page only when it has a public one, and the rating links back
 * to the Untappd check-in.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { HallOfFameCard } from '@/components/reviews/hall-of-fame-card'
import type { HallOfFameReview } from '@/src/utils/beer-reviews'

afterEach(cleanup)

const review: HallOfFameReview = {
  id: 'r1',
  reviewer: 'hazehunter',
  rating: 4.75,
  text: 'Cheers <a href="/user/mike">Mike B.</a>, unreal &amp; juicy',
  date: '2026-08-20T16:00:00.000Z',
  url: 'https://untappd.com/user/hazehunter/checkin/1',
  beer: { name: 'Rumination', slug: 'rumination' },
}

describe('HallOfFameCard', () => {
  it('renders the quote, beer link and Untappd rating', () => {
    render(<HallOfFameCard review={review} />)

    expect(screen.getByText(/Cheers Mike B\., unreal & juicy/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Rumination' }).getAttribute('href')).toBe(
      '/beer/rumination',
    )
    expect(screen.getByText('Aug 2026', { exact: false })).toBeTruthy()
    const untappd = screen.getByRole('link', { name: /4\.75\/5 on Untappd/ })
    expect(untappd.getAttribute('href')).toBe(review.url)
  })

  it('names a beer without a public page but does not link it', () => {
    render(<HallOfFameCard review={{ ...review, beer: { name: 'Guest Beer' } }} />)

    expect(screen.getByText('Guest Beer')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Guest Beer' })).toBeNull()
  })
})
