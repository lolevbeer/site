/**
 * Event Card Component
 * Refactored to use BaseCard and shared utilities
 */

'use client';

import React from 'react';
import { BreweryEvent, EventStatus } from '@/lib/types/event';
import { LocationDisplayNames } from '@/lib/types/location';
import { BaseCard, CardSkeleton } from '@/components/ui/base-card';
import { StatusBadge, StatusBadgeGroup } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MapPin, ExternalLink, Instagram, Facebook } from 'lucide-react';
import {
  formatDate,
  formatTime,
  formatEventType,
  formatEventStatus
} from '@/lib/utils/formatters';
import { cn } from '@/lib/utils';

interface EventCardProps {
  event: BreweryEvent;
  variant?: 'default' | 'compact';
  className?: string;
  showLocation?: boolean;
  onEventClick?: (event: BreweryEvent) => void;
}

export function EventCard({
  event,
  variant = 'default',
  className,
  showLocation = true,
  onEventClick
}: EventCardProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(event.date);
  eventDate.setHours(0, 0, 0, 0);

  const isToday = eventDate.toDateString() === today.toDateString();
  const isPast = eventDate < today;
  const isCancelled = event.status === EventStatus.CANCELLED;
  const isSoldOut = event.status === EventStatus.SOLD_OUT;

  const renderCompactHeader = (event: BreweryEvent) => (
    <div className="flex items-center justify-between">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-sm truncate">{event.title}</h3>
          {isToday && <StatusBadge status="today" type="general" size="sm" />}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatTime(event.time)}
          </span>
        </div>
      </div>
      <StatusBadgeGroup
        statuses={[
          ...(showLocation ? [{
            status: event.location,
            type: 'general' as const,
            customLabel: LocationDisplayNames[event.location]
          }] : []),
          {
            status: event.type,
            type: 'general' as const,
            customLabel: formatEventType(event.type)
          },
          ...((isCancelled || isSoldOut) ? [{
            status: event.status,
            type: 'event' as const
          }] : [])
        ]}
        size="sm"
      />
    </div>
  );

  const renderDefaultHeader = (event: BreweryEvent) => (
    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-lg leading-tight">
          {event.title}
        </h3>
      </div>
      <div className="flex flex-col items-end gap-2">
        {isToday && <StatusBadge status="today" type="general" />}
      </div>
    </div>
  );

  const renderContent = (event: BreweryEvent) => {
    if (variant === 'compact') {
      return null;
    }

    return (
      <>
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{formatDate(event.date)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{formatTime(event.time)}</span>
            {event.endTime && (
              <span className="text-muted-foreground">- {formatTime(event.endTime)}</span>
            )}
          </div>
        </div>

        <StatusBadgeGroup
          statuses={[
            ...(showLocation ? [{
              status: event.location,
              type: 'general' as const,
              customLabel: LocationDisplayNames[event.location]
            }] : []),
            {
              status: event.type,
              type: 'general' as const,
              customLabel: formatEventType(event.type)
            },
            ...(event.tags?.map(tag => ({
              status: tag,
              type: 'general' as const,
              customLabel: tag
            })) || []),
            ...(event.price ? [{
              status: 'price',
              type: 'general' as const,
              customLabel: event.price
            }] : []),
            ...((isCancelled || isSoldOut) ? [{
              status: event.status,
              type: 'event' as const
            }] : [])
          ]}
          size="sm"
        />
      </>
    );
  };

  const getLinkIcon = (url: string | undefined) => {
    if (!url) return ExternalLink;
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('instagram.com') || lowerUrl.includes('instagr.am')) {
      return Instagram;
    }
    if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.com')) {
      return Facebook;
    }
    return ExternalLink;
  };

  const renderFooter = (event: BreweryEvent) => {
    if (variant === 'compact' || !event.site) {
      return null;
    }

    return (
      <div className="flex items-center justify-center">
        {event.site && (
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              window.open(event.site, '_blank');
            }}
            disabled={isCancelled}
          >
            {React.createElement(getLinkIcon(event.site), {
              className: "h-4 w-4"
            })}
          </Button>
        )}
      </div>
    );
  };

  return (
    <BaseCard
      item={event}
      variant={variant}
      className={cn('group', className)}
      onClick={onEventClick}
      isDisabled={isCancelled}
      isHighlighted={isToday}
      renderHeader={variant === 'compact' ? renderCompactHeader : renderDefaultHeader}
      renderContent={renderContent}
      renderFooter={renderFooter}
    />
  );
}

export function EventCardSkeleton({ variant = 'default' }: { variant?: 'default' | 'compact' }) {
  return <CardSkeleton variant={variant} lines={variant === 'compact' ? 2 : 4} />;
}

export default EventCard;