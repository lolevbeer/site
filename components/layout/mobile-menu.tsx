'use client';

import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Navigation } from './navigation';
import { SocialLinks } from './social-links';
import { LocationTabs } from '@/components/location/location-tabs';

interface MobileMenuProps {
  /** Whether the mobile menu is open */
  isOpen: boolean;
  /** Callback to close the mobile menu */
  onClose: () => void;
}

/**
 * Mobile hamburger menu with navigation and social links
 */
export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
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

      return () => {
        document.removeEventListener('keydown', handleEscape);
        // Restore to the stored value or empty string to use CSS default
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed top-16 left-0 right-0 bottom-0 z-40 bg-black/10 transition-opacity duration-200 md:hidden",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Mobile Menu Panel */}
      <div
        className={cn(
          "fixed top-16 right-0 z-50 h-[calc(100vh-4rem)] w-full bg-background shadow-lg transition-transform duration-200 ease-out md:hidden overflow-hidden",
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

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <Navigation
              vertical
              onItemClick={onClose}
              className="space-y-2"
            />
          </div>

          {/* Social Links and Footer */}
          <div className="px-6 py-4">
            <div className="mb-4 flex justify-center">
              <SocialLinks size="sm" />
            </div>

            {/* Quick contact info */}
            <div className="text-xs text-muted-foreground text-center">
              <p className="font-medium">Lolev Beer</p>
              <p>Lawrenceville & Zelienople</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}