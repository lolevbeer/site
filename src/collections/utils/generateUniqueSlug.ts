import type { CollectionSlug, PayloadRequest } from 'payload'

/**
 * Transliterate diacritics to ASCII equivalents
 * e.g., ō → o, ü → u, é → e, ñ → n
 */
export function transliterate(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Generate a URL-safe slug from a string
 * Transliterates diacritics, lowercases, and replaces non-alphanumeric with dashes
 */
export function slugify(str: string): string {
  return transliterate(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Generates a unique slug from a name by:
 * 1. Transliterating diacritics to ASCII (ō → o, etc.)
 * 2. Converting to lowercase
 * 3. Replacing non-alphanumeric characters with dashes
 * 4. Removing leading/trailing dashes
 * 5. Appending an incrementing number if the slug already exists
 */
export async function generateUniqueSlug(
  name: string,
  collection: CollectionSlug,
  req: PayloadRequest,
  operation: 'create' | 'update',
  currentDocId?: string | number,
): Promise<string> {
  // Generate base slug from name
  const baseSlug = slugify(name)

  // Check for uniqueness and append number if needed
  let slug = baseSlug
  let counter = 1
  let isUnique = false

  while (!isUnique) {
    // Check if slug exists (excluding current document and its revisions)
    const where: any = {
      slug: { equals: slug },
    }

    // Always exclude current document ID if provided (for both create and update)
    if (currentDocId) {
      where.id = { not_equals: currentDocId }
    }

    // Check both published and draft versions
    const [published, drafts] = await Promise.all([
      req.payload.find({
        collection,
        where,
        limit: 1,
        draft: false,
      }),
      req.payload.find({
        collection,
        where,
        limit: 1,
        draft: true,
      }),
    ])

    // Only consider it a conflict if another document has this slug
    if (published.docs.length === 0 && drafts.docs.length === 0) {
      isUnique = true
    } else {
      slug = `${baseSlug}-${counter}`
      counter++
    }
  }

  return slug
}
