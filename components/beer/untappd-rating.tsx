/**
 * Shared Untappd rating display component.
 * Renders the Untappd icon + formatted rating, with optional overlay styling.
 */

import { UntappdIcon } from '@/components/icons';
import { formatRating } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils';

interface UntappdRatingProps {
  rating: number | null | undefined;
  /** Render as a frosted-glass overlay pill (for use inside positioned containers) */
  variant?: 'inline' | 'overlay';
  className?: string;
  /** Style overrides (e.g. vh-based sizing for TV displays) */
  style?: React.CSSProperties;
  /** Icon style overrides for TV displays */
  iconStyle?: React.CSSProperties;
  /** Text to show when there is no rating. If omitted, renders nothing. */
  fallbackText?: string;
}

export function UntappdRating({
  rating,
  variant = 'inline',
  className,
  style,
  iconStyle,
  fallbackText,
}: UntappdRatingProps) {
  if ((rating ?? 0) <= 0) {
    if (fallbackText) {
      return (
        <span className={cn('text-muted-foreground font-bold leading-none', className)} style={style}>
          {fallbackText}
        </span>
      );
    }
    return null;
  }

  return (
    <span
      className={cn(
        'flex items-end gap-1 text-amber-500 text-sm',
        variant === 'overlay' &&
          'bg-background/80 backdrop-blur-sm rounded-md px-1.5 py-0.5',
        className,
      )}
      style={style}
    >
      <UntappdIcon className="h-3.5 w-3.5 mx-0.5" style={iconStyle} />
      <span className="font-bold">{formatRating(rating)}/5</span>
    </span>
  );
}
