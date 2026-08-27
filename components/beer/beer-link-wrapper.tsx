/**
 * Beer Link Wrapper
 * Shared by the beer card variants (DraftBeerCard, CanCard) to enforce one rule
 * in one place: a hideFromSite beer has no reachable detail page.
 */

'use client'

import React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface BeerLinkWrapperProps {
  href: string
  /** Accessible name for the card link — the anchor holds no text of its own */
  label: string
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
 * The anchor is a stretched overlay rather than a wrapper around the card. Cards
 * contain their own link (the Top Beer Drops icon), and an <a> inside an <a> is
 * invalid HTML that browsers silently recover from by closing the outer anchor.
 * Overlaying instead keeps both links valid: the card content is a sibling, and
 * anything interactive inside it raises itself above the overlay with z-10.
 * `inset-0` inside a `relative` box adds no layout, so card geometry — including
 * the /m display grids — is unchanged.
 *
 * Module scope, never declared in a render body: a component declared inline is
 * a new type every render, so React would remount the whole card subtree instead
 * of reconciling it — reloading images and restarting transitions on the /m
 * displays, which re-render on every poll tick.
 */
export function BeerLinkWrapper({
  href,
  label,
  hidden,
  className = 'group block h-full',
  children,
}: BeerLinkWrapperProps) {
  if (hidden) return <div className={className}>{children}</div>
  return (
    <div className={cn('relative', className)}>
      {children}
      <Link
        href={href}
        aria-label={label}
        className="absolute inset-0 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
    </div>
  )
}
