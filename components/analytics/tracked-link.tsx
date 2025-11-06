'use client';

import Link from 'next/link';
import { ComponentPropsWithoutRef } from 'react';
import { trackExternalLink, trackSocialClick } from '@/lib/analytics/events';

interface TrackedLinkProps extends ComponentPropsWithoutRef<typeof Link> {
  /** Track as social media link */
  social?: 'instagram' | 'facebook' | 'twitter' | 'untappd';
  /** Track as external link */
  external?: boolean;
  /** Custom link text for tracking */
  linkText?: string;
}

/**
 * Link component with automatic analytics tracking
 * Use for external links and social media links
 */
export function TrackedLink({
  href,
  social,
  external,
  linkText,
  children,
  onClick,
  ...props
}: TrackedLinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Track social links
    if (social) {
      trackSocialClick(social);
    }
    // Track external links
    else if (external || (typeof href === 'string' && href.startsWith('http'))) {
      trackExternalLink(
        typeof href === 'string' ? href : href.toString(),
        linkText || (typeof children === 'string' ? children : undefined)
      );
    }

    // Call original onClick if provided
    onClick?.(e);
  };

  return (
    <Link href={href} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
