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

    const originalStyle = window.getComputedStyle(document.body).overflow;

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = originalStyle;
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/10 transition-opacity duration-300 md:hidden",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Mobile Menu Panel */}
      <div
        className={cn(
          "fixed top-16 right-0 z-50 h-[calc(100vh-4rem)] w-full bg-background border-l shadow-lg transition-transform duration-300 ease-in-out md:hidden overflow-hidden",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation menu"
      >
        <div className="flex h-full flex-col">
          {/* Location Switcher */}
          <div className="border-b px-6 py-4">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
              Location
            </h3>
            <LocationTabs syncWithGlobalState={true} />
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
          <div className="border-t px-6 py-4">
            <div className="mb-4">
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                Follow Us
              </h3>
              <SocialLinks size="sm" />
            </div>

            {/* Quick contact info */}
            <div className="text-xs text-muted-foreground">
              <p className="font-medium">Lolev Beer</p>
              <p>Lawrenceville & Zelienople</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}