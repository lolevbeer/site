/**
 * Hall of Fame Page
 * Untappd reviews a beer manager flagged with "Hall of Fame" in the admin.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Beer } from '@/components/icons'
import { HallOfFameCard } from '@/components/reviews/hall-of-fame-card'
import { PageTransition } from '@/components/motion'
import { getHallOfFameReviews } from '@/lib/utils/payload-api'
import { buildPageMetadata } from '@/lib/seo/resolve-metadata'

// ISR: revalidate every hour; review saves also revalidate this path.
export const revalidate = 3600

const HALL_OF_FAME_DESCRIPTION = 'Our favorite things people have said about Lolev beer on Untappd.'

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    fallbackTitle: 'Hall of Fame',
    fallbackDescription: HALL_OF_FAME_DESCRIPTION,
    canonicalPath: '/hall-of-fame',
    fallbackKeywords: ['Lolev Beer reviews', 'Untappd reviews', 'Pittsburgh brewery'],
    hubKey: 'hallOfFame',
  })
}

export default async function HallOfFamePage() {
  const reviews = await getHallOfFameReviews()

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <PageBreadcrumbs className="mb-6" />

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Hall of Fame</h1>
          <p className="text-muted-foreground">{HALL_OF_FAME_DESCRIPTION}</p>
        </div>

        {reviews.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2">
            {reviews.map((review) => (
              <HallOfFameCard key={review.id} review={review} />
            ))}
          </div>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Beer />
              </EmptyMedia>
              <EmptyTitle>No reviews here yet</EmptyTitle>
              <EmptyDescription>Check back soon.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        <div className="text-center mt-12">
          <Button asChild variant="default" size="lg">
            <Link href="/beer">Explore Our Beers</Link>
          </Button>
        </div>
      </div>
    </PageTransition>
  )
}
