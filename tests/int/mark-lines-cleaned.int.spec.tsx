import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import type { FieldAccess, PayloadRequest, SanitizedCollectionConfig, User } from 'payload'
import { Locations } from '@/src/collections/Locations'
import { MarkLinesCleanedButton } from '@/src/components/admin/MarkLinesCleanedButton'

const state = vi.hoisted(() => ({ roles: ['lead-bartender'], setValue: vi.fn() }))
vi.mock('@payloadcms/ui', () => ({
  useAuth: () => ({ user: { roles: state.roles } }),
  useDocumentInfo: () => ({ id: 'menu-1', collectionSlug: 'menus' }),
  useField: ({ path }: { path: string }) => ({
    value: path === 'location' ? 'loc-1' : undefined,
    setValue: state.setValue,
  }),
  Banner: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Button: ({
    buttonStyle: _style,
    size: _size,
    ...props
  }: ComponentProps<'button'> & {
    buttonStyle?: string
    size?: string
  }) => <button {...props} />,
}))

beforeEach(() => {
  state.roles = ['lead-bartender']
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ linesLastCleaned: '2026-09-20T16:00:00.000Z' }),
    }),
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('line cleaning feedback', () => {
  it('shows the last date, sends a today command, and confirms the saved server date', async () => {
    render(<MarkLinesCleanedButton />)
    await screen.findByText('Last cleaned: Sep 20, 2026')
    expect(screen.queryByRole('link')).toBeNull()
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ doc: { linesLastCleaned: '2026-09-28T16:00:00.000Z' } }),
    } as Response)
    fireEvent.click(screen.getByRole('button', { name: 'Mark Lines Cleaned Today' }))
    await screen.findByRole('status')
    expect(screen.getByText('Last cleaned: Sep 28, 2026')).toBeTruthy()
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/locations/loc-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ markLinesCleanedToday: true }),
      }),
    )
  })

  it('reports failure without claiming success or changing the date', async () => {
    render(<MarkLinesCleanedButton />)
    await screen.findByText('Last cleaned: Sep 20, 2026')
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 403 } as Response)
    fireEvent.click(screen.getByRole('button', { name: 'Mark Lines Cleaned Today' }))
    await screen.findByRole('alert')
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText('Last cleaned: Sep 20, 2026')).toBeTruthy()
  })

  it('links admins to the existing manual date picker', async () => {
    state.roles = ['admin']
    render(<MarkLinesCleanedButton />)
    await waitFor(() =>
      expect(screen.getByRole('link').getAttribute('href')).toBe(
        '/admin/collections/locations/loc-1',
      ),
    )
  })
})

const collection = Locations as SanitizedCollectionConfig

function accessFor(name: string): FieldAccess {
  const field = Locations.fields.find((field) => 'name' in field && field.name === name)
  if (!field || !('access' in field) || !field.access?.update) throw new Error('Missing access')
  return field.access.update
}

function reqFor(roles: string[]): PayloadRequest {
  return { user: { id: 'lead-1', roles, locations: ['loc-1'] } as User } as PayloadRequest
}

describe('line cleaning permissions', () => {
  it('allows only admins to choose a date, while leads can record today', async () => {
    for (const [roles, manual, today] of [
      [['admin'], true, true],
      [['lead-bartender'], false, true],
      [['bartender'], false, false],
      [[], false, false],
    ] as const) {
      const req = reqFor([...roles])
      expect(await accessFor('linesLastCleaned')({ req, collection })).toBe(manual)
      expect(await accessFor('markLinesCleanedToday')({ req, collection })).toBe(today)
    }
    const update = Locations.access!.update!
    expect(await update({ req: reqFor(['lead-bartender']), slug: 'locations' })).toEqual({
      id: { in: ['loc-1'] },
    })
  })

  it('supplies the server date for today and preserves an admin correction otherwise', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-28T16:00:00.000Z'))
    const hook = Locations.hooks!.beforeChange![0]
    const args = {
      req: reqFor(['lead-bartender']),
      operation: 'update' as const,
      originalDoc: {},
      collection,
      context: {},
    }
    const result = await hook({
      ...args,
      data: {
        markLinesCleanedToday: true,
        linesLastCleaned: '2000-01-01T00:00:00.000Z',
      },
    } as Parameters<typeof hook>[0])
    expect(result.linesLastCleaned).toBe('2026-09-28T16:00:00.000Z')
    expect(result.markLinesCleanedToday).toBeUndefined()
    const manual = await hook({
      ...args,
      req: reqFor(['admin']),
      data: {
        linesLastCleaned: '2026-09-25T16:00:00.000Z',
      },
    } as Parameters<typeof hook>[0])
    expect(manual.linesLastCleaned).toBe('2026-09-25T16:00:00.000Z')
  })
})
