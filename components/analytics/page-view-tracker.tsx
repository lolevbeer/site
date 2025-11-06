'use client';

import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Internal component that uses useSearchParams
 */
function PageViewTrackerInternal() {
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

/**
 * Component to track page views on client-side navigation
 * This ensures SPA navigation is tracked in Google Analytics
 * Wrapped in Suspense for Next.js 16 compatibility
 */
export function PageViewTracker() {
  return (
    <Suspense fallback={null}>
      <PageViewTrackerInternal />
    </Suspense>
  );
}
