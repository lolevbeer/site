'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Navigation } from './navigation';
import { MobileMenu } from './mobile-menu';
import { LogoWithText } from '@/components/ui/logo';
import { LocationTabs } from '@/components/location/location-tabs';
import { cn } from '@/lib/utils';

/**
 * Main site header component with logo, navigation, and mobile menu toggle
 */
export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      // Use hysteresis to prevent flickering at threshold
      // Scroll down: trigger at 20px, scroll up: clear at 5px
      setIsScrolled(prev => {
        if (prev && scrollY < 5) return false;
        if (!prev && scrollY > 20) return true;
        return prev;
      });
    };

    // Check initial scroll position
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-background transition-all duration-200">
        <div className="container mx-auto px-4 sm:px-4 lg:px-4">
          <div className={cn(
            "flex items-center justify-between transition-all duration-200",
            isScrolled ? "h-14" : "h-16"
          )}>
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center">
                <LogoWithText priority={true} collapsed={isScrolled} />
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-4">
              <Navigation />
              <LocationTabs syncWithGlobalState={true}>
                {/* Location tabs in header */}
              </LocationTabs>
            </div>

            {/* Mobile menu button - animated two-line hamburger */}
            <button
              onClick={toggleMobileMenu}
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMobileMenuOpen}
              className="flex items-center justify-center w-10 h-10 md:hidden rounded-md hover:bg-muted transition-colors"
            >
              <div className="relative w-5 h-2.5 flex flex-col justify-between">
                <span
                  className={cn(
                    "block h-0.5 w-full bg-foreground rounded-full transition-all duration-300 ease-out origin-center",
                    isMobileMenuOpen ? "rotate-45 translate-y-[4px]" : "rotate-0 translate-y-0"
                  )}
                />
                <span
                  className={cn(
                    "block h-0.5 w-full bg-foreground rounded-full transition-all duration-300 ease-out origin-center",
                    isMobileMenuOpen ? "-rotate-45 -translate-y-[4px]" : "rotate-0 translate-y-0"
                  )}
                />
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        isScrolled={isScrolled}
      />
    </>
  );
}