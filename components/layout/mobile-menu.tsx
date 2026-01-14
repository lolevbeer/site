'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { SocialLinks } from './social-links';
import { LocationTabs } from '@/components/location/location-tabs';
import { navigationItems } from './navigation';

interface MobileMenuProps {
  /** Whether the mobile menu is open */
  isOpen: boolean;
  /** Callback to close the mobile menu */
  onClose: () => void;
  /** Whether the page is scrolled (header is compact) */
  isScrolled?: boolean;
}

/**
 * Mobile hamburger menu with navigation and social links
 */
export function MobileMenu({ isOpen, onClose, isScrolled = false }: MobileMenuProps) {
  const pathname = usePathname();
  const [shouldAnimate, setShouldAnimate] = useState(false);

  // Handle escape key press and body scroll lock
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Store the current overflow value before changing it
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      // Trigger staggered animations after menu starts opening
      const timer = setTimeout(() => setShouldAnimate(true), 50);

      return () => {
        document.removeEventListener('keydown', handleEscape);
        // Restore to the stored value or empty string to use CSS default
        document.body.style.overflow = originalOverflow;
        clearTimeout(timer);
      };
    } else {
      // Reset animation state when menu closes
      setShouldAnimate(false);
    }
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed left-0 right-0 bottom-0 z-40 bg-black/10 transition-all duration-200 md:hidden",
          isScrolled ? "top-14" : "top-16",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Mobile Menu Panel */}
      <div
        className={cn(
          "fixed right-0 z-50 w-full bg-background shadow-lg transition-all duration-200 ease-out md:hidden overflow-hidden",
          isScrolled ? "top-14 h-[calc(100vh-3.5rem)]" : "top-16 h-[calc(100vh-4rem)]",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation menu"
      >
        <div className="flex h-full flex-col">
          {/* Location Switcher */}
          <div className="px-6 py-4">
            <div className="flex justify-end">
              <LocationTabs syncWithGlobalState={true} />
            </div>
          </div>

          {/* Navigation - centered with staggered animations */}
          <nav className="flex-1 flex flex-col justify-center" aria-label="Main navigation">
            {navigationItems.map((item, index) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "py-5 text-2xl font-bold text-center transition-all duration-300",
                    "hover:bg-muted/50 active:bg-muted",
                    isActive ? "text-primary" : "text-foreground",
                    // Staggered animation
                    shouldAnimate
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-4"
                  )}
                  style={{
                    transitionDelay: shouldAnimate ? `${index * 75}ms` : '0ms',
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Footer with social links */}
          <div
            className={cn(
              "px-6 py-6 transition-all duration-300",
              shouldAnimate
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            )}
            style={{
              transitionDelay: shouldAnimate ? `${navigationItems.length * 75 + 100}ms` : '0ms',
            }}
          >
            <div className="flex justify-center">
              <SocialLinks size="sm" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}