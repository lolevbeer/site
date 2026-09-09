/**
 * Shared chrome for /privacy, /terms, and /accessibility.
 * No BlurFade — those routes are the hard-load control in blur-fade SSR tests.
 */

import type { ReactNode } from 'react'
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs'

export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string
  lastUpdated: string
  children: ReactNode
}) {
  const headingId = 'legal-page-title'
  return (
    <article className="container mx-auto px-4 py-8 max-w-3xl" aria-labelledby={headingId}>
      <PageBreadcrumbs className="mb-6" />
      <header className="text-center mb-10">
        <h1 id={headingId} className="text-4xl font-bold tracking-tight mb-3">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
      </header>
      <div className="prose prose-lg dark:prose-invert max-w-none space-y-8 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2">
        {children}
      </div>
    </article>
  )
}
