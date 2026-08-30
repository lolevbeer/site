/**
 * Reports whether the app has hydrated on the client.
 *
 * Replaces the `const [mounted, setMounted] = useState(false)` +
 * `useEffect(() => setMounted(true), [])` pattern. That pattern always cost an
 * extra render pass and trips React 19's `react-hooks/set-state-in-effect`
 * rule, which flags synchronous setState in an effect as a cascading render.
 *
 * `useSyncExternalStore` expresses the same thing natively: the server snapshot
 * is `false` and the client snapshot is `true`, so the value flips exactly once
 * as hydration completes, with no state update to schedule.
 */
'use client'

import { useSyncExternalStore } from 'react'

/** Never fires — hydration happens once and the snapshot never changes after. */
const subscribe = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false

export function useIsHydrated(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)
}
