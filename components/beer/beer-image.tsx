'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface BeerImageProps {
  beer: {
    variant: string;
    name: string;
    type?: string;
    /** Can be a boolean (true = use local PNG) or a URL string from Payload CMS */
    image?: boolean | string;
  };
  className?: string;
  priority?: boolean;
  sizes?: string;
}

/**
 * Normalize a URL to be relative (domain/port agnostic)
 * Converts "http://localhost:3002/api/media/file/hades.png" to "/api/media/file/hades.png"
 */
function normalizeUrl(url: string): string {
  if (url.startsWith('/')) return url;
  try {
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    return url;
  }
}

/**
 * Get the image path for a beer
 * - If image is a URL string, normalize it to be relative
 * - If image is true, use the local PNG file
 * - If image is false/undefined, return null
 */
function getImagePath(beer: BeerImageProps['beer']): string | null {
  if (!beer.image) return null;
  if (typeof beer.image === 'string') return normalizeUrl(beer.image);
  // image is true, use local PNG
  return `/images/beer/${beer.variant}.png`;
}

export function BeerImage({ beer, className, priority = false, sizes }: BeerImageProps) {
  const [imageError, setImageError] = useState(false);
  const imagePath = getImagePath(beer);

  // Show fallback if no image or if image failed to load
  if (!imagePath || imageError) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center bg-gradient-to-b from-muted/30 to-muted/10 dark:from-muted/10 dark:to-muted/5",
        className
      )}>
        <div className="text-center px-4">
          <p className="text-sm font-semibold text-muted-foreground/70 line-clamp-2">{beer.name}</p>
          {beer.type && (
            <p className="text-xs text-muted-foreground/50 mt-1 line-clamp-1">{beer.type}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "relative bg-gradient-to-b from-background to-muted/30 dark:from-muted/10 dark:to-background",
      className
    )}>
      <Image
        src={imagePath}
        alt={`${beer.name}${beer.type ? ` - ${beer.type}` : ''}`}
        fill
        className="object-contain"
        priority={priority}
        sizes={sizes}
        onError={() => setImageError(true)}
      />
    </div>
  );
}
