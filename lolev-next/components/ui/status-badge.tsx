/**
 * Status Badge Component
 * Unified badge component for displaying statuses across the application
 */

'use client';

import React from 'react';
import { Badge, BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { EventStatus } from '@/lib/types/event';
import { LucideIcon } from 'lucide-react';

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export interface StatusConfig {
  variant: BadgeVariant;
  label: string;
  icon?: LucideIcon;
  className?: string;
}

/**
 * Configuration for different status types
 */
const STATUS_CONFIGS: Record<string, Record<string, StatusConfig>> = {
  event: {
    [EventStatus.CANCELLED]: {
      variant: 'destructive',
      label: 'Cancelled'
    },
    [EventStatus.SOLD_OUT]: {
      variant: 'secondary',
      label: 'Sold Out'
    },
    [EventStatus.POSTPONED]: {
      variant: 'outline',
      label: 'Postponed'
    },
    [EventStatus.SCHEDULED]: {
      variant: 'default',
      label: 'Scheduled'
    }
  },
  availability: {
    available: {
      variant: 'default',
      label: 'Available',
      className: 'bg-green-100 text-green-800 border-green-200'
    },
    limited: {
      variant: 'secondary',
      label: 'Limited'
    },
    unavailable: {
      variant: 'outline',
      label: 'Unavailable'
    },
    sold_out: {
      variant: 'destructive',
      label: 'Sold Out'
    }
  },
  beer: {
    on_tap: {
      variant: 'default',
      label: 'Pouring'
    },
    cans: {
      variant: 'outline',
      label: 'Cans'
    },
    sale: {
      variant: 'destructive',
      label: 'Sale'
    },
    gluten_free: {
      variant: 'secondary',
      label: 'GF',
      className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
    }
  },
  vendor: {
    active: {
      variant: 'default',
      label: 'Active'
    },
    inactive: {
      variant: 'secondary',
      label: 'Inactive'
    },
    featured: {
      variant: 'default',
      label: 'Featured',
      className: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    }
  },
  general: {
    today: {
      variant: 'secondary',
      label: 'Today'
    },
    new: {
      variant: 'default',
      label: 'New'
    },
    popular: {
      variant: 'outline',
      label: 'Popular'
    }
  }
};

interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: string;
  type?: keyof typeof STATUS_CONFIGS;
  icon?: LucideIcon;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  customLabel?: string;
}

export function StatusBadge({
  status,
  type = 'general',
  icon: Icon,
  showIcon = false,
  size = 'md',
  customLabel,
  className,
  ...props
}: StatusBadgeProps) {
  const config = STATUS_CONFIGS[type]?.[status] || {
    variant: 'outline' as BadgeVariant,
    label: customLabel || status
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-0.5',
    lg: 'text-base px-3 py-1'
  };

  const IconComponent = Icon || config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn(
        sizeClasses[size],
        config.className,
        className
      )}
      {...props}
    >
      {showIcon && IconComponent && (
        <IconComponent className={cn(
          'mr-1',
          size === 'sm' && 'h-3 w-3',
          size === 'md' && 'h-3.5 w-3.5',
          size === 'lg' && 'h-4 w-4'
        )} />
      )}
      {customLabel || config.label}
    </Badge>
  );
}

/**
 * Multiple status badges
 */
interface StatusBadgeGroupProps {
  statuses: Array<{
    status: string;
    type?: keyof typeof STATUS_CONFIGS;
    customLabel?: string;
  }>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StatusBadgeGroup({
  statuses,
  size = 'md',
  className
}: StatusBadgeGroupProps) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {statuses.map((item, index) => (
        <StatusBadge
          key={`${item.type}-${item.status}-${index}`}
          status={item.status}
          type={item.type}
          customLabel={item.customLabel}
          size={size}
        />
      ))}
    </div>
  );
}

/**
 * Export configurations for external use
 */
export { STATUS_CONFIGS };