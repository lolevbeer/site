'use client';

/**
 * Event Card Component
 * Displays event information in a card format with responsive design
 */

'use client';

import React from 'react';
import { BreweryEvent, EventType, EventStatus } from '@/lib/types/event';
import { LocationDisplayNames } from '@/lib/types/location';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MapPin, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EventCardProps {
  event: BreweryEvent;
  variant?: 'default' | 'compact';
  className?: string;
  showLocation?: boolean;
  onEventClick?: (event: BreweryEvent) => void;
}

/**
 * Event display card component
 */
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    // Handle various time formats (e.g., "7pm", "7:00 PM", "19:00")
    try {
      if (timeString.includes(':')) {
        const [time, period] = timeString.split(/\s*(AM|PM|am|pm)\s*/);
        if (period) {
          return timeString.toLowerCase();
        }
        // 24-hour format
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'pm' : 'am';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes}${ampm}`;
      }
      return timeString.toLowerCase();
    } catch {
      return timeString;
    }
  };

  const getEventTypeLabel = (type: EventType) => {
    return String(type).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getStatusColor = (status: EventStatus) => {
    switch (status) {
      case EventStatus.CANCELLED:
        return 'destructive';
      case EventStatus.SOLD_OUT:
        return 'secondary';
      case EventStatus.POSTPONED:
        return 'outline';
      default:
        return 'default';
    }
  };

  const handleCardClick = () => {
    if (onEventClick && !isCancelled) {
      onEventClick(event);
    }
  };

  const cardClasses = cn(
    'transition-all duration-200 hover:shadow-md',
    {
      'ring-2 ring-blue-500 ring-opacity-50': isToday,
      'opacity-75': isPast || isCancelled,
      'cursor-pointer hover:shadow-lg': onEventClick && !isCancelled,
      'p-3': variant === 'compact',
      'p-4': variant === 'default'
    },
    className
  );

  if (variant === 'compact') {
    return (
      <Card className={cardClasses} onClick={handleCardClick}>
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-sm truncate">{event.title}</h3>
              {isToday && <Badge variant="secondary" className="text-xs">Today</Badge>}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(event.time)}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {showLocation && (
              <Badge variant="default" className="text-xs flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {LocationDisplayNames[event.location]}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {getEventTypeLabel(event.type)}
            </Badge>
            {(isCancelled || isSoldOut) && (
              <Badge variant={getStatusColor(event.status)} className="text-xs">
                {event.status.replace('_', ' ').toUpperCase()}
              </Badge>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cardClasses} onClick={handleCardClick}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg leading-tight">
              {event.title}
            </h3>
          </div>
          <div className="flex flex-col items-end gap-2">
            {isToday && <Badge variant="secondary">Today</Badge>}
          </div>
        </div>

        {/* Event Details */}
        <div className="grid grid-cols-2 gap-3 text-sm">
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

        {/* Tags and Status */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {showLocation && (
              <Badge variant="default" className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {LocationDisplayNames[event.location]}
              </Badge>
            )}
            <Badge variant="outline">
              {getEventTypeLabel(event.type)}
            </Badge>
            {event.tags?.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {event.price && (
              <Badge variant="outline" className="text-xs">
                {event.price}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {(isCancelled || isSoldOut) && (
              <Badge variant={getStatusColor(event.status)}>
                {event.status.replace('_', ' ').toUpperCase()}
              </Badge>
            )}
          </div>
        </div>

        {/* Actions */}
        {(event.site || onEventClick) && (
          <div className="flex items-center gap-2 pt-2 border-t">
            {event.site && (
              <Button
                variant="outline"
                size="sm"
                asChild
                disabled={isCancelled}
              >
                <a
                  href={event.site}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Learn More
                </a>
              </Button>
            )}
            {onEventClick && !isCancelled && (
              <Button
                variant="default"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick(event);
                }}
              >
                View Details
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Event card skeleton for loading states
 */
export function EventCardSkeleton({ variant = 'default' }: { variant?: 'default' | 'compact' }) {
  if (variant === 'compact') {
    return (
      <Card className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-3 bg-muted rounded w-1/2"></div>
          </div>
          <div className="h-6 bg-muted rounded w-16"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn(
      'space-y-4',
      variant === 'default' ? 'p-4' : 'p-6'
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <div className="h-6 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
        <div className="h-6 bg-muted rounded w-16"></div>
      </div>
      <div className="h-4 bg-muted rounded w-full"></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="h-4 bg-muted rounded"></div>
        <div className="h-4 bg-muted rounded"></div>
        <div className="h-4 bg-muted rounded"></div>
        <div className="h-4 bg-muted rounded"></div>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-6 bg-muted rounded w-20"></div>
        <div className="h-6 bg-muted rounded w-16"></div>
      </div>
    </Card>
  );
}

export default EventCard;