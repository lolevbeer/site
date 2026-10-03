/**
 * Allowed values for the distributors collection's select fields.
 *
 * Each list feeds the collection's select options, the matching type, and the
 * CSV parser's validation (`parse-distributors-csv.ts`), so a value the
 * importer accepts is always one the collection can store.
 */

/** `customerType` options: stored value and admin label. */
export const CUSTOMER_TYPES = [
  { value: 'Retail', label: 'Retail' },
  { value: 'On Premise', label: 'On Premise' },
  { value: 'Home-D', label: 'Home Delivery' },
] as const

export type CustomerType = (typeof CUSTOMER_TYPES)[number]['value']

const CUSTOMER_TYPE_VALUES: ReadonlySet<string> = new Set(CUSTOMER_TYPES.map((t) => t.value))

/** True for a stored `customerType` value (not its label). */
export function isCustomerType(value: string): value is CustomerType {
  return CUSTOMER_TYPE_VALUES.has(value)
}

/** `region` options: the 50 US states plus DC, as `[code, name]` pairs. */

const STATE_ENTRIES = [
  ['AL', 'Alabama'],
  ['AK', 'Alaska'],
  ['AZ', 'Arizona'],
  ['AR', 'Arkansas'],
  ['CA', 'California'],
  ['CO', 'Colorado'],
  ['CT', 'Connecticut'],
  ['DE', 'Delaware'],
  ['DC', 'District of Columbia'],
  ['FL', 'Florida'],
  ['GA', 'Georgia'],
  ['HI', 'Hawaii'],
  ['ID', 'Idaho'],
  ['IL', 'Illinois'],
  ['IN', 'Indiana'],
  ['IA', 'Iowa'],
  ['KS', 'Kansas'],
  ['KY', 'Kentucky'],
  ['LA', 'Louisiana'],
  ['ME', 'Maine'],
  ['MD', 'Maryland'],
  ['MA', 'Massachusetts'],
  ['MI', 'Michigan'],
  ['MN', 'Minnesota'],
  ['MS', 'Mississippi'],
  ['MO', 'Missouri'],
  ['MT', 'Montana'],
  ['NE', 'Nebraska'],
  ['NV', 'Nevada'],
  ['NH', 'New Hampshire'],
  ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'],
  ['NY', 'New York'],
  ['NC', 'North Carolina'],
  ['ND', 'North Dakota'],
  ['OH', 'Ohio'],
  ['OK', 'Oklahoma'],
  ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'],
  ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'],
  ['SD', 'South Dakota'],
  ['TN', 'Tennessee'],
  ['TX', 'Texas'],
  ['UT', 'Utah'],
  ['VT', 'Vermont'],
  ['VA', 'Virginia'],
  ['WA', 'Washington'],
  ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'],
  ['WY', 'Wyoming'],
] as const

export type StateCode = (typeof STATE_ENTRIES)[number][0]

export const US_STATES: ReadonlyArray<{ code: StateCode; name: string }> = STATE_ENTRIES.map(
  ([code, name]) => ({ code, name }),
)

const CODES: ReadonlySet<string> = new Set(STATE_ENTRIES.map(([code]) => code))

/** True for an uppercase two-letter code in {@link US_STATES}. */
export function isStateCode(value: string): value is StateCode {
  return CODES.has(value)
}
