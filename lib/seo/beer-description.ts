/**
 * The description a beer page uses when staff haven't written one: the meta
 * description and the Product JSON-LD description. Most beers have no CMS
 * description, so without this every page shared one template sentence.
 * Built only from facts shown on the page (name, ABV, style, hops), so it
 * never goes stale between menu changes.
 */

export interface BeerDescriptionFacts {
  name: string
  abv?: number | null
  /** Style name; "Beer" or empty when the beer has none. */
  style?: string | null
  /** Comma-separated, as entered in the admin ("Citra, Mosaic"). */
  hops?: string | null
}

/** At most this many hops are named, so the sentence stays snippet length. */
const MAX_HOPS = 3

/** "a" or "an" for the word as spoken: "an 8%", "an 11%", "an IPA", "a 6.5%". */
function article(word: string): 'a' | 'an' {
  const wholeNumber = word.match(/^\d+/)?.[0]
  if (wholeNumber) {
    // "eight…", "eleven" and "eighteen" are the ABVs that start with a vowel sound.
    return wholeNumber.startsWith('8') || wholeNumber === '11' || wholeNumber === '18' ? 'an' : 'a'
  }
  // A vowel, or an initialism whose first letter is spoken with one ("an NEIPA").
  return /^[aeiou]/i.test(word) || /^[FHLMNRSX][A-Z]/.test(word) ? 'an' : 'a'
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}

/** A hop name runs to three words at most ("East Kent Goldings"); more is a phrase. */
const MAX_HOP_WORDS = 3

/**
 * Hop names from the admin's free text, or none when it isn't a plain list
 * ("Dry hopped with Citra"), so the sentence never repeats or garbles it.
 */
function hopNames(hops: string): string[] {
  const names = hops
    .split(',')
    // "Citra, Mosaic, and Nelson": the sentence adds its own "and".
    .map((hop) => hop.trim().replace(/^(and\b|&)\s*/i, ''))
    .filter(Boolean)
  return names.every((hop) => hop.split(/\s+/).length <= MAX_HOP_WORDS) ? names : []
}

export function fallbackBeerDescription({ name, abv, style, hops }: BeerDescriptionFacts): string {
  const trimmedStyle = style?.trim()
  const styleName = trimmedStyle && trimmedStyle !== 'Beer' ? trimmedStyle : 'beer'
  // ABV to one decimal, without a trailing ".0".
  const descriptor = abv && abv > 0 ? `${Number(abv.toFixed(1))}% ${styleName}` : styleName

  const hopList = hopNames(hops ?? '')
  const namedHops = hopList.length > MAX_HOPS ? [...hopList.slice(0, MAX_HOPS), 'more'] : hopList
  const hopClause = namedHops.length ? `, hopped with ${joinList(namedHops)}` : ''

  return `${name} is ${article(descriptor)} ${descriptor} brewed by Lolev Beer in Pittsburgh${hopClause}.`
}
