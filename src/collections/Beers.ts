import type { CollectionConfig } from 'payload'
import { generateUniqueSlug } from './utils/generateUniqueSlug'
import { adminAccess, beerManagerAccess, isAdmin } from '@/src/access/roles'

// Helper function to round to nearest 0.25 (like Excel's MROUND)
const mround = (value: number, multiple: number): number => {
  return Math.round(value / multiple) * multiple
}

interface UntappdReview {
  username: string
  rating: number
  text: string
  date?: string
  url?: string
  image?: string
}

// Fetch Untappd rating, rating count, and positive reviews from beer page
async function fetchUntappdData(url: string): Promise<{ rating: number | null; ratingCount: number | null; positiveReviews: UntappdReview[] }> {
  try {
    const fullUrl = url.startsWith('http') ? url : `https://untappd.com${url}`
    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    })
    if (!response.ok) return { rating: null, ratingCount: null, positiveReviews: [] }
    const html = await response.text()

    // Extract rating
    let rating: number | null = null
    const ratingMatch = html.match(/<div[^>]*class="caps"[^>]*data-rating="([^"]+)"/)
    if (ratingMatch?.[1]) {
      const parsed = parseFloat(ratingMatch[1])
      if (!isNaN(parsed)) rating = parsed
    }

    // Extract rating count (e.g., "3,381 Ratings")
    let ratingCount: number | null = null
    const countMatch = html.match(/([\d,]+)\s*Ratings/i)
    if (countMatch?.[1]) {
      const parsed = parseInt(countMatch[1].replace(/,/g, ''), 10)
      if (!isNaN(parsed)) ratingCount = parsed
    }

    // Extract positive reviews (4.5+ with text)
    const positiveReviews: UntappdReview[] = []
    // Match each checkin item block: <div class="item " id="checkin_123456" ...>...</div>
    const checkinRegex = /<div[^>]*class="item\s*"[^>]*id="checkin_(\d+)"[^>]*>([\s\S]*?)(?=<div[^>]*class="item\s*"[^>]*id="checkin_|$)/gi
    let checkinMatch

    while ((checkinMatch = checkinRegex.exec(html)) !== null) {
      const checkinId = checkinMatch[1]
      const checkinHtml = checkinMatch[2]

      // Extract rating from caps div: <div class="caps " data-rating="4.5">
      const checkinRatingMatch = checkinHtml.match(/<div[^>]*class="caps[^"]*"[^>]*data-rating="([\d.]+)"/)
      if (!checkinRatingMatch) continue

      const checkinRating = parseFloat(checkinRatingMatch[1])
      if (isNaN(checkinRating) || checkinRating < 4.5) continue

      // Extract comment text: <p class="comment-text" id="translate_...">text</p>
      const commentMatch = checkinHtml.match(/<p[^>]*class="comment-text"[^>]*>([\s\S]*?)<\/p>/i)
      if (!commentMatch || !commentMatch[1].trim()) continue

      const text = commentMatch[1].trim()

      // Extract username: <a href="/user/..." class="user">Name</a>
      const usernameMatch = checkinHtml.match(/<a[^>]*class="user"[^>]*>([^<]+)<\/a>/i)
      const username = usernameMatch ? usernameMatch[1].trim() : 'Anonymous'

      // Build checkin URL from the ID and username
      const userMatch = checkinHtml.match(/href="(\/user\/[^"]+)"[^>]*class="user"/)
      const url = userMatch
        ? `https://untappd.com${userMatch[1]}/checkin/${checkinId}`
        : `https://untappd.com/user/checkin/${checkinId}`

      // Extract date: <a class="time...">date</a>
      const dateMatch = checkinHtml.match(/<a[^>]*class="time[^"]*"[^>]*>([^<]+)<\/a>/i)
      const date = dateMatch ? dateMatch[1].trim() : undefined

      // Extract image: <p class="photo">...<img src="...">...</p>
      const imageMatch = checkinHtml.match(/<p[^>]*class="photo"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/)
      const image = imageMatch ? imageMatch[1] : undefined

      positiveReviews.push({ username, rating: checkinRating, text, date, url, image })
    }

    return { rating, ratingCount, positiveReviews }
  } catch {
    return { rating: null, ratingCount: null, positiveReviews: [] }
  }
}

