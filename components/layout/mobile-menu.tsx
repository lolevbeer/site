'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "fixed left-0 right-0 bottom-0 z-40 bg-black/10 backdrop-blur-xl md:hidden",
              isScrolled ? "top-14" : "top-16"
            )}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Mobile Menu Panel - spring-animated slide-in */}
          <motion.div
            initial={{ x: '100%', filter: 'blur(4px)' }}
            animate={{ x: 0, filter: 'blur(0px)' }}
            exit={{ x: '100%', filter: 'blur(4px)' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={cn(
              "fixed right-0 z-50 w-full bg-background shadow-lg md:hidden overflow-hidden",
              isScrolled ? "top-14 h-[calc(100vh-3.5rem)]" : "top-16 h-[calc(100vh-4rem)]"
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
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        type: 'spring',
                        stiffness: 300,
                        damping: 30,
                        delay: index * 0.05,
                      }}
                    >
                      <Link
                        href={item.href}
                        onClick={onClose}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "block py-5 text-2xl font-bold text-center",
                          "hover:bg-muted/50 active:bg-muted",
                          isActive ? "text-primary" : "text-foreground"
                        )}
                      >
                        {item.label}
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>

              {/* Footer with social links */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 30,
                  delay: navigationItems.length * 0.05 + 0.1,
                }}
                className="px-6 py-6"
              >
                <div className="flex justify-center">
                  <SocialLinks size="sm" />
                </div>
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}