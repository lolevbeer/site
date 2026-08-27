/**
 * Beer Page Loading Skeleton
 * Displays a page-shaped skeleton while beer listing loads
 */

import { Skeleton } from '@/components/ui/skeleton'
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs'

export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Real breadcrumbs — driven by usePathname, no data to wait for */}
      <PageBreadcrumbs className="mb-6" />

      {/* Page title */}
      <div className="mb-8">
        <Skeleton className="h-10 w-48 mb-4" />
      </div>

      {/* Filter bar */}
      <div className="sticky top-16 z-20 glass rounded-lg p-3 mb-6">
        <div className="flex items-center gap-3">
          <Skeleton className="flex-1 h-9" />
          <Skeleton className="flex-1 h-9" />
          <Skeleton className="flex-1 h-9" />
          <Skeleton className="flex-1 h-9" />
        </div>
      </div>

      {/* Beer grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {Array.from({ length: 15 }).map((_, i) => (
          <Skeleton key={i} className="h-72 w-full" />
        ))}
      </div>
    </div>
  )
}
