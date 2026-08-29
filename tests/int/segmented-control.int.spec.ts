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
})
