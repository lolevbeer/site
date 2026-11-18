/**
 * Menu Items list (MenuItemsField, the `items` field on Menus): each item is
 * one labelled line whose controls run in tab order (drag handle, picker,
 * price toggle, ⋯ menu); the price fields stay closed until opened or invalid
 * after a save, the toggle names any values set, and the row menu and Add
 * button edit the right row.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ArrayFieldClientProps } from 'payload'
import type { ReactNode } from 'react'
import { MenuItemsField } from '@/src/components/admin/MenuItemsField'

type FieldState = { passesCondition?: boolean; valid?: boolean; value?: unknown }

const state = vi.hoisted(() => ({
  fields: {} as Record<string, FieldState>,
  submitted: false,
  form: {
    addFieldRow: vi.fn(),
    dispatchFields: vi.fn(),
    moveFieldRow: vi.fn(),
    removeFieldRow: vi.fn(),
    setModified: vi.fn(),
  },
}))

vi.mock('@payloadcms/ui', () => {
  const Icon = () => null
  const Children = ({ children }: { children: ReactNode }) => <div>{children}</div>
  const ActionButton = ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
    <button onClick={onClick} type="button">
      {children}
    </button>
  )
  return {
    AlignJustifiedIcon: Icon,
    ArrowIcon: Icon,
    ChevronIcon: Icon,
    DuplicateIcon: Icon,
    MoreIcon: Icon,
    PlusIcon: Icon,
    XIcon: Icon,
    FieldDescription: Icon,
    FieldError: Icon,
    FieldLabel: Icon,
    Button: ActionButton,
    DraggableSortable: Children,
    DraggableSortableItem: ({ children }: { children: (args: object) => ReactNode }) =>
      children({
        attributes: {},
        listeners: {},
        setNodeRef: () => {},
        transform: '',
        transition: '',
      }),
    Popup: ({
      buttonAriaLabel,
      render,
    }: {
      buttonAriaLabel: string
      render: (args: { close: () => void }) => ReactNode
    }) => (
      <div>
        <button aria-label={buttonAriaLabel} type="button" />
        {render({ close: () => {} })}
      </div>
    ),
    PopupList: { Button: ActionButton, ButtonGroup: Children },
    // One input per sub-field, named by its path, so tests can find each field.
    RenderFields: ({ fields, parentPath }: { fields: { name: string }[]; parentPath: string }) => (
      <div>
        {fields.map((field) => (
          <input aria-label={`${parentPath}.${field.name}`} key={field.name} />
        ))}
      </div>
    ),
    useField: () => ({ path: 'items', rows: [{ id: 'a' }, { id: 'b' }], showError: false }),
    useForm: () => state.form,
    useFormFields: (select: (args: [Record<string, FieldState>]) => unknown) =>
      select([state.fields]),
    useFormSubmitted: () => state.submitted,
  }
})

const props = {
  field: {
    name: 'items',
    fields: [
      { name: 'product', type: 'relationship' },
      { name: 'price', type: 'text' },
      { name: 'promotion', type: 'text' },
    ],
  },
  path: 'items',
  permissions: true,
  schemaPath: 'items',
} as unknown as ArrayFieldClientProps

function renderRow(label: string) {
  render(<MenuItemsField {...props} />)
  return screen.getByRole('group', { name: label })
}

beforeEach(() => {
  state.fields = {}
  state.submitted = false
  vi.clearAllMocks()
})
afterEach(cleanup)

describe('MenuItemsField', () => {
  it('puts each item on one line, in tab order: drag handle, picker, price toggle, menu', () => {
    const row = renderRow('Item 01')
    const controls = [...row.querySelectorAll('button, input')]
      .filter((control) => !control.closest('[hidden]'))
      .slice(0, 4)
      .map((control) => control.getAttribute('aria-label') ?? control.textContent)
    expect(controls).toEqual([
      'Drag to reorder',
      'items.0.product',
      'Price & promotion',
      'More options: Item 01',
    ])
  })

  it('keeps the price fields closed, naming any values set, until the toggle opens them', () => {
    state.fields = { 'items.0.price': { value: '$8' }, 'items.0.promotion': { value: '2 for $20' } }
    const row = renderRow('Item 01')
    const toggle = within(row).getByRole('button', { name: 'Price & promotion: $8 · 2 for $20' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(within(row).queryByRole('textbox', { name: 'items.0.price' })).toBeNull()

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(within(row).getByRole('textbox', { name: 'items.0.price' })).toBeTruthy()
    expect(within(row).getByRole('textbox', { name: 'items.0.promotion' })).toBeTruthy()
  })

  it('reads "Price" where promotions are off (non-cans menus), ignoring a leftover one', () => {
    state.fields = {
      'items.0.price': { value: '$7' },
      'items.0.promotion': { passesCondition: false, value: 'old' },
    }
    const row = renderRow('Item 01')
    expect(within(row).getByRole('button', { name: 'Price: $7' })).toBeTruthy()
  })

  it('opens the price fields of an item whose price or promotion failed to save', () => {
    state.submitted = true
    state.fields = { 'items.1.promotion': { valid: false, value: 'x'.repeat(61) } }
    render(<MenuItemsField {...props} />)
    const second = screen.getByRole('group', { name: 'Item 02' })
    expect(
      within(second)
        .getByRole('button', { name: /^Price & promotion/ })
        .getAttribute('aria-expanded'),
    ).toBe('true')
    const first = screen.getByRole('group', { name: 'Item 01' })
    expect(
      within(first)
        .getByRole('button', { name: 'Price & promotion' })
        .getAttribute('aria-expanded'),
    ).toBe('false')
  })

  it('edits the right row from its menu, and adds new items at the end', () => {
    const row = renderRow('Item 01')
    expect(within(row).queryByRole('button', { name: 'Move up' })).toBeNull()

    fireEvent.click(within(row).getByRole('button', { name: 'Move down' }))
    expect(state.form.moveFieldRow).toHaveBeenCalledWith({
      moveFromIndex: 0,
      moveToIndex: 1,
      path: 'items',
    })
    fireEvent.click(within(row).getByRole('button', { name: 'Add below' }))
    expect(state.form.addFieldRow).toHaveBeenCalledWith({
      path: 'items',
      rowIndex: 1,
      schemaPath: 'items',
    })
    fireEvent.click(within(row).getByRole('button', { name: 'Duplicate' }))
    expect(state.form.dispatchFields).toHaveBeenCalledWith({
      type: 'DUPLICATE_ROW',
      path: 'items',
      rowIndex: 0,
    })
    expect(state.form.setModified).toHaveBeenCalledWith(true)
    fireEvent.click(within(row).getByRole('button', { name: 'Remove' }))
    expect(state.form.removeFieldRow).toHaveBeenCalledWith({ path: 'items', rowIndex: 0 })

    fireEvent.click(screen.getByRole('button', { name: 'Add item' }))
    expect(state.form.addFieldRow).toHaveBeenLastCalledWith({
      path: 'items',
      rowIndex: 2,
      schemaPath: 'items',
    })
  })
})
