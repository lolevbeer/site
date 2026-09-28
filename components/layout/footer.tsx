'use client'

import React from 'react'
import Link from 'next/link'
import { SocialLinks } from './social-links'
import { HandwrittenLolevLogo } from '@/components/icons'
import { footerOnlyItems, navigationItems } from './navigation'
import { ThemeSwitcher } from '@/components/ui/theme-switcher'

/** Shared style for every text link in the footer (nav list and legal row). */
const FOOTER_LINK_CLASS = 'text-muted-foreground hover:text-foreground transition-colors'

interface FooterProps {
  /**
   * Server-rendered taproom columns (name, address, phone, hours).
   * Passed in from the layout so this client chrome does not own that text.
   */
  taprooms: React.ReactNode
}

/**
 * Main footer. Taproom NAP and hours arrive as `taprooms` from the server
 * layout; this component is the brand column, nav, and legal row.
 */
export function Footer({ taprooms }: FooterProps) {
  return (
    <footer className="bg-background">
      <div className="gradient-separator" />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-12 md:grid-cols-3">
          {taprooms}

          {/* Brand and Links */}
          <div className="flex flex-col items-center">
            <p className="text-sm text-muted-foreground mb-6">Haze • Crispy • Funky • Oaked</p>

            <ul className="space-y-2 text-sm mb-6 text-center">
              {[...navigationItems, ...footerOnlyItems].map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={FOOTER_LINK_CLASS}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <HandwrittenLolevLogo className="py-12 w-48 text-muted-foreground" />

            <SocialLinks size="sm" className="mt-auto w-full" />
          </div>
        </div>

        {/* Bottom footer */}
        <div className="mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Lolev Beer. All rights reserved.
            </p>
            <ThemeSwitcher />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center text-sm">
            <Link href="/privacy" className={FOOTER_LINK_CLASS}>
              Privacy Policy
            </Link>
            <Link href="/accessibility" className={FOOTER_LINK_CLASS}>
              Accessibility
            </Link>
            <Link href="/terms" className={FOOTER_LINK_CLASS}>
              Terms of Service
            </Link>
            <Link href="/admin" rel="nofollow" className={FOOTER_LINK_CLASS}>
              Login
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
