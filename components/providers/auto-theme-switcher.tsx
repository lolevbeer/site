'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { getPittsburghTheme } from '@/lib/utils/pittsburgh-time';

/**
 * Sets initial theme for menu display pages based on Pittsburgh time.
 * SSE handles ongoing theme updates - this just sets the initial state
 * and provides fallback for visibility/focus changes.
 */
export function AutoThemeSwitcher() {
  const pathname = usePathname();
  const { setTheme } = useTheme();

  useEffect(() => {
    // Only apply Pittsburgh-time logic on menu display pages
    if (!pathname?.startsWith('/m/')) return;

    function updateTheme() {
      const theme = getPittsburghTheme();
      // Set via next-themes to prevent it from overriding with OS preference
      setTheme(theme);
      // Also set class directly for immediate effect
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }

    // Set initial theme immediately (before SSE connects)
    updateTheme();

    // Re-check on visibility change (fallback if SSE disconnects)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateTheme();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Re-check on focus (some TV browsers use this instead)
    const handleFocus = () => updateTheme();
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [pathname, setTheme]);

  return null;
}
