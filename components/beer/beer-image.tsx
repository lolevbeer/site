'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Beer as BeerIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BeerImageProps {
  beer: {
    variant: string;
    name: string;
    type?: string;
    image?: boolean;
  };
  className?: string;
  priority?: boolean;
  sizes?: string;
}

export function BeerImage({ beer, className, priority = false, sizes }: BeerImageProps) {
  const [imageError, setImageError] = useState(false);
  const imagePath = `/images/beer/${beer.variant}.webp`;

  // Show fallback if image flag is false or if image failed to load
  if (!beer.image || imageError) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center bg-gradient-to-b from-muted/30 to-muted/10 dark:from-muted/10 dark:to-muted/5",
        className
      )}>
        <BeerIcon className="h-12 w-12 text-muted-foreground/40 mb-2" />
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
