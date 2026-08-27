/**
 * Events Page Loading Skeleton
 * Displays a page-shaped skeleton while events list loads
 */

import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb skeleton */}
      <Skeleton className="h-4 w-48 mb-6" />

      {/* Title skeleton */}
      <div className="text-center mb-8">
        <Skeleton className="h-10 w-48 mx-auto" />
      </div>

      {/* Timeline list skeleton */}
      <div className="max-w-2xl mx-auto">
        <div className="space-y-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              {/* Timeline dot */}
              <div className="flex flex-col items-center">
                <Skeleton className="h-4 w-4 rounded-full" />
                <div className="h-16 w-px bg-border mt-2" />
              </div>
              {/* Timeline item content */}
              <div className="flex-1 pb-6">
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-32 mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer section skeleton */}
      <div className="text-center space-y-3 pt-12 mt-12">
        <Skeleton className="h-6 w-40 mx-auto mb-4" />
        <div className="flex justify-center gap-4 flex-wrap">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-40" />
        </div>
      </div>
    </div>
  )
}
