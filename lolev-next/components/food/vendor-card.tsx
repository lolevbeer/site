/**
 * Food Vendor Card Component
 * Displays food vendor information with social media links and details
 */

'use client';

import React from 'react';
import { FoodVendor, FoodVendorType, CuisineType, DietaryOption } from '@/lib/types/food';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ExternalLink,
  Instagram,
  Facebook,
  Phone,
  Mail,
  Star,
  DollarSign,
  Clock,
  MapPin,
  Utensils
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

/**
 * Food vendor information card
 */
export function VendorCard({
  vendor,
  schedule,
  variant = 'default',
  className,
  showSchedule = true,
  onVendorClick
}: VendorCardProps) {
  const formatCuisineType = (cuisine: CuisineType) => {
    return cuisine.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDietaryOption = (option: DietaryOption) => {
    return option.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatVendorType = (type: FoodVendorType) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getPriceRangeDisplay = (priceRange?: number) => {
    if (!priceRange) return null;
    return '$'.repeat(Math.min(priceRange, 4));
  };

  const getRatingStars = (rating?: number) => {
    if (!rating) return null;
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={cn(
          'h-3 w-3',
          i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
        )}
      />
    ));
  };

  const handleCardClick = () => {
    if (onVendorClick) {
      onVendorClick(vendor);
    }
  };

  const cardClasses = cn(
    'transition-all duration-200 hover:shadow-md',
    {
      'cursor-pointer hover:shadow-lg': onVendorClick,
      'opacity-75': !vendor.active,
      'p-3': variant === 'compact',
      'p-4': variant === 'default',
      'p-6': variant === 'detailed'
    },
    className
  );

  if (variant === 'compact') {
    return (
      <Card className={cardClasses} onClick={handleCardClick}>
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{vendor.name}</h3>
              <p className="text-xs text-muted-foreground truncate">
                {vendor.cuisineTypes.slice(0, 2).map(formatCuisineType).join(', ')}
                {vendor.cuisineTypes.length > 2 && ' +more'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {vendor.rating && (
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-xs">{vendor.rating}</span>
                </div>
              )}
              {vendor.priceRange && (
                <span className="text-xs text-muted-foreground">
                  {getPriceRangeDisplay(vendor.priceRange)}
                </span>
              )}
            </div>
          </div>

          {schedule && showSchedule && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{schedule.time}</span>
              <MapPin className="h-3 w-3" />
              <span>{schedule.location}</span>
            </div>
          )}

          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-xs">
              {formatVendorType(vendor.type)}
            </Badge>
            {!vendor.active && (
              <Badge variant="secondary" className="text-xs">
                Inactive
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
            <h3 className={cn(
              'font-semibold leading-tight',
              variant === 'detailed' ? 'text-xl' : 'text-lg'
            )}>
              {vendor.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">
                {formatVendorType(vendor.type)}
              </Badge>
              {!vendor.active && (
                <Badge variant="secondary">
                  Inactive
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {vendor.rating && (
              <div className="flex items-center gap-1">
                <div className="flex">{getRatingStars(vendor.rating)}</div>
                <span className="text-sm font-medium">{vendor.rating}</span>
              </div>
            )}
            {vendor.priceRange && (
              <div className="flex items-center gap-1">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{getPriceRangeDisplay(vendor.priceRange)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {vendor.description && (
          <p className="text-sm text-muted-foreground">
            {vendor.description}
          </p>
        )}

        {/* Schedule Info */}
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

        {/* Cuisine Types */}
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
            <Utensils className="h-3 w-3" />
            Cuisine
          </h4>
          <div className="flex flex-wrap gap-1">
            {vendor.cuisineTypes.map(cuisine => (
              <Badge key={cuisine} variant="secondary" className="text-xs">
                {formatCuisineType(cuisine)}
              </Badge>
            ))}
          </div>
        </div>

        {/* Dietary Options */}
        {vendor.dietaryOptions && vendor.dietaryOptions.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Dietary Options</h4>
            <div className="flex flex-wrap gap-1">
              {vendor.dietaryOptions.map(option => (
                <Badge key={option} variant="outline" className="text-xs">
                  {formatDietaryOption(option)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Popular Items */}
        {vendor.popularItems && vendor.popularItems.length > 0 && variant === 'detailed' && (
          <div>
            <h4 className="text-sm font-medium mb-2">Popular Items</h4>
            <div className="flex flex-wrap gap-1">
              {vendor.popularItems.map(item => (
                <Badge key={item} variant="outline" className="text-xs">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Contact & Social Links */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            {vendor.website && (
              <Button
                variant="outline"
                size="sm"
                asChild
              >
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
              <Button
                variant="outline"
                size="sm"
                asChild
              >
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
              <Button
                variant="outline"
                size="sm"
                asChild
              >
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
              <Button
                variant="ghost"
                size="sm"
                asChild
              >
                <a
                  href={`tel:${vendor.phone}`}
                  className="flex items-center gap-1"
                >
                  <Phone className="h-3 w-3" />
                </a>
              </Button>
            )}

            {vendor.email && (
              <Button
                variant="ghost"
                size="sm"
                asChild
              >
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
      </div>
    </Card>
  );
}

/**
 * Vendor card skeleton for loading states
 */
export function VendorCardSkeleton({ variant = 'default' }: { variant?: 'default' | 'compact' | 'detailed' }) {
  if (variant === 'compact') {
    return (
      <Card className="p-3">
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-1">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </div>
            <div className="h-4 bg-muted rounded w-12"></div>
          </div>
          <div className="h-3 bg-muted rounded w-full"></div>
          <div className="h-5 bg-muted rounded w-20"></div>
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
          <div className="h-5 bg-muted rounded w-24"></div>
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded w-16"></div>
          <div className="h-4 bg-muted rounded w-12"></div>
        </div>
      </div>
      <div className="h-4 bg-muted rounded w-full"></div>
      <div className="h-12 bg-muted rounded w-full"></div>
      <div className="space-y-2">
        <div className="h-4 bg-muted rounded w-20"></div>
        <div className="flex gap-1">
          <div className="h-6 bg-muted rounded w-16"></div>
          <div className="h-6 bg-muted rounded w-20"></div>
          <div className="h-6 bg-muted rounded w-18"></div>
        </div>
      </div>
      <div className="flex items-center justify-between pt-2 border-t">
        <div className="flex gap-2">
          <div className="h-8 bg-muted rounded w-20"></div>
          <div className="h-8 bg-muted rounded w-24"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-8 bg-muted rounded w-8"></div>
          <div className="h-8 bg-muted rounded w-8"></div>
        </div>
      </div>
    </Card>
  );
}

export default VendorCard;