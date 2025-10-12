'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NavItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { MapPin, Beer, Utensils, Calendar, Info, HelpCircle } from 'lucide-react';

/**
 * Navigation menu items configuration
 */
const navigationItems: NavItem[] = [
  {
    label: 'Find Lolev',
    href: '/beer-map',
    icon: MapPin,
  },
  {
    label: 'Beer',
    href: '/beer',
    icon: Beer,
  },
  {
    label: 'Food',
    href: '/food',
    icon: Utensils,
  },
  {
    label: 'Events',
    href: '/events',
    icon: Calendar,
  },
  {
    label: 'About',
    href: '/about',
    icon: Info,
  },
  {
    label: 'FAQ',
    href: '/faq',
    icon: HelpCircle,
  },
];

interface NavigationProps {
  /** Additional CSS classes */
  className?: string;
  /** Callback when navigation item is clicked (useful for mobile) */
  onItemClick?: () => void;
  /** Whether to show in vertical layout (mobile) */
  vertical?: boolean;
}

/**
 * Main navigation component with brewery menu items
 */
export function Navigation({
  className,
  onItemClick,
  vertical = false
}: NavigationProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        vertical
          ? "flex flex-col space-y-1"
          : "flex items-center space-x-2 lg:space-x-4 xl:space-x-6",
        className
      )}
      aria-label="Main navigation"
    >
      {navigationItems.map((item) => {
        const isActive = pathname === item.href;

        if (vertical) {
          const IconComponent = item.icon;
          return (
            <Button
              key={item.href}
              variant="secondary"
              asChild
              className={cn(
                "w-full justify-start",
                isActive && "bg-primary text-primary-foreground"
              )}
            >
              <Link
                href={item.href}
                onClick={onItemClick}
                aria-current={isActive ? "page" : undefined}
              >
                {IconComponent && <IconComponent className="mr-2 h-4 w-4" />}
                {item.label}
              </Link>
            </Button>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onItemClick}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative transition-all duration-200 ease-in-out whitespace-nowrap text-sm font-medium",
              isActive
                ? "text-foreground font-semibold"
                : "text-foreground hover:text-muted-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Export navigation items for use in other components
 */
export { navigationItems };