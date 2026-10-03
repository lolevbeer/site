/**
 * Looks up display names (name, else email) for the user IDs stamped in
 * Beers/Menus `updatedBy`, as the viewer: every signed-in user may read other
 * users' names and emails. Shared by the versions list and the menu stock widget.
 */
import type { PayloadRequest } from 'payload'

export async function editorNames(
  req: PayloadRequest,
  ids: Iterable<string | null | undefined>,
): Promise<Map<string, string>> {
  const unique = [...new Set(ids)].filter((id): id is string => Boolean(id))
  if (unique.length === 0) return new Map()
  const users = await req.payload.find({
    collection: 'users',
    where: { id: { in: unique } },
    select: { name: true, email: true },
    depth: 0,
    pagination: false,
    overrideAccess: false,
    req,
  })
  return new Map(users.docs.map((user) => [user.id, user.name || user.email]))
}
