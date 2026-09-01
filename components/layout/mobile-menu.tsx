'use client'

import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { SocialLinks } from './social-links'
import { navigationItems } from './navigation'

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
 * restoration. The location switcher stays in `Header`, outside this dialog.
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

          <Dialog.Content asChild forceMount aria-describedby={undefined}>
            <motion.div
              initial={{ x: '100%', filter: 'blur(4px)' }}
              animate={{ x: 0, filter: 'blur(0px)' }}
              exit={{ x: '100%', filter: 'blur(4px)' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className={cn(
                'fixed right-0 z-50 w-full bg-background shadow-lg md:hidden overflow-hidden',
                isScrolled ? 'top-14 h-[calc(100vh-3.5rem)]' : 'top-16 h-[calc(100vh-4rem)]',
              )}
            >
              <Dialog.Title className="sr-only">Mobile navigation menu</Dialog.Title>
              <Dialog.Close asChild>
                <button
                  aria-label="Close menu"
                  className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted transition-colors"
                >
                  <span className="relative h-5 w-5">
                    <span className="absolute top-1/2 block h-0.5 w-full rotate-45 bg-foreground rounded-full" />
                    <span className="absolute top-1/2 block h-0.5 w-full -rotate-45 bg-foreground rounded-full" />
                  </span>
                </button>
              </Dialog.Close>
              <div className="flex h-full flex-col">
                {/* Navigation - centered with staggered animations */}
                <nav className="flex-1 flex flex-col justify-center" aria-label="Main navigation">
                  {navigationItems.map((item, index) => {
                    const isActive = pathname === item.href
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
