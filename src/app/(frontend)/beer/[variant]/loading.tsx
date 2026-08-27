/**
 * Beer Detail Loading Skeleton
 * Mirrors the detail page layout (container from beer/[variant]/page.tsx,
 * two-column grid from components/beer/beer-details.tsx) so detail
 * navigations don't flash the listing-grid skeleton from beer/loading.tsx.
 */

import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Skeleton className="h-4 w-48 mb-6" />

      <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-8 mb-8">
        <div className="space-y-4">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="space-y-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-6 w-40" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}
