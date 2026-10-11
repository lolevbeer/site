/**
 * Portrait-only footer banner for the TV boards (/m menus, /e events).
 *
 * The boards are sized for landscape TVs; phone visitors who land on one get
 * a link to the taproom page instead, which lists what is on tap with links.
 * `hidden portrait:flex` keeps it off every landscape screen, so the TVs
 * never show it.
 */
import Link from 'next/link'

export function TapListBanner({ locationSlug }: { locationSlug: string }) {
  return (
    <div
      data-tap-list-banner
      className="hidden portrait:flex shrink-0 justify-center border-t border-border bg-background px-4 py-3"
    >
      <Link
        href={`/${locationSlug}`}
        className="inline-block py-2 text-base font-medium text-primary underline underline-offset-4"
      >
        See the full tap list
      </Link>
    </div>
  )
}
