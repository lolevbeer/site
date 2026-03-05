/**
 * Timeline Item Component
 * A visually engaging item for timeline displays
 */

'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/utils/formatters';
import { Music, Utensils, Puzzle, Trophy, Beer, MicVocal, type LucideIcon } from 'lucide-react';

const tagIcons: Record<string, LucideIcon> = {
  music: Music,
  utensils: Utensils,
  puzzle: Puzzle,
  sports: Trophy,
  'beer-release': Beer,
  'mic-vocal': MicVocal,
};
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

interface TimelineItemProps {
  title: string;
  time?: string;
  endTime?: string;
  location?: string;
  description?: string;
  tags?: string[];
  site?: string;
  imageUrl?: string;
  className?: string;
}

export function TimelineItem({
  title,
  time,
  endTime,
  location,
  description,
  tags,
  site,
  imageUrl,
  className
}: TimelineItemProps) {
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

  const handleClick = () => {
    if (site) {
      window.open(site, '_blank');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (site && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      window.open(site, '_blank');
    }
  };

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImageDialogOpen(true);
  };

  const hasTime = time && time.toLowerCase() !== 'tbd';

  const timeDisplay = hasTime ? (
    endTime && endTime.toLowerCase() !== 'tbd'
      ? `${formatTime(time)}–${formatTime(endTime)}`
      : formatTime(time)
  ) : null;

  return (
    <>
      <div
        className={cn(
          'group relative flex items-stretch gap-4 p-4 rounded-lg',
          'transition-all duration-200',
          site
            ? 'border border-border cursor-pointer hover:bg-secondary hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
            : 'border-transparent',
          className
        )}
        onClick={site ? handleClick : undefined}
        onKeyDown={site ? handleKeyDown : undefined}
        tabIndex={site ? 0 : undefined}
        role={site ? 'link' : undefined}
      >
        {/* Image */}
        {imageUrl && (
          <button
            type="button"
            onClick={handleImageClick}
            className="relative w-16 h-16 flex-shrink-0 rounded-full overflow-hidden bg-muted cursor-zoom-in hover:ring-2 hover:ring-ring hover:ring-offset-2 transition-all"
          >
            <Image
              src={imageUrl}
              alt={`${title} logo`}
              fill
              className="object-cover"
              sizes="64px"
            />
          </button>
        )}
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {tags?.map((tag) => {
            const Icon = tagIcons[tag]
            return Icon ? <Icon key={tag} className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : null
          })}
          <h4 className="font-semibold text-base leading-tight">
            {title}
          </h4>
        </div>
        {(location || timeDisplay) && (
          <p className="text-sm text-muted-foreground mt-1">
            {location}
            {location && timeDisplay && ' • '}
            {timeDisplay}
          </p>
        )}
        {description && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
            {description}
          </p>
        )}
      </div>
    </div>

      {/* Image Dialog */}
      {imageUrl && (
        <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
          <DialogContent className="sm:max-w-lg p-4">
            <DialogTitle className="sr-only">{title}</DialogTitle>
            <div className="relative w-full aspect-square">
              <Image
                src={imageUrl}
                alt={`${title} logo`}
                fill
                className="object-contain rounded-lg"
                sizes="(max-width: 768px) 100vw, 400px"
              />
            </div>
            <p className="text-center font-semibold mt-2">{title}</p>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export default TimelineItem;
