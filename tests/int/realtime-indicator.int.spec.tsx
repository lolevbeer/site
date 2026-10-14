/**
 * RealtimeIndicator: the small lightning bolt in a menu board's corner. It is
 * visible only while the display is connected to Ably, and it re-keys its icon
 * on every push so the CSS pulse animation restarts.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { RealtimeIndicator } from '@/components/menu/realtime-indicator'

afterEach(cleanup)

describe('RealtimeIndicator', () => {
  it('renders nothing while the display is not connected to Ably', () => {
    const { container } = render(<RealtimeIndicator connected={false} pulseKey={0} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows a labelled icon that ignores pointer events while connected', () => {
    render(<RealtimeIndicator connected pulseKey={0} />)
    const indicator = screen.getByRole('img', { name: 'Live updates connected' })
    expect(indicator.className).toContain('pointer-events-none')
    expect(indicator.querySelector('svg')).not.toBeNull()
  })

  it('restarts the pulse by remounting the icon when a push arrives', () => {
    const { rerender } = render(<RealtimeIndicator connected pulseKey={0} />)
    const before = screen.getByRole('img').querySelector('svg')

    rerender(<RealtimeIndicator connected pulseKey={0} />)
    expect(screen.getByRole('img').querySelector('svg')).toBe(before)

    rerender(<RealtimeIndicator connected pulseKey={1} />)
    const after = screen.getByRole('img').querySelector('svg')
    expect(after).not.toBeNull()
    expect(after).not.toBe(before)
    expect(after?.getAttribute('class')).toContain('live-pulse')
  })
})
