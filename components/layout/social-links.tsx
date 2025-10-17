'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Instagram,
  Facebook,
  ExternalLink,
} from 'lucide-react';
import { UntappdIcon } from '@/components/icons/untappd-icon';

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
    color: 'hover:text-foreground',
    label: 'Follow us on Instagram',
  },
  {
    name: 'Threads',
    href: 'https://threads.net/@lolevbeer',
    icon: ({ className }) => (
      <svg
        viewBox="0 0 192 192"
        fill="currentColor"
        className={className}
        aria-hidden="true"
      >
        <path d="M141.537 88.9883C140.71 88.5919 139.87 88.2104 139.019 87.8451C137.537 60.5382 122.616 44.905 97.5619 44.745C97.4484 44.7443 97.3355 44.7443 97.222 44.7443C82.2364 44.7443 69.7731 51.1409 62.102 62.7807L75.881 72.2328C81.6116 63.5383 90.6052 61.6848 97.2286 61.6848C97.3051 61.6848 97.3819 61.6848 97.4576 61.6855C105.707 61.7381 111.932 64.1366 115.961 68.814C118.893 72.2193 120.854 76.925 121.825 82.8638C114.511 81.6207 106.601 81.2385 98.145 81.7233C74.3247 83.0954 59.0111 96.9879 60.0396 116.292C60.5615 126.084 65.4397 134.508 73.775 140.011C80.8224 144.663 89.899 146.938 99.3323 146.423C111.79 145.74 121.563 140.987 128.381 132.296C133.559 125.696 136.834 117.143 138.28 106.366C144.217 109.949 148.617 114.664 151.047 120.332C155.179 129.967 155.42 145.8 142.501 158.708C131.182 170.016 117.576 174.908 97.0135 175.059C74.2042 174.89 56.9538 167.575 45.7381 153.317C35.2355 139.966 29.8077 120.682 29.6052 96C29.8077 71.3178 35.2355 52.0336 45.7381 38.6827C56.9538 24.4249 74.2039 17.11 97.0132 16.9405C119.988 17.1113 137.539 24.4614 149.184 38.788C154.894 45.8136 159.199 54.6488 162.037 64.9503L178.184 60.6422C174.744 47.9622 169.331 37.0357 161.965 27.974C147.036 9.60668 125.202 0.195148 97.0695 0H96.9569C68.8816 0.19447 47.2921 9.6418 32.7883 28.0793C19.8819 44.4864 13.2244 67.3157 13.0007 95.9325L13 96L13.0007 96.0675C13.2244 124.684 19.8819 147.514 32.7883 163.921C47.2921 182.358 68.8816 191.806 96.9569 192H97.0695C122.03 191.827 139.624 185.292 154.118 170.811C173.081 151.866 172.51 128.119 166.26 113.541C161.776 103.087 153.227 94.5962 141.537 88.9883ZM98.4405 129.507C88.0005 130.095 77.1544 125.409 76.6196 115.372C76.2232 107.93 81.9158 99.626 99.0812 98.6368C101.047 98.5234 102.976 98.468 104.871 98.468C111.106 98.468 116.939 99.0737 122.242 100.233C120.264 124.935 108.662 128.946 98.4405 129.507Z"/>
      </svg>
    ),
    color: 'hover:text-foreground',
    label: 'Follow us on Threads',
  },
  {
    name: 'Facebook',
    href: 'https://facebook.com/lolevbeer',
    icon: Facebook,
    color: 'hover:text-foreground',
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
    color: 'hover:text-foreground',
    label: 'Follow us on TikTok',
  },
  {
    name: 'X (Twitter)',
    href: 'https://x.com/lolevbeer',
    icon: ({ className }) => (
      <svg
        viewBox="0 0 1668.56 1221.19"
        fill="currentColor"
        className={className}
        aria-hidden="true"
      >
        <path d="M283.94,167.31l386.39,516.64L281.5,1104h87.51l340.42-367.76L984.48,1104h297.8L874.15,558.3l361.92-390.99h-87.51l-313.51,338.7l-253.31-338.7H283.94z M412.63,231.77h136.81l604.13,807.76h-136.81L412.63,231.77z" transform="translate(52.390088,-25.058597)"/>
      </svg>
    ),
    color: 'hover:text-foreground',
    label: 'Follow us on X (Twitter)',
  },
  {
    name: 'Untappd',
    href: 'https://untappd.com/lolev',
    icon: UntappdIcon,
    color: 'hover:text-foreground',
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
    sm: 'h-5 w-5',
    md: 'h-6 w-6',
    lg: 'h-7 w-7',
  };

  const buttonSizes = {
    sm: 'h-9 w-9',
    md: 'h-10 w-10',
    lg: 'h-11 w-11',
  };

  return (
    <div
      className={cn(
        'flex items-center',
        direction === 'horizontal'
          ? className?.includes('w-full') ? 'justify-between' : 'space-x-2'
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