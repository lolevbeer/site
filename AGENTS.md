<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Access control

Payload access rules (collection, global, and field `access`) are the single source of truth for who may read or write what. Every Payload Local API call states the identity it runs as:

- **Acting for a person** (anonymous visitor, admin editor, Slack user): `overrideAccess: false` plus their `user` or the hook's `req`. Public pages pass no user — anonymous is the correct identity. Inside hooks, always pass `req` so the call runs as the editor and inside the save transaction.
- **User-less system code** (migrations, `scripts/`, the Untappd job and cron, public form intake, rate limiting, Slack notify, and derived-data helpers such as review sync, unique slug/recipe checks, and page revalidation): `overrideAccess: true`. It is allowed only in the files listed as `SYSTEM_OVERRIDE_FILES` in `eslint.config.mjs`, or behind `// eslint-disable-next-line no-restricted-syntax -- system: <reason>` on the `overrideAccess` line.

Never omit `overrideAccess`: Payload 3 defaults an omitted (or `undefined`) flag to `true`, Payload 4 flips it to `false`. ESLint rejects both an omitted flag and an unfenced `true`.

When following access hides something a role legitimately needs, widen that role's access rule rather than bypassing it. A denied relationship populates as a bare ID and our consumers drop non-objects, so access gaps show up as missing content, not errors — check the rendered page.

Current rules worth knowing: beer managers, bartenders, and lead bartenders read every beer; everyone else reads published beers only (drafts never show on the public site, even on a published menu or Coming Soon); beer version history is beer-manager only. Beers and menus stamp each save's editor in `updatedBy` (signed-in readers only), so every revision records who made it. See `docs/plans/follow-access-control.md` for the migration.
