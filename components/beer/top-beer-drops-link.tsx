/** Clickable TBD icon that opens the Top Beer Drops URL in a new tab. */

import { TbdIcon } from '@/components/icons';

interface TopBeerDropsLinkProps {
  url: string;
  /** Beer name, folded into the accessible name so a menu of these is distinguishable */
  beerName?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A real anchor, not a `<span role="link">` with an onClick. The span had no
 * accessible name (axe aria-command-name) and, with no tabindex or key handler,
 * could not be reached or activated from the keyboard at all — the feature was
 * mouse-only. An anchor gets naming, focus, Enter activation, middle-click and
 * open-in-new-tab from the platform, with no JS.
 *
 * `relative z-10` lifts it above the card's stretched link overlay (see
 * BeerLinkWrapper) so it stays clickable, and keeps it a sibling of that anchor
 * rather than a nested one.
 */
export function TopBeerDropsLink({ url, beerName, className, style }: TopBeerDropsLinkProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={
        beerName
          ? `${beerName} on Top Beer Drops (opens in a new tab)`
          : 'Top Beer Drops (opens in a new tab)'
      }
      className="relative z-10 inline-flex"
    >
      <TbdIcon
        className={className ?? 'h-6 w-6 text-foreground hover:text-primary transition-colors'}
        style={style}
      />
    </a>
  );
}
