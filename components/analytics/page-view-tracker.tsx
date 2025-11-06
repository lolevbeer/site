'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Component to track page views on client-side navigation
 * This ensures SPA navigation is tracked in Google Analytics
 */
export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window !== 'undefined' && window.gtag) {
      const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');

      window.gtag('event', 'page_view', {
        page_path: url,
        page_title: document.title,
      });
    }
  }, [pathname, searchParams]);

  return null;
}
