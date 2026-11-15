'use client'

import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { SocialLinks } from './social-links'
import { isNavItemActive, navigationItems } from './navigation'

interface MobileMenuProps {
  /** Whether the mobile menu is open */
  isOpen: boolean
  /** Callback to close the mobile menu */
  onClose: () => void
  /** Whether the page is scrolled (header is compact) */
  isScrolled?: boolean
}

/**
 * Mobile hamburger menu with navigation and social links.
 *
 * Radix Dialog owns focus trapping, scroll locking, Escape handling, and focus
 * restoration. The location switcher and the menu button (which turns into the
 * X while open) stay in `Header`, outside this dialog.
 */
export function MobileMenu({ isOpen, onClose, isScrolled = false }: MobileMenuProps) {
  const pathname = usePathname()

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog.Portal forceMount>
          <Dialog.Overlay asChild forceMount>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'fixed left-0 right-0 bottom-0 z-40 bg-black/10 backdrop-blur-xl md:hidden',
                isScrolled ? 'top-14' : 'top-16',
              )}
            />
          </Dialog.Overlay>

          <Dialog.Content
            asChild
            forceMount
            aria-describedby={undefined}
            // The header's X button is outside this panel. Leave its press to
            // the button's own toggle; dismissing here too would reopen the menu.
            onPointerDownOutside={(event) => {
              if ((event.target as Element).closest('[data-mobile-menu-trigger]')) {
                event.preventDefault()
              }
            }}
          >
            <motion.div
              initial={{ x: '100%', filter: 'blur(4px)' }}
              animate={{ x: 0, filter: 'blur(0px)' }}
              exit={{ x: '100%', filter: 'blur(4px)' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className={cn(
                // Scrolls (not clips) on short landscape screens; dvh tracks mobile browser chrome.
                'fixed right-0 z-50 w-full bg-background shadow-lg md:hidden overflow-y-auto overscroll-contain',
                isScrolled ? 'top-14 h-[calc(100dvh-3.5rem)]' : 'top-16 h-[calc(100dvh-4rem)]',
              )}
            >
              <Dialog.Title className="sr-only">Mobile navigation menu</Dialog.Title>
              {/* The visible X is the header's menu button, which sits outside
                this modal: screen readers are told to ignore it and keyboard
                focus is trapped in here. This is their close button, shown
                only when focused from the keyboard. `[clip:auto]` undoes the
                `clip` in the `.sr-only` rule in globals.css, and `z-10` lifts
                it above the animated nav links. */}
              <Dialog.Close className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-2 focus-visible:top-2 focus-visible:z-10 focus-visible:[clip:auto] focus-visible:rounded-md focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-semibold focus-visible:text-primary-foreground">
                Close menu
              </Dialog.Close>
              <div className="flex min-h-full flex-col">
                {/* Navigation - centered with staggered animations */}
                <nav
                  className="flex-1 flex flex-col justify-center-safe"
                  aria-label="Main navigation"
                >
                  {navigationItems.map((item, index) => {
                    const isActive = isNavItemActive(pathname, item.href)
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
                          prefetch={item.prefetch}
                          onClick={onClose}
                          aria-current={isActive ? 'page' : undefined}
                          className={cn(
                            'block py-5 text-2xl font-bold text-center',
                            'hover:bg-muted/50 active:bg-muted',
                            isActive ? 'text-primary' : 'text-foreground',
                          )}
                        >
                          {item.label}
                        </Link>
                      </motion.div>
                    )
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
          </Dialog.Content>
        </Dialog.Portal>
      )}
    </AnimatePresence>
  )
}
