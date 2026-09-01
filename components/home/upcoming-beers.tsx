import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SectionHeader } from '@/components/ui/section-header'
import { ScrollReveal } from '@/components/ui/scroll-reveal'
import { beerHref } from '@/lib/config/beer-filters'
import type { ComingSoonView } from '@/lib/utils/homepage-view-models'

interface UpcomingBeersProps {
  comingSoonBeers?: ComingSoonView[]
}

export function UpcomingBeers({
  comingSoonBeers = [],
}: UpcomingBeersProps): React.ReactElement | null {
  const validItems = comingSoonBeers.filter((item) => item.slug || item.styleName)

  if (validItems.length === 0) {
    return null
  }

  return (
    <section className="py-16 lg:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <SectionHeader title="Up Next" adminUrl="/admin/globals/coming-soon" />
        </ScrollReveal>

        <div className="max-w-4xl mx-auto space-y-1 text-center mb-8">
          {validItems.map((item, index) => (
            <div key={item.slug || item.styleName || String(index)}>
              {item.slug && !item.hideFromSite ? (
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="text-lg font-semibold h-auto py-0 px-2"
                >
                  <Link href={`/beer/${item.slug}`}>{item.name}</Link>
                </Button>
              ) : (
                /* Hidden beers 404 on /beer/<slug>, so keep the name but drop the link */
                <h3 className="font-semibold text-lg">{item.name || item.styleName}</h3>
              )}
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button asChild variant="outline" size="lg">
            <Link href={beerHref('all')}>View All Beer</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
