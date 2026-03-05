/** Clickable TBD icon that opens the Top Beer Drops URL in a new tab. */

'use client';

import { TbdIcon } from '@/components/icons';

interface TopBeerDropsLinkProps {
  url: string;
  className?: string;
  style?: React.CSSProperties;
}

export function TopBeerDropsLink({ url, className, style }: TopBeerDropsLinkProps) {
  return (
    <span
      role="link"
      className="cursor-pointer"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(url, '_blank', 'noopener,noreferrer');
      }}
    >
      <TbdIcon
        className={className ?? 'h-6 w-6 text-foreground hover:text-primary transition-colors'}
        style={style}
      />
    </span>
  );
}
