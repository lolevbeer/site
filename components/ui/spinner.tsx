import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

function Spinner({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className
      )}
      {...props}
    />
  )
}

export { Spinner }
