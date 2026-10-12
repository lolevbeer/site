/**
 * Phone-only footer banner for the TV boards (/m menus, /e events).
 *
 * The boards are sized for TVs; phone visitors who land on one get a link to
 * the taproom page instead, which lists what is on tap with links. It needs
 * both portrait and a coarse (touch) pointer, so a vertically mounted TV or a
 * tall desktop window never shows it.
 */
import Link from 'next/link'

export function TapListBanner({
  locationSlug,
  label = 'See the full tap list',
}: {
  /** Canonical taproom slug; the link goes to `/<slug>`. */
  locationSlug: string
  /** Link text; the events board says "Open the taproom page". */
  label?: string
}) {
  return (
    <div
      data-tap-list-banner
      className="hidden portrait:pointer-coarse:flex shrink-0 justify-center border-t border-border bg-background px-4 py-3"
    >
      <Link
        href={`/${locationSlug}`}
        className="inline-block py-2 text-base font-medium text-primary underline underline-offset-4"
      >
        {label}
      </Link>
    </div>
  )
}
