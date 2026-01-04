import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function LocationCardSkeleton() {
  return (
    <Card className="p-3 border-0 shadow-none bg-[var(--color-card-interactive)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-7 w-20 shrink-0" />
      </div>
    </Card>
  )
}

export function LocationListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <LocationCardSkeleton key={i} />
      ))}
    </div>
  )
}
