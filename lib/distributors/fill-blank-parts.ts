/**
 * Fill the blank parts of a distributor row from the geocoder's answer. A cell the
 * row already has (the CSV supplied it) is never changed; `inferred` names exactly
 * what was filled so the import report can show it for review.
 *
 * Blank means undefined, null, empty, or only whitespace. `region` is US-only: it is
 * set only for a US row, from a state the geocoder named in full (`Pennsylvania`),
 * and only when that name is one of the 50 states or DC.
 */
import { US_STATES, isStateCode, type StateCode } from './fields'

/** The parts a geocoder can return for an address. */
export type ResolvedParts = {
  city?: string
  state?: string
  /** ISO-3166-1 alpha-2, uppercase. */
  country?: string
  zip?: string
}

/** The row cells that can be filled (each may be blank); a whole CSV row fits too. */
type RowParts = {
  city?: string | null
  state?: string | null
  country?: string | null
  zip?: string | null
  [other: string]: unknown
}

export type FilledParts = ResolvedParts & { region?: StateCode }

/** Order the parts appear in `inferred`, so reports read the same every time. */
const FILLABLE = ['city', 'state', 'country', 'zip'] as const

const blank = (value: unknown) => typeof value !== 'string' || !value.trim()

/** The state code for a state name or code, or undefined when it is neither. */
function stateCode(name: string): StateCode | undefined {
  const trimmed = name.trim()
  if (isStateCode(trimmed)) return trimmed
  return US_STATES.find((s) => s.label.toLowerCase() === trimmed.toLowerCase())?.value
}

export function fillBlankParts(
  row: RowParts,
  resolved: ResolvedParts,
): { filled: FilledParts; inferred: (typeof FILLABLE)[number][] } {
  const filled: FilledParts = {}
  const inferred: (typeof FILLABLE)[number][] = []

  const country = blank(row.country) ? resolved.country : (row.country as string).trim()
  const isUS = country === 'US'
  let region: StateCode | undefined = blank(row.state) ? undefined : stateCode(row.state as string)

  for (const part of FILLABLE) {
    const incoming = resolved[part]
    if (!blank(row[part]) || blank(incoming)) continue
    if (part === 'state' && isUS) {
      const code = stateCode(incoming!)
      if (!code) continue
      filled.state = region = code
    } else {
      filled[part] = incoming!.trim()
    }
    inferred.push(part)
  }

  if (isUS && region) filled.region = region

  return { filled, inferred }
}
