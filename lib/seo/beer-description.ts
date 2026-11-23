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
  if (/^\d/.test(word)) {
    const whole = word.match(/^\d+/)![0]
    return whole.startsWith('8') || /^1[18]$/.test(whole) || /^1[18]\d{3}$/.test(whole)
      ? 'an'
      : 'a'
  }
  return /^[aeiou]/i.test(word) || /^[FHLMNRSX][A-Z]/.test(word) ? 'an' : 'a'
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function formatAbv(abv: number): string {
  return `${Number(abv.toFixed(1))}%`
}

export function fallbackBeerDescription({ name, abv, style, hops }: BeerDescriptionFacts): string {
  const styleName = style?.trim() && style.trim() !== 'Beer' ? style.trim() : ''
  const descriptor = [abv && abv > 0 ? formatAbv(abv) : '', styleName || 'beer']
    .filter(Boolean)
    .join(' ')
  const hopList = (hops ?? '')
    .split(',')
    .map((hop) => hop.trim())
    .filter(Boolean)
  const shownHops = hopList.slice(0, MAX_HOPS)
  const hopClause = shownHops.length
    ? `, hopped with ${joinList(
        hopList.length > MAX_HOPS ? [...shownHops, 'more'] : shownHops,
      )}`
    : ''
  return `${name} is ${article(descriptor)} ${descriptor} brewed by Lolev Beer in Pittsburgh${hopClause}.`
}
