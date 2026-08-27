/**
 * Beer Map Page Loading Skeleton
 * Displays a page-shaped skeleton while map loads
 */

import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Skeleton className="h-4 w-48 mb-6" />

      <div className="text-center mb-8">
        <Skeleton className="h-10 w-64 mx-auto mb-4" />
        <Skeleton className="w-16 h-1 bg-primary mx-auto rounded-full" />
      </div>

      <div className="mb-8 max-w-md mx-auto">
        <div className="border border-border rounded-lg p-6">
          <Skeleton className="h-6 w-32 mb-4" />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex justify-between mb-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg" style={{ height: '700px', position: 'relative' }}>
        <Skeleton className="h-full w-full" />
      </div>
    </div>
  )
}
