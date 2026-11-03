import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { SegmentedControl } from '@/components/ui/segmented-control'

const options = [
  { value: 'all', label: 'All' },
  { value: 'tap', label: 'On tap' },
  { value: 'cans', label: 'In cans' },
] as const

afterEach(cleanup)

describe('SegmentedControl', () => {
  it('exposes the selected choice without tab-panel semantics', () => {
    render(
      createElement(SegmentedControl, {
        'aria-label': 'Filter by availability',
        onValueChange: () => undefined,
        options,
        value: 'tap',
      }),
    )

    expect(screen.getByRole('group', { name: 'Filter by availability' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'On tap' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.queryByRole('tab')).toBeNull()
  })

  it('reports the selected value', () => {
    const onValueChange = vi.fn()
    render(
      createElement(SegmentedControl, {
        'aria-label': 'Filter by availability',
        onValueChange,
        options,
        value: 'all',
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'In cans' }))

    expect(onValueChange).toHaveBeenCalledOnce()
    expect(onValueChange).toHaveBeenCalledWith('cans')
  })

  it('grows each option to a 44px touch target on coarse pointers', () => {
    render(
      createElement(SegmentedControl, {
        'aria-label': 'Filter by availability',
        onValueChange: () => undefined,
        options,
        size: 'sm',
        value: 'all',
      }),
    )

    expect(screen.getByRole('group').className).toContain('pointer-coarse:h-auto')
    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toContain('pointer-coarse:min-h-11')
    }
  })

  // jsdom has no layout, so this checks the classes that let a label wrap
  // (measured in a browser: four labels overflowed their buttons at 360px).
  it('wraps a label that does not fit instead of spilling out of its button', () => {
    render(
      createElement(SegmentedControl, {
        'aria-label': 'Filter by availability',
        onValueChange: () => undefined,
        options,
        value: 'all',
      }),
    )

    expect(screen.getByRole('group').className).toContain('min-h-10')
    expect(screen.getByRole('group').className).not.toMatch(/(^|\s)h-10(\s|$)/)
    for (const button of screen.getAllByRole('button')) {
      expect(button.className).not.toContain('whitespace-nowrap')
      expect(button.className).toContain('text-balance')
    }
  })
})
