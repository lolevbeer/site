'use client'

import { useState, useEffect, useRef, useMemo } from 'react'

export type AnimationState = 'entering' | 'exiting' | 'stable'

export interface AnimatedItem<T> {
  item: T
  state: AnimationState
  key: string
}

interface UseAnimatedListOptions<T> {
  getKey: (item: T) => string
  exitDuration?: number
  enterDuration?: number
}

/**
 * Hook for animating list item changes (enter/exit)
 *
 * Design principles:
 * - Animation state lives ONLY in React state (no drift between refs and state)
 * - Timeouts are tracked and cleared to prevent races
 * - Functional state updates avoid stale closures
 */
export function useAnimatedList<T>(
  items: T[],
  options: UseAnimatedListOptions<T>
): AnimatedItem<T>[] {
  const { getKey, exitDuration = 500, enterDuration = 600 } = options

  // Stable key for dependency tracking
  const currentKeysString = useMemo(() => items.map(getKey).join(','), [items, getKey])

  // Track previous keys (just keys, not items - items are in state)
  const prevKeysRef = useRef<Set<string>>(new Set())
  const isFirstRender = useRef(true)

  // Track timeouts so we can clear them
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Main state: all items with their animation states
  const [animatedItems, setAnimatedItems] = useState<AnimatedItem<T>[]>(() =>
    items.map(item => ({ item, state: 'stable' as AnimationState, key: getKey(item) }))
  )

  useEffect(() => {
    const currentKeys = new Set(items.map(getKey))

    // First render: just set stable items, no animations
    if (isFirstRender.current) {
      isFirstRender.current = false
      prevKeysRef.current = currentKeys
      setAnimatedItems(items.map(item => ({
        item,
        state: 'stable',
        key: getKey(item)
      })))
      return
    }

    const prevKeys = prevKeysRef.current

    // Find entering keys (in current but not in prev)
    const enteringKeys = new Set<string>()
    currentKeys.forEach(key => {
      if (!prevKeys.has(key)) {
        enteringKeys.add(key)
      }
    })

    // Find exiting keys (in prev but not in current)
    const exitingKeys = new Set<string>()
    prevKeys.forEach(key => {
      if (!currentKeys.has(key)) {
        exitingKeys.add(key)
      }
    })

    // Cancel exit timeouts for items that are coming back
    enteringKeys.forEach(key => {
      const exitTimeout = timeoutsRef.current.get(`exit-${key}`)
      if (exitTimeout) {
        clearTimeout(exitTimeout)
        timeoutsRef.current.delete(`exit-${key}`)
      }
    })

    // Update state using functional update to get latest state
    setAnimatedItems(prev => {
      const result: AnimatedItem<T>[] = []

      // Add all current items (entering or stable)
      items.forEach(item => {
        const key = getKey(item)
        result.push({
          item,
          state: enteringKeys.has(key) ? 'entering' : 'stable',
          key,
        })
      })

      // Preserve exiting items from previous state
      // This includes both newly exiting AND still-animating exits
      // BUT skip items that have come back (are in currentKeys)
      prev.forEach(ai => {
        // Skip if this item is now back in current items
        if (currentKeys.has(ai.key)) {
          return
        }

        const isNewlyExiting = exitingKeys.has(ai.key)
        const isStillExiting = ai.state === 'exiting'

        if (isNewlyExiting || isStillExiting) {
          // Don't add duplicates
          if (!result.some(r => r.key === ai.key)) {
            result.push({
              ...ai,
              state: 'exiting',
            })
          }
        }
      })

      return result
    })

    // Handle entering timeouts
    enteringKeys.forEach(key => {
      // Clear any existing timeout for this key
      const existingTimeout = timeoutsRef.current.get(`enter-${key}`)
      if (existingTimeout) {
        clearTimeout(existingTimeout)
      }

      const timeout = setTimeout(() => {
        timeoutsRef.current.delete(`enter-${key}`)
        setAnimatedItems(prev =>
          prev.map(ai => ai.key === key && ai.state === 'entering'
            ? { ...ai, state: 'stable' }
            : ai
          )
        )
      }, enterDuration)

      timeoutsRef.current.set(`enter-${key}`, timeout)
    })

    // Handle exiting timeouts
    exitingKeys.forEach(key => {
      // Clear any existing timeout for this key
      const existingTimeout = timeoutsRef.current.get(`exit-${key}`)
      if (existingTimeout) {
        clearTimeout(existingTimeout)
      }

      const timeout = setTimeout(() => {
        timeoutsRef.current.delete(`exit-${key}`)
        // Only remove the exiting version, not any version with this key
        setAnimatedItems(prev => prev.filter(ai => !(ai.key === key && ai.state === 'exiting')))
      }, exitDuration)

      timeoutsRef.current.set(`exit-${key}`, timeout)
    })

    // Update previous keys for next comparison
    prevKeysRef.current = currentKeys

    // Cleanup on unmount
    return () => {
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout))
      timeoutsRef.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKeysString, enterDuration, exitDuration])

  return animatedItems
}

/**
 * Get CSS class name for animation state
 */
export function getAnimationClass(state: AnimationState): string {
  switch (state) {
    case 'entering':
      return 'menu-item-enter'
    case 'exiting':
      return 'menu-item-exit'
    default:
      return 'menu-item-stable'
  }
}
