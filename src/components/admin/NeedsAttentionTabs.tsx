'use client'

/**
 * Client half of the Needs attention widget: the card header (title + row
 * count), and for viewers assigned to several locations, Payload `Tabs` that
 * switch between per-location row lists the server already rendered.
 */
import type React from 'react'
import { useState } from 'react'
import { Pill, Tabs } from '@payloadcms/ui'

export type AttentionPanel = { value: string; label: string; count: number; rows: React.ReactNode }

/** Widget title with the number of rows as a Pill. */
export function AttentionHeader({ count }: { count: number }): React.JSX.Element {
  return (
    <div className="widget-card__header">
      <h3 className="widget-card__title">Needs attention</h3>
      {count > 0 && (
        <Pill pillStyle="light-gray" size="small" aria-label={`${count} items`}>
          {count}
        </Pill>
      )}
    </div>
  )
}

/** Header, location tabs, and the selected location's rows. */
export function NeedsAttentionTabs({ panels }: { panels: AttentionPanel[] }): React.JSX.Element {
  const [value, setValue] = useState(panels[0]?.value ?? '')
  const selected = panels.find((panel) => panel.value === value) ?? panels[0]

  return (
    <>
      <AttentionHeader count={selected?.count ?? 0} />
      <Tabs
        className="needs-attention__tabs"
        onChange={setValue}
        tabs={panels.map(({ value, label }) => ({ value, label }))}
        value={value}
      />
      {selected?.rows}
    </>
  )
}
