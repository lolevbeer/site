'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NavItem } from '@/lib/types';

/**
 * Navigation menu items configuration
 */
const navigationItems: NavItem[] = [
  {
    label: 'Beer Map',
    href: '/beer-map',
  },
  {
    label: 'Taproom',
    href: '/taproom',
  },
  {
    label: 'Cans',
    href: '/cans',
  },
  {
    label: 'Up Next',
    href: '/up-next',
  },
  {
    label: 'Food',
    href: '/food',
  },
  {
    label: 'Events',
    href: '/events',
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
    <nav className={cn(
      vertical
        ? "flex flex-col space-y-1"
        : "flex items-center space-x-6 lg:space-x-8",
      className
    )}>
      {navigationItems.map((item) => {
        const isActive = pathname === item.href ||
          (item.href !== '/' && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onItemClick}
            className={cn(
              "relative transition-colors duration-200",
              vertical
                ? "flex items-center rounded-md px-3 py-2 text-sm font-medium"
                : "text-sm font-medium",
              isActive
                ? vertical
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground after:absolute after:bottom-[-4px] after:left-0 after:h-0.5 after:w-full after:bg-primary"
                : vertical
                  ? "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
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