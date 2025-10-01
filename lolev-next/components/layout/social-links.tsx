'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Instagram,
  Facebook,
  Twitter,
  MessageCircle,
  ExternalLink,
} from 'lucide-react';

interface SocialLink {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  label: string;
}

/**
 * Social media links configuration
 */
const socialLinks: SocialLink[] = [
  {
    name: 'Instagram',
    href: 'https://instagram.com/lolevbeer',
    icon: Instagram,
    color: 'hover:text-pink-600',
    label: 'Follow us on Instagram',
  },
  {
    name: 'Threads',
    href: 'https://threads.net/@lolevbeer',
    icon: MessageCircle,
    color: 'hover:text-foreground',
    label: 'Follow us on Threads',
  },
  {
    name: 'Facebook',
    href: 'https://facebook.com/lolevbeer',
    icon: Facebook,
    color: 'hover:text-blue-600',
    label: 'Like us on Facebook',
  },
  {
    name: 'TikTok',
    href: 'https://tiktok.com/@lolevbeer',
    icon: ({ className }) => (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-hidden="true"
      >
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
      </svg>
    ),
    color: 'hover:text-black',
    label: 'Follow us on TikTok',
  },
  {
    name: 'X (Twitter)',
    href: 'https://x.com/lolevbeer',
    icon: Twitter,
    color: 'hover:text-sky-500',
    label: 'Follow us on X (Twitter)',
  },
  {
    name: 'Untappd',
    href: 'https://untappd.com/lolevbeer',
    icon: ({ className }) => (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-hidden="true"
      >
        <path d="M17.37 12.41l-1.06-1.06L8.66 9.69l1.06 1.06 7.65 1.66zm-2.83-2.83L12 7.24l-2.54 2.34 2.54 2.34 2.54-2.34zm-2.54 8.28l-2.54-2.34L7.58 17.9l2.54 2.34L12 17.86zm7.41-7.41l-1.66-7.65L16.1 1.14l1.66 7.65 1.65 1.66zm-13.82 0L1.14 16.1l1.66 1.66 7.65-1.66 1.66-1.66-7.65-7.65zm8.28 8.28l7.65 1.66 1.66-1.66-1.66-7.65-1.66-1.66-7.65 7.65z"/>
      </svg>
    ),
    color: 'hover:text-yellow-600',
    label: 'Rate our beers on Untappd',
  },
];

interface SocialLinksProps {
  /** Size variant for the social icons */
  size?: 'sm' | 'md' | 'lg';
  /** Layout direction */
  direction?: 'horizontal' | 'vertical';
  /** Additional CSS classes */
  className?: string;
  /** Show labels alongside icons */
  showLabels?: boolean;
}

/**
 * Social media links component with brewery social profiles
 */
export function SocialLinks({
  size = 'md',
  direction = 'horizontal',
  className,
  showLabels = false,
}: SocialLinksProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const buttonSizes = {
    sm: 'h-8 w-8',
    md: 'h-9 w-9',
    lg: 'h-10 w-10',
  };

  return (
    <div
      className={cn(
        'flex items-center',
        direction === 'horizontal'
          ? 'space-x-2'
          : 'flex-col space-y-2',
        className
      )}
      role="list"
      aria-label="Social media links"
    >
      {socialLinks.map((social) => {
        const IconComponent = social.icon;

        if (showLabels) {
          return (
            <Link
              key={social.name}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex items-center space-x-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'text-muted-foreground hover:text-foreground',
                social.color
              )}
              aria-label={social.label}
            >
              <IconComponent className={sizeClasses[size]} />
              <span>{social.name}</span>
              <ExternalLink className="h-3 w-3 opacity-50" />
            </Link>
          );
        }

        return (
          <Button
            key={social.name}
            variant="ghost"
            size="icon"
            asChild
            className={cn(
              buttonSizes[size],
              'text-muted-foreground transition-colors',
              social.color
            )}
          >
            <Link
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={social.label}
            >
              <IconComponent className={sizeClasses[size]} />
            </Link>
          </Button>
        );
      })}
    </div>
  );
}

/**
 * Export social links data for use in other components
 */
export { socialLinks };