'use client'
/**
 * The Items list on a menu (Menus.ts `items`). It replaces Payload's array
 * field, whose rows are accordions, so each item is one line that never
 * collapses: drag handle, number, picker, a closed price toggle and a ⋯ menu
 * (move, add, duplicate, remove). Price and promotion are rarely set, so they
 * open under the line only on request, or after a save rejects one of them.
 *
 * Built only from @payloadcms/ui's public exports; styles are in
 * src/app/(payload)/custom.scss. Saving still runs the field's server
 * validation (required, the duplicate check in Menus.ts).
 * ponytail: no row copy/paste, which needs Payload's unexported clipboard helpers.
 */
import {
  AlignJustifiedIcon,
  ArrowIcon,
  Button,
  ChevronIcon,
  DraggableSortable,
  DraggableSortableItem,
  DuplicateIcon,
  FieldDescription,
  FieldError,
  FieldLabel,
  MoreIcon,
  PlusIcon,
  Popup,
  PopupList,
  RenderFields,
  useField,
  useForm,
  useFormFields,
  useFormSubmitted,
  XIcon,
} from '@payloadcms/ui'
import type { ArrayFieldClientProps, ClientField } from 'payload'
import { type ComponentProps, useId, useState } from 'react'

type RowActions = {
  add: (rowIndex: number) => void
  duplicate: (rowIndex: number) => void
  move: (from: number, to: number) => void
  remove: (rowIndex: number) => void
}

type Sortable = Parameters<ComponentProps<typeof DraggableSortableItem>['children']>[0]

type SubFields = Omit<ComponentProps<typeof RenderFields>, 'fields' | 'parentPath'>

function isProduct(field: ClientField): boolean {
  return 'name' in field && field.name === 'product'
}

export function MenuItemsField({
  field,
  path: pathFromProps,
  permissions,
  readOnly,
  schemaPath = field.name,
}: ArrayFieldClientProps) {
  const {
    disabled,
    path,
    rows = [],
    showError,
  } = useField({
    hasRows: true,
    potentiallyStalePath: pathFromProps,
  })
  const { addFieldRow, dispatchFields, moveFieldRow, removeFieldRow, setModified } = useForm()
  const locked = Boolean(readOnly || disabled)

  const actions: RowActions = {
    add: (rowIndex) => addFieldRow({ path, rowIndex, schemaPath }),
    duplicate: (rowIndex) => {
      dispatchFields({ type: 'DUPLICATE_ROW', path, rowIndex })
      setModified(true)
    },
    move: (moveFromIndex, moveToIndex) => moveFieldRow({ moveFromIndex, moveToIndex, path }),
    remove: (rowIndex) => removeFieldRow({ path, rowIndex }),
  }
  // The product picker goes on the item's line; price and promotion under its toggle.
  const productFields = field.fields.filter(isProduct)
  const extraFields = field.fields.filter((subField) => !isProduct(subField))
  const subFields: SubFields = {
    forceRender: true, // otherwise fields render as they scroll into view, shifting the rows
    parentIndexPath: '',
    parentSchemaPath: schemaPath,
    permissions: permissions === true ? true : (permissions?.fields ?? {}),
    readOnly: locked,
  }

  return (
    <div className="field-type menu-items-field" id={`field-${path.replace(/\./g, '__')}`}>
      <FieldLabel as="h3" label={field.label} path={path} required={field.required} />
      <FieldDescription description={field.admin?.description} path={path} />
      <FieldError path={path} showError={showError} />
      <DraggableSortable
        className="menu-items-field__rows"
        ids={rows.map((row) => row.id)}
        onDragEnd={({ moveFromIndex, moveToIndex }) => actions.move(moveFromIndex, moveToIndex)}
      >
        {rows.map((row, index) => (
          <DraggableSortableItem disabled={locked} id={row.id} key={row.id}>
            {(sortable) => (
              <ItemRow
                actions={actions}
                extraFields={extraFields}
                index={index}
                locked={locked}
                productFields={productFields}
                rowCount={rows.length}
                rowPath={`${path}.${index}`}
                subFields={subFields}
                {...sortable}
              />
            )}
          </DraggableSortableItem>
        ))}
      </DraggableSortable>
      {!locked && (
        <Button
          buttonStyle="ghost"
          icon={<PlusIcon />}
          iconPosition="left"
          margin={false}
          onClick={() => actions.add(rows.length)}
        >
          Add item
        </Button>
      )}
    </div>
  )
}

