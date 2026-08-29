'use client'

import { cn } from '@/lib/utils'

export type SegmentedSize = 'sm' | 'default'

export interface SegmentedOption {
  value: string
  label: string
}

interface SegmentedControlProps {
  'aria-label': string
  className?: string
  onValueChange: (value: string) => void
  options: readonly SegmentedOption[]
  size?: SegmentedSize
  value?: string
}

/**
 * Shared single-choice control for filters and global preferences.
 *
 * These are buttons rather than tabs because they update state without owning
 * tab panels. `aria-pressed` exposes the selected option while keeping every
 * choice in the normal tab order.
 */
export const SEGMENTED_TROUGH_CLASS =
  'rounded-sm bg-black/[0.06] p-1 gap-0.5 text-muted-foreground dark:bg-muted/40'
export const SEGMENTED_ITEM_SELECTED_CLASS = 'bg-background text-foreground'
export const SEGMENTED_ITEM_IDLE_CLASS = 'text-muted-foreground hover:text-foreground/70'

const TROUGH_PADDING_PX = 4
const TROUGH_GAP_PX = 2

const GROUP_SIZE_CLASS: Record<SegmentedSize, string> = {
  sm: 'h-9',
  default: 'h-10',
}

const ITEM_SIZE_CLASS: Record<SegmentedSize, string> = {
  sm: 'px-2.5 text-xs',
  default: 'px-4 text-sm',
}

export function SegmentedControl({
  'aria-label': ariaLabel,
  className,
  onValueChange,
  options,
  size = 'default',
  value,
}: SegmentedControlProps) {
  const activeIndex = options.findIndex((option) => option.value === value)
  const count = options.length

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'relative grid w-fit items-center justify-center',
        SEGMENTED_TROUGH_CLASS,
        GROUP_SIZE_CLASS[size],
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      {activeIndex >= 0 ? (
        <span
          aria-hidden
          data-slot="segmented-indicator"
          className="absolute top-1 bottom-1 left-1 rounded-sm bg-background transition-transform duration-200 ease-out motion-reduce:transition-none"
          style={{
            width: `calc((100% - ${TROUGH_PADDING_PX * 2}px - ${(count - 1) * TROUGH_GAP_PX}px) / ${count})`,
            transform: `translateX(calc(${activeIndex * 100}% + ${activeIndex * TROUGH_GAP_PX}px))`,
          }}
        />
      ) : null}

      {options.map((option, index) => {
        const isActive = index === activeIndex

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'relative inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-sm py-1.5 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              ITEM_SIZE_CLASS[size],
              isActive ? 'text-foreground' : SEGMENTED_ITEM_IDLE_CLASS,
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
