import { cn } from '@/lib/utils'

/** Skeleton placeholder with a shimmer gradient animation */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("shimmer rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
