/**
 * City/ZIP combobox for the beer map. Place suggestions come from Mapbox;
 * store matches are passed in from the parent.
 */

'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Search } from '@/components/icons'
import { cn } from '@/lib/utils'
import type { PlaceSuggestion } from '@/lib/map/search'

export function MapSearchField({
  value,
  onValueChange,
  isSearching,
  suggestions,
  onSelect,
  onCommit,
  className,
  inputClassName,
}: {
  value: string
  onValueChange: (value: string) => void
  isSearching: boolean
  suggestions: PlaceSuggestion[]
  onSelect: (suggestion: PlaceSuggestion) => void
  onCommit: () => void
  className?: string
  inputClassName?: string
}) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const blurTimer = useRef<number | null>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const showList = open && suggestions.length > 0
  const currentIndex =
    suggestions.length === 0 ? 0 : Math.min(activeIndex, suggestions.length - 1)

  useEffect(() => {
    return () => {
      if (blurTimer.current) window.clearTimeout(blurTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!showList) return
    const option = listRef.current?.querySelector(`[data-index="${currentIndex}"]`)
    option?.scrollIntoView({ block: 'nearest' })
  }, [currentIndex, showList])

  const select = (suggestion: PlaceSuggestion) => {
    onSelect(suggestion)
    setOpen(false)
  }

  const commit = () => {
    onCommit()
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={cn('relative group', className)}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (showList && suggestions[currentIndex]) select(suggestions[currentIndex])
          else commit()
        }}
      >
        {isSearching ? (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 z-10" aria-hidden>
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 group-focus-within:text-foreground"
            aria-hidden
          />
        )}
        <Input
          type="search"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={showList ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={showList ? `${listId}-${currentIndex}` : undefined}
          aria-busy={isSearching}
          placeholder="City or ZIP"
          aria-label="Search city or ZIP"
          value={value}
          onChange={(event) => {
            onValueChange(event.target.value)
            setOpen(true)
            setActiveIndex(0)
          }}
          onFocus={() => {
            if (blurTimer.current) window.clearTimeout(blurTimer.current)
            setOpen(true)
          }}
          onBlur={(event) => {
            const next = event.relatedTarget as Node | null
            if (rootRef.current?.contains(next)) return
            blurTimer.current = window.setTimeout(() => setOpen(false), 120)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              if (!open) {
                setOpen(true)
                return
              }
              setActiveIndex((index) => Math.min(index + 1, Math.max(suggestions.length - 1, 0)))
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActiveIndex((index) => Math.max(index - 1, 0))
            } else if (event.key === 'Escape') {
              setOpen(false)
            }
          }}
          className={cn(
            'pl-9 bg-secondary border-0 transition-all duration-200 focus:bg-background focus:shadow-sm focus:ring-1 focus:ring-primary/20',
            inputClassName,
          )}
        />
      </form>
      {isSearching ? (
        <span className="sr-only" role="status">
          Searching
        </span>
      ) : null}
      {showList ? (
        <>
          <span className="sr-only" role="status">
            {suggestions.length} suggestions
          </span>
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Suggestions"
            className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-background py-1 shadow-md"
          >
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion.id}
                id={`${listId}-${index}`}
                data-index={index}
                role="option"
                aria-selected={index === currentIndex}
                className={cn(
                  'cursor-pointer px-3 py-2 text-sm min-h-6',
                  index === currentIndex ? 'bg-secondary' : 'hover:bg-secondary/60',
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault()
                  select(suggestion)
                }}
              >
                <span className="block font-medium">{suggestion.label}</span>
                {suggestion.subtitle ? (
                  <span className="block text-xs text-muted-foreground">{suggestion.subtitle}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}
