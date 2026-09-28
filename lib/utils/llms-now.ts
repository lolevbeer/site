/**
 * Markdown sections for llms.txt: what is pouring, scheduled, and how to call.
 * Built from location documents and menu/event/food rows. Empty lists are omitted.
 */

import { taproomPhones } from '@/lib/config/locations'

export interface LlmsNowLocation {
  name: string
  onTap: string[]
  cans: string[]
  events: { name: string; date: string }[]
  food: { name: string; date: string }[]
}

function listLine(label: string, items: string[]): string | null {
  const names = items.map((item) => item.trim()).filter(Boolean)
  if (names.length === 0) return null
  return `- ${label}: ${names.join(', ')}`
}

function datedLine(label: string, rows: { name: string; date: string }[]): string | null {
  const formatted = rows
    .map((row) => {
      const name = row.name.trim()
      const date = row.date.trim()
      if (!name || !date) return ''
      return `${date} ${name}`
    })
    .filter(Boolean)
  if (formatted.length === 0) return null
  return `- ${label}: ${formatted.join('; ')}`
}

/** Per-taproom draft list, cans, upcoming food, and upcoming events. */
export function formatPouringNow(locations: LlmsNowLocation[]): string {
  const blocks = locations
    .map((location) => {
      const lines = [
        listLine('On tap', location.onTap),
        listLine('Cans to go', location.cans),
        datedLine('Food', location.food),
        datedLine('Events', location.events),
      ].filter((line): line is string => Boolean(line))
      if (lines.length === 0) return ''
      return `### ${location.name}\n${lines.join('\n')}`
    })
    .filter(Boolean)
  if (blocks.length === 0) return ''
  return `## Pouring now\n\n${blocks.join('\n\n')}`
}

/** One phone line per taproom that has a number. */
export function formatPhoneLines(
  locations: Array<{ name?: string | null; basicInfo?: { phone?: string | null } | null }>,
): string {
  return taproomPhones(locations)
    .map((entry) => `- ${entry.name}: ${entry.phone}`)
    .join('\n')
}