/** One item's line. Its own component, keyed by row ID, so the toggle's state follows the item. */
function ItemRow({
  actions,
  attributes,
  extraFields,
  index,
  isDragging,
  listeners,
  locked,
  productFields,
  rowCount,
  rowPath,
  setActivatorNodeRef,
  setNodeRef,
  subFields,
  transform,
  transition,
}: Sortable & {
  actions: RowActions
  extraFields: ClientField[]
  index: number
  locked: boolean
  productFields: ClientField[]
  rowCount: number
  rowPath: string
  subFields: SubFields
}) {
  const number = String(index + 1).padStart(2, '0')
  const label = `Item ${number}`
  const extrasId = useId()
  const [toggled, setToggled] = useState(false)
  const submitted = useFormSubmitted()
  const price = useFormFields(([state]) => state[`${rowPath}.price`]?.value)
  const promotion = useFormFields(([state]) => state[`${rowPath}.promotion`]?.value)
  // Promotion's own condition in Menus.ts (cans menus only) decides whether it counts.
  const hasPromotion = useFormFields(
    ([state]) => state[`${rowPath}.promotion`]?.passesCondition !== false,
  )
  const invalid = useFormFields(
    ([state]) =>
      state[`${rowPath}.price`]?.valid === false || state[`${rowPath}.promotion`]?.valid === false,
  )
  const open = toggled || (submitted && invalid)

  const title = hasPromotion ? 'Price & promotion' : 'Price'
  const values = [price, hasPromotion && promotion].filter(Boolean).join(' · ')

  return (
    <div
      aria-label={label}
      className="menu-items-field__row"
      ref={setNodeRef}
      role="group"
      style={{ transform, transition, zIndex: isDragging ? 1 : undefined }}
    >
      {!locked && (
        <button
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="menu-items-field__drag"
          ref={setActivatorNodeRef}
          type="button"
        >
          <AlignJustifiedIcon />
        </button>
      )}
      <span aria-hidden className="menu-items-field__number">
        {number}
      </span>
      <RenderFields
        {...subFields}
        className="menu-items-field__product"
        fields={productFields}
        parentPath={rowPath}
      />
      <button
        aria-controls={extrasId}
        aria-expanded={open}
        className="menu-items-field__toggle"
        onClick={() => setToggled(!open)}
        type="button"
      >
        <span>{values ? `${title}: ${values}` : title}</span>
        <ChevronIcon direction={open ? 'up' : 'down'} size={16} />
      </button>
      {!locked && (
        <Popup
          button={<MoreIcon />}
          buttonAriaLabel={`More options: ${label}`}
          caret={false}
          className="menu-items-field__menu"
          horizontalAlign="right"
          popupType="menu"
          render={({ close }) => {
            const andClose = (act: () => void) => () => {
              act()
              close()
            }
            return (
              <PopupList.ButtonGroup>
                {index > 0 && (
                  <PopupList.Button
                    icon={<ArrowIcon direction="up" size={24} />}
                    onClick={andClose(() => actions.move(index, index - 1))}
                  >
                    Move up
                  </PopupList.Button>
                )}
                {index < rowCount - 1 && (
                  <PopupList.Button
                    icon={<ArrowIcon direction="down" size={24} />}
                    onClick={andClose(() => actions.move(index, index + 1))}
                  >
                    Move down
                  </PopupList.Button>
                )}
                <PopupList.Button
                  icon={<PlusIcon size={24} />}
                  onClick={andClose(() => actions.add(index + 1))}
                >
                  Add below
                </PopupList.Button>
                <PopupList.Button
                  icon={<DuplicateIcon size={24} />}
                  onClick={andClose(() => actions.duplicate(index))}
                >
                  Duplicate
                </PopupList.Button>
                <PopupList.Button
                  icon={<XIcon size={24} />}
                  onClick={andClose(() => actions.remove(index))}
                >
                  Remove
                </PopupList.Button>
              </PopupList.ButtonGroup>
            )
          }}
        />
      )}
      <div className="menu-items-field__extras" hidden={!open} id={extrasId}>
        <RenderFields {...subFields} fields={extraFields} parentPath={rowPath} />
      </div>
    </div>
  )
}