export const Beers: CollectionConfig = {
  slug: 'beers',
  access: {
    read: () => true,
    create: beerManagerAccess,
    update: beerManagerAccess,
    delete: adminAccess, // Beer Managers can only archive, not delete
  },
  admin: {
    group: 'Back of House',
    useAsTitle: 'name',
    hideAPIURL: true,
    listSearchableFields: ['name', 'slug'],
    defaultColumns: ['name', 'slug', 'style', 'abv', 'hideFromSite'],
    pagination: {
      defaultLimit: 100,
    },
    preview: (doc) => {
      if (doc?.slug) {
        return `/beer/${doc.slug}`
      }
      return ''
    },
  },
  versions: {
    drafts: true,
  },
  hooks: {
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        // Compute canSingle from fourPack: MROUND((fourPack/4) + 0.25, 0.25)
        if (data.fourPack && typeof data.fourPack === 'number') {
          data.canSingle = mround((data.fourPack / 4) + 0.25, 0.25)
        }

        // Compute halfPour from draftPrice: round(draftPrice / 2) + 1
        // Skip auto-calculation if halfPourOnly is enabled (manual override)
        if (data.draftPrice && typeof data.draftPrice === 'number' && !data.halfPourOnly) {
          data.halfPour = Math.round(data.draftPrice / 2) + 1
        }

        // Auto-generate slug from name if not provided or empty
        if ((!data.slug || data.slug.trim() === '') && data.name && typeof data.name === 'string') {
          // For updates, use originalDoc.id; for creates, use data.id if available
          const docId = originalDoc?.id || data.id
          data.slug = await generateUniqueSlug(
            data.name,
            'beers',
            req,
            operation,
            docId,
          )
        }

        // Auto-increment recipe number for new beers
        if (operation === 'create' && !data.recipe) {
          const lastBeer = await req.payload.find({
            collection: 'beers',
            sort: '-recipe',
            limit: 1,
          })

          if (lastBeer.docs.length > 0 && lastBeer.docs[0].recipe) {
            data.recipe = lastBeer.docs[0].recipe + 1
          } else {
            data.recipe = 1
          }
        }

        // Auto-fetch Untappd rating when URL is set/changed
        if (data.untappd && data.untappd !== originalDoc?.untappd) {
          const { rating, ratingCount, positiveReviews } = await fetchUntappdData(data.untappd)
          if (rating !== null) {
            data.untappdRating = rating
          }
          if (ratingCount !== null) {
            data.untappdRatingCount = ratingCount
          }
          if (positiveReviews.length > 0) {
            // Merge with existing reviews, using URL as unique key
            const existingReviews = (originalDoc?.positiveReviews as UntappdReview[]) || []
            const existingUrls = new Set(existingReviews.map(r => r.url).filter(Boolean))
            const newReviews = positiveReviews.filter(r => r.url && !existingUrls.has(r.url))
            data.positiveReviews = [...existingReviews, ...newReviews]
          }
        }

        return data
      },
    ],
  },
  fields: [
    {
      name: 'glass',
      type: 'select',
      required: true,
      options: [
        { label: 'Pint', value: 'pint' },
        { label: 'Stein', value: 'stein' },
        { label: 'Teku', value: 'teku' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'abv',
      label: 'ABV',
      type: 'number',
      required: true,
      min: 0,
      max: 20,
      admin: {
        step: 0.1,
        description: 'Alcohol by volume percentage',
        position: 'sidebar',
      },
    },
    {
      name: 'draftPrice',
      type: 'number',
      required: true,
      admin: {
        description: 'Draft price in dollars (e.g., 7)',
        position: 'sidebar',
        step: 0.25,
      },
    },
    {
      name: 'halfPourOnly',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Enable to manually set half pour price (disables auto-calculation)',
        position: 'sidebar',
      },
    },
    {
      name: 'halfPour',
      type: 'number',
      admin: {
        description: 'Auto-calculated unless "Half Pour Only" is enabled',
        position: 'sidebar',
        step: 0.25,
      },
    },
    {
      name: 'fourPack',
      type: 'number',
      admin: {
        description: 'Four pack price (e.g., 15)',
        position: 'sidebar',
        step: 0.25,
      },
    },
    {
      name: 'canSingle',
      type: 'number',
      admin: {
        description: 'Auto-calculated from four pack price',
        position: 'sidebar',
        readOnly: true,
        step: 0.01,
      },
    },
    {
      name: 'upc',
      label: 'UPC',
      type: 'text',
      admin: {
        description: 'UPC barcode',
        position: 'sidebar',
      },
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      required: true,
      admin: {
        description: 'Auto-generated from name, but you can override it manually',
        position: 'sidebar',
      },
    },
    {
      name: 'recipe',
      type: 'number',
      admin: {
        description: 'Auto-incremented recipe number',
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'hideFromSite',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'justReleased',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Mark as "Just Released". If no beers have this set, beers created within 2 weeks are auto-marked.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          admin: {
            width: '25%',
          },
        },
        {
          name: 'style',
          type: 'relationship',
          relationTo: 'styles',
          required: true,
          index: true,
          admin: {
            description: 'Beer style',
            width: '25%',
          },
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description: 'Beer image (recommended: 2500x2500px)',
            width: '50%',
          },
        },
      ],
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'hops',
      type: 'text',
      admin: {
        description: 'Hop varieties used',
      },
    },
    {
      name: 'untappdFetcher',
      type: 'ui',
      admin: {
        components: {
          Field: '@/src/components/admin/UntappdFetcher#UntappdFetcher',
        },
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'untappd',
          type: 'text',
          admin: {
            description: 'Untappd URL (e.g., /b/lolev-beer-lupula/123456)',
            width: '50%',
          },
        },
        {
          name: 'untappdRating',
          type: 'number',
          admin: {
            description: 'Rating (auto-fetched)',
            readOnly: true,
            step: 0.01,
            width: '25%',
          },
        },
        {
          name: 'untappdRatingCount',
          type: 'number',
          admin: {
            description: 'Rating count (auto-fetched)',
            readOnly: true,
            width: '25%',
          },
        },
      ],
    },
    {
      name: 'positiveReviews',
      type: 'json',
      admin: {
        description: 'Positive reviews (4.5+ with text) from Untappd - auto-fetched',
        readOnly: true,
      },
    },
  ],
}
