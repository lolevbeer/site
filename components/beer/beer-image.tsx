'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { getBeerImageUrl } from '@/lib/utils/media-utils';

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

export function BeerImage({ beer, className, priority = false, sizes }: BeerImageProps) {
  const [imageError, setImageError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imagePath = getBeerImageUrl(beer.image, beer.variant);

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
      <div
        className="absolute inset-0"
        style={{
          filter: loaded ? 'blur(0px)' : 'blur(12px)',
          transform: loaded ? 'scale(1)' : 'scale(1.02)',
          transition: 'filter 0.5s ease-out, transform 0.5s ease-out',
        }}
      >
        <Image
          src={imagePath}
          alt={`${beer.name}${beer.type ? ` - ${beer.type}` : ''}`}
          fill
          className="object-contain"
          priority={priority}
          sizes={sizes}
          onError={() => setImageError(true)}
          onLoad={() => setLoaded(true)}
        />
      </div>
    </div>
  );
}
