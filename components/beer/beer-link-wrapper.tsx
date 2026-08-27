/**
 * Beer Link Wrapper
 * Shared by the beer card variants (DraftBeerCard, CanCard) to enforce one rule
 * in one place: a hideFromSite beer has no reachable detail page.
 */

'use client'

import React from 'react'
import Link from 'next/link'

interface BeerLinkWrapperProps {
  href: string
  /** Beer is hidden from the site — render unlinked instead of dead-ending */
  hidden?: boolean
  className?: string
  children: React.ReactNode
}

/**
 * Wraps a beer card in a link to its detail page, or in a plain div when the
 * beer is hidden.
 *
 * hideFromSite beers (usually guest taps) still render on menus — the flag only
 * removes them from the /beer catalog, detail pages, sitemap, and feeds. Their
 * /beer/<slug> page returns notFound(), so the card is shown without a link
 * rather than dead-ending the click.
 *
 * Module scope, never declared in a render body: a component declared inline is
 * a new type every render, so React would remount the whole card subtree instead
 * of reconciling it — reloading images and restarting transitions on the /m
 * displays, which re-render on every poll tick.
 */
export function BeerLinkWrapper({
  href,
  hidden,
  className = 'group block h-full',
  children,
}: BeerLinkWrapperProps) {
  if (hidden) return <div className={className}>{children}</div>
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}
