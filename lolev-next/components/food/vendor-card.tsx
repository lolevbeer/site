/**
 * Food Vendor Card Component
 * Refactored to use BaseCard and shared utilities
 */

'use client';

import React from 'react';
import { FoodVendor } from '@/lib/types/food';
import { BaseCard, CardSkeleton } from '@/components/ui/base-card';
import { StatusBadge, StatusBadgeGroup } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import {
  ExternalLink,
  Instagram,
  Facebook,
  Phone,
  Mail,
  Clock,
  MapPin,
  Utensils,
  DollarSign
} from 'lucide-react';
import {
  formatCuisineType,
  formatDietaryOption,
  formatVendorType,
  formatPriceRange
} from '@/lib/utils/formatters';

interface VendorCardProps {
  vendor: FoodVendor;
  schedule?: {
    date: string;
    time: string;
    location: string;
  };
  variant?: 'default' | 'compact' | 'detailed';
  className?: string;
  showSchedule?: boolean;
  onVendorClick?: (vendor: FoodVendor) => void;
}

export function VendorCard({
  vendor,
  schedule,
  variant = 'default',
  className,
  showSchedule = true,
  onVendorClick
}: VendorCardProps) {
  const renderCompactHeader = (vendor: FoodVendor) => (
    <div className="space-y-2">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">{vendor.name}</h3>
          <p className="text-xs text-muted-foreground truncate">
            {vendor.cuisineTypes.slice(0, 2).map(formatCuisineType).join(', ')}
            {vendor.cuisineTypes.length > 2 && ' +more'}
          </p>
        </div>
        {vendor.priceRange && (
          <span className="text-xs text-muted-foreground">
            {formatPriceRange(vendor.priceRange)}
          </span>
        )}
      </div>

      {schedule && showSchedule && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{schedule.time}</span>
          <MapPin className="h-3 w-3" />
          <span>{schedule.location}</span>
        </div>
      )}

      <StatusBadgeGroup
        statuses={[
          {
            status: vendor.type,
            type: 'general' as const,
            customLabel: formatVendorType(vendor.type)
          },
          ...(!vendor.active ? [{
            status: 'inactive',
            type: 'vendor' as const
          }] : [])
        ]}
        size="sm"
      />
    </div>
  );

  const renderDefaultHeader = (vendor: FoodVendor) => (
    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0">
        <h3 className={`font-semibold ${variant === 'detailed' ? 'text-xl' : 'text-lg'} leading-tight`}>
          {vendor.name}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          <StatusBadge
            status={vendor.type}
            type="general"
            customLabel={formatVendorType(vendor.type)}
            size="sm"
          />
          {!vendor.active && (
            <StatusBadge status="inactive" type="vendor" size="sm" />
          )}
        </div>
      </div>

      {vendor.priceRange && (
        <div className="flex items-center gap-1">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{formatPriceRange(vendor.priceRange)}</span>
        </div>
      )}
    </div>
  );

  const renderContent = (vendor: FoodVendor) => {
    if (variant === 'compact') {
      return null;
    }

    return (
      <>
        {vendor.description && (
          <p className="text-sm text-muted-foreground">
            {vendor.description}
          </p>
        )}

        {schedule && showSchedule && (
          <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{schedule.time}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{schedule.location}</span>
            </div>
          </div>
        )}

        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
            <Utensils className="h-3 w-3" />
            Cuisine
          </h4>
          <StatusBadgeGroup
            statuses={vendor.cuisineTypes.map(cuisine => ({
              status: cuisine,
              type: 'general' as const,
              customLabel: formatCuisineType(cuisine)
            }))}
            size="sm"
          />
        </div>

        {vendor.dietaryOptions && vendor.dietaryOptions.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Dietary Options</h4>
            <StatusBadgeGroup
              statuses={vendor.dietaryOptions.map(option => ({
                status: option,
                type: 'general' as const,
                customLabel: formatDietaryOption(option)
              }))}
              size="sm"
            />
          </div>
        )}

        {vendor.popularItems && vendor.popularItems.length > 0 && variant === 'detailed' && (
          <div>
            <h4 className="text-sm font-medium mb-2">Popular Items</h4>
            <StatusBadgeGroup
              statuses={vendor.popularItems.map(item => ({
                status: item,
                type: 'general' as const,
                customLabel: item
              }))}
              size="sm"
            />
          </div>
        )}
      </>
    );
  };

  const renderFooter = (vendor: FoodVendor) => {
    if (variant === 'compact') {
      return null;
    }

    const hasContactInfo = vendor.phone || vendor.email;
    const hasSocialLinks = vendor.website || vendor.instagram || vendor.facebook;

    if (!hasContactInfo && !hasSocialLinks) {
      return null;
    }

    return (
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <div className="flex items-center gap-2">
          {vendor.website && (
            <Button variant="outline" size="sm" asChild>
              <a
                href={vendor.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                Website
              </a>
            </Button>
          )}

          {vendor.instagram && (
            <Button variant="outline" size="sm" asChild>
              <a
                href={`https://instagram.com/${vendor.instagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1"
              >
                <Instagram className="h-3 w-3" />
                Instagram
              </a>
            </Button>
          )}

          {vendor.facebook && (
            <Button variant="outline" size="sm" asChild>
              <a
                href={vendor.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1"
              >
                <Facebook className="h-3 w-3" />
                Facebook
              </a>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {vendor.phone && (
            <Button variant="ghost" size="sm" asChild>
              <a
                href={`tel:${vendor.phone}`}
                className="flex items-center gap-1"
              >
                <Phone className="h-3 w-3" />
              </a>
            </Button>
          )}

          {vendor.email && (
            <Button variant="ghost" size="sm" asChild>
              <a
                href={`mailto:${vendor.email}`}
                className="flex items-center gap-1"
              >
                <Mail className="h-3 w-3" />
              </a>
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <BaseCard
      item={vendor}
      variant={variant}
      className={className}
      onClick={onVendorClick}
      isDisabled={!vendor.active}
      renderHeader={variant === 'compact' ? renderCompactHeader : renderDefaultHeader}
      renderContent={renderContent}
      renderFooter={renderFooter}
    />
  );
}

export function VendorCardSkeleton({ variant = 'default' }: { variant?: 'default' | 'compact' | 'detailed' }) {
  return <CardSkeleton variant={variant} lines={variant === 'compact' ? 3 : 5} />;
}

export default VendorCard;