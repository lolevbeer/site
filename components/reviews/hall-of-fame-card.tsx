/**
 * One review on the Hall of Fame page: quote, reviewer, the beer it is about,
 * and the Untappd rating linking back to the check-in.
 */

import Image from 'next/image'
import Link from 'next/link'
import { UntappdIcon } from '@/components/icons'
import { formatRating } from '@/lib/utils/formatters'
import { stripReviewHtml } from '@/lib/utils/review-text'
import type { HallOfFameReview } from '@/src/utils/beer-reviews'

/**
 * Month and year only: the page is cached for an hour, so a relative date
 * ("3 days ago") would drift. Untappd's original date text passes through.
 */
function formatReviewMonth(date: string): string {
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'America/New_York',
  })
}

export function HallOfFameCard({ review }: { review: HallOfFameReview }) {
  const rating = formatRating(review.rating)

  return (
    <figure className="flex h-full flex-col gap-4 rounded-lg border border-border/60 bg-card p-6">
      {review.image && (
        <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
          <Image
            src={review.image}
            alt={`Photo by ${review.reviewer} of ${review.beer.name}`}
            fill
            className="object-cover"
            sizes="(min-width: 768px) 28rem, 100vw"
          />
        </div>
      )}

      <blockquote className="flex-1 text-lg leading-relaxed">
        <p>&ldquo;{stripReviewHtml(review.text)}&rdquo;</p>
      </blockquote>

      <figcaption className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{review.reviewer}</span>
        <span className="text-muted-foreground">
          on{' '}
          {review.beer.slug ? (
            <Link
              href={`/beer/${review.beer.slug}`}
              prefetch={false}
              className="font-medium text-primary hover:underline"
            >
              {review.beer.name}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{review.beer.name}</span>
          )}
          {review.date && <> &bull; {formatReviewMonth(review.date)}</>}
        </span>
        <a
          href={review.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <UntappdIcon className="h-4 w-4" />
          {rating ? (
            <span>
              <span className="font-bold text-highlight">{rating}/5</span> on Untappd
            </span>
          ) : (
            <span>View on Untappd</span>
          )}
        </a>
      </figcaption>
    </figure>
  )
}
