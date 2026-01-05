/**
 * Base Card Component
 * Reusable card component that eliminates duplication across BeerCard, EventCard, and VendorCard
 */

'use client';

import React, { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface BaseCardProps<T> {
  item: T;
  variant?: 'default' | 'compact' | 'detailed';
  className?: string;
  onClick?: (item: T) => void;
  isDisabled?: boolean;
  isHighlighted?: boolean;
  renderHeader: (item: T) => ReactNode;
  renderContent: (item: T) => ReactNode;
  renderFooter?: (item: T) => ReactNode;
  testId?: string;
}

export function BaseCard<T>({
  item,
  variant = 'default',
  className,
  onClick,
  isDisabled = false,
  isHighlighted = false,
  renderHeader,
  renderContent,
  renderFooter,
  testId
}: BaseCardProps<T>) {
  const handleClick = () => {
    if (onClick && !isDisabled) {
      onClick(item);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && !isDisabled && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick(item);
    }
  };

  const isInteractive = onClick && !isDisabled;

  const cardClasses = cn(
    'transition-all duration-200',
    {
      'hover:shadow-md': !isDisabled,
      'hover:shadow-lg cursor-pointer': isInteractive,
      'bg-[var(--color-card-interactive)]': isInteractive,
      'opacity-75': isDisabled,
      'ring-2 ring-blue-500 ring-opacity-50': isHighlighted,
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2': isInteractive,
      'p-3': variant === 'compact',
      'p-4': variant === 'default',
      'p-6': variant === 'detailed'
    },
    className
  );

  return (
    <Card
      className={cardClasses}
      onClick={handleClick}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      role={isInteractive ? 'button' : undefined}
      data-testid={testId}
    >
      <div className={cn(
        'space-y-4',
        variant === 'compact' && 'space-y-2'
      )}>
        {renderHeader(item)}
        {renderContent(item)}
        {renderFooter && renderFooter(item)}
      </div>
    </Card>
  );
}

/**
 * Card skeleton for loading states
 */
interface CardSkeletonProps {
  variant?: 'default' | 'compact' | 'detailed';
  className?: string;
  lines?: number;
}

export function CardSkeleton({
  variant = 'default',
  className,
  lines = 3
}: CardSkeletonProps) {
  const padding = {
    compact: 'p-3',
    default: 'p-4',
    detailed: 'p-6'
  };

  return (
    <Card className={cn(padding[variant], className)}>
      <div className="space-y-3">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-5 bg-muted rounded w-3/4 animate-pulse" />
          <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
        </div>

        {/* Content skeleton */}
        <div className="space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-3 bg-muted rounded animate-pulse",
                i === lines - 1 ? "w-2/3" : "w-full"
              )}
            />
          ))}
        </div>

        {/* Footer skeleton */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-2">
            <div className="h-6 bg-muted rounded w-16 animate-pulse" />
            <div className="h-6 bg-muted rounded w-20 animate-pulse" />
          </div>
          <div className="h-8 bg-muted rounded w-20 animate-pulse" />
        </div>
      </div>
    </Card>
  );
}