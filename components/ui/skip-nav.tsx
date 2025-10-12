'use client';

/**
 * Skip Navigation Link Component
 * Allows keyboard users to skip directly to main content
 * WCAG 2.4.1 - Bypass Blocks
 */
export function SkipNav() {
  return (
    <a
      href="#main-content"
      className="skip-nav-link sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      Skip to main content
    </a>
  );
}
