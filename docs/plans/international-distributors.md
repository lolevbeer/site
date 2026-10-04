# Plan: International distributors, with geocoder-assisted cleansing

Branch `feat/international-distributors`, worktree `.claude/worktrees/intl-distributors`,
based on `main` @ `7683ce42` (2026-10-04). Line anchors and file facts are from that
commit — re-resolve before editing.

## Goal

Let the distributor CSV import (and the map it feeds) accept venues outside the US
without hand-fixing the file first. A row may leave `city`, `state`, or `country`
blank; the import fills those blanks from the geocoder's answer, never overwrites a
cell the CSV supplied, and shows the resolved address so a human can catch a wrong
match **before** anything is written (dry run).

Driving file: `lolev-venues-validated-international-v2.csv` (53 rows). Today the real
parser accepts 0 of 53: 52 fail the two-letter US `state` rule (10 have no state at
all) and 1 has no `city`.

## Facts that shape the plan

1. **The map needs no change.** `components/ui/distributor-map.tsx` plots `[lng, lat]`
   from `location`; no state filter, no US bounds. Only the *data path* is US-only.
2. **US-only spots**, all of which must change: the parser (`lib/distributors/parse-distributors-csv.ts`:
   `state` required + US code, `zip` must be 5 digits then `.slice(0, 5)`, `region`
   defaults to `state`); `src/endpoints/geocode.ts` (`countrycodes=us`, Geocodio
   `country: 'USA'`, `, USA` suffix in the zip/city fallbacks); the place search
   (`lib/hooks/use-location-search.ts`: `country=US`); address text
   (`formatFullAddress` in `lib/distributors/import-patch.ts`, `formatAddress` in
   `lib/utils/formatters.ts` — no country, so "Springfield" is ambiguous in geocoding,
   popups, and Google Directions links).
3. **`region` is US-state-only and must stay that way.** Reusing it for countries
   collides on codes (`DE` Delaware/Germany, `CA` California/Canada, `IN`, `GA`, `AL`…).
   It is not `required` on the collection, so non-US rows leave it blank and are grouped
   by `country` instead (see Task 8's group key).
4. **No data migration.** The database is MongoDB (`mongooseAdapter`), so a new optional
   field needs no schema change. Existing rows have no `country`; **blank means US**
   everywhere in code. The distributors cache tag already revalidates `/beer-map`.
5. **Geocoding order matters for matching.** The endpoint indexes existing rows by
   region *before* looping (`import-distributors-csv.ts:60-72`). A row whose country is
   inferred has no group until it is geocoded, so enrichment must run as its own phase
   *before* matching, and its coordinates must be reused for create (no second lookup).
6. **Providers differ.** Nominatim returns structured parts (`addressdetails=1`) and
   supports any country; Geocodio is US/Canada only; Bing is unrestricted and returns
   `address.countryRegionIso2/locality/adminDistrict/postalCode`. Nominatim is
   rate-limited to 1 req/s and already paced in one place (`waitForNominatimSlot`).
7. **`DE`/`CA`-style ambiguity in the CSV itself:** with `country` blank, a two-letter
   `state` must be a valid uppercase US code (keeps the existing "lowercase `va` is the
   normalizer's job" rule and its test); any longer value is free text for a non-US row.

## Preflight (done 2026-10-04)

- Worktrees: none other touches distributors. `.agents/worktrees/geocode-fallback`
  (`feat/geocode-fallback-on-import`) is stale: its work merged as #262/#263.
- Open PRs: #269 (next bump), #268 (jobs richtext), #260 (visit planning), #216
  (Untappd removal). None touch `lib/distributors`, `src/endpoints/*distributors*`,
  `geocode.ts`, or `Distributors.ts`.

## Decisions (approved 2026-10-04)

1. **Fill blanks, never overwrite.** Supplied cells always win. Filled cells are
   listed per row in the report as `inferred: country, city`.
2. **Dry run is the guard.** A `dryRun` flag geocodes and reports but writes nothing.
   The Sync page checkbox **defaults on**, matching the other Sync tools
   (`recalcDryRun`, `untappdDryRun`). This changes the existing US CSV flow: the first
   upload previews, a second (unchecked) upload writes.
3. **A supplied `country` restricts the search** (`countrycodes=xx`); a provider answer
   in a different country is discarded. Blank country searches globally, then fills it.
4. **`region` stays US-only/blank for non-US.** Non-US rows group by `country`.
5. **Filled `city`/`state` are in English** (`accept-language=en` on Nominatim,
   `culture=en` on Bing), even though the CSV's own cells are local-script. Cells the
   CSV supplies are stored as written, so one file can mix scripts.
6. **Place search drops `country=US`** so visitors can search abroad; Mapbox
   `proximity` still biases toward the visitor.

## Tasks

Each task starts with its failing test (TDD). Validation for every task:
`pnpm type-check` and the named test file; final task runs the full suite.

### 1. Country helpers
- Create `lib/distributors/country.ts` (module comment: ISO-3166-1 alpha-2 helpers):
  `isCountryCode(v): boolean`, `countryName(code): string`, `groupKey(d): string`.
  Uses `Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })` — no 249-entry
  table. `groupKey` = `US:${region}` when country is `US`/blank, else the country code.
- Test first: `tests/int/distributor-country.int.spec.ts` — `NL`/`JP`/`GB` valid;
  `ZZ`, `nl`, `USA`, `` invalid; `countryName('NL') === 'Netherlands'`; `groupKey`
  keeps Delaware (`US:DE`) and Germany (`DE`) apart.
- Acceptance: test green, `tsc` clean. Depends on: none.

### 2. `country` field on Distributors
- Edit `src/collections/Distributors.ts`: add optional text field `country` (ISO-2,
  validated with `isCountryCode`, blank allowed; description says blank = US). Update
  the `state`/`zip`/`region` descriptions (state free text outside the US; region is
  US-only). Regenerate `src/payload-types.ts` with `pnpm generate:types`.
- Test first: extend the `Distributors collection` describe in
  `tests/int/distributor-csv-import.int.spec.ts` — rejects `country: 'Netherlands'`
  on every write path, accepts `NL`, accepts blank; a non-US row saves with no region.
- Acceptance: test green, `tsc` clean, `Distributor` type has `country?: string | null`.
  Depends on: 1. No migration (see Fact 4).

### 3. Address text carries the country
- Edit `formatFullAddress` (`lib/distributors/import-patch.ts:83`) and `formatAddress`
  (`lib/utils/formatters.ts:273`): optional `country`; append `countryName(country)`
  when it is set and not `US`. US output stays byte-identical.
- Test first: `tests/int/distributor-address-format.int.spec.ts` — US unchanged
  (`123 Main St, Pittsburgh, PA 15201`); `NL` appends `, Netherlands`; missing parts
  are still omitted.
- Acceptance: test green; `getAllDistributorsGeoJSON` passes `country` through so
  popups and Directions links include it. Depends on: 1.

### 4. CSV parser: country-aware validation
- Edit `lib/distributors/parse-distributors-csv.ts`. `REQUIRED` becomes `name`,
  `address`. `DistributorCsvRow` gains `country?: string`; `city`, `state` become
  optional strings; `region` becomes `StateCode | undefined`. Rules:
  `country` blank or valid ISO-2 (uppercase); US rows (explicit `US`, or blank country
  with a valid US `state`) keep today's rules exactly (US `state`, 5-digit/ZIP+4 zip,
  `slice(0,5)`, `formatPhone`, `region` defaults to `state`); blank country with a
  two-letter `state` that is not a US code → error ("add a country column"); any other
  row takes `state`/`zip`/`phone` as free text (no truncation, no US phone format) and
  gets no region. Duplicate check: `groupKey|name` when the group is known, otherwise
  `name|address`.
- Test first: extend `parseDistributorsCsv` describe in
  `tests/int/distributor-csv-import.int.spec.ts`. Update `city is required` and
  `not a two-letter US state` expectations; add: the 53-row file shape (blank
  state/city accepted), `NL` + `Noord-Holland` accepted, `NL` + `1011 AB` zip kept
  whole, blank-country `va` still rejected, `QC` with no country rejected, same name in
  `US:DE` vs `DE` not a duplicate.
- Acceptance: test green; every previously-valid US file parses to an identical row.
  Depends on: 1.

### 5. Pure blank-filling
- Create `lib/distributors/fill-blank-parts.ts`: `type ResolvedParts = { country?,
  city?, state?, zip? }` and `fillBlankParts(row, resolved) → { filled: Partial<…>,
  inferred: string[] }`. Fills only cells that are blank/undefined. When the resolved
  country is `US`, maps the resolved state name to its code via `US_STATES` labels and
  sets `region` to it.
- Test first: `tests/int/distributor-fill-blanks.int.spec.ts` — supplied cells never
  change; blank city/state/country fill; US full name `Pennsylvania` → `PA` + region;
  non-US leaves region unset; `inferred` lists exactly the cells filled.
- Acceptance: test green. Depends on: 1.

### 6. Geocoder: resolve parts, any country (Mapbox first)
- Decided 2026-10-04 after live tests on five rows of the real file (Amsterdam 0.97,
  Penge resolved to London GB 1.00 with no country given, Tokyo in Japanese script 0.80,
  Busan with no city 0.35, Bilbao 0.65). Geocodio covers only the US and Canada and
  Bing has no key, so neither helps abroad.
- Provider order in `src/endpoints/geocode.ts`: **Mapbox v6 forward with
  `permanent=true`** (results we store) → Nominatim → Geocodio (US rows only). Bing
  stays as-is, dormant without a key.
- Token: server-only `MAPBOX_GEOCODING_TOKEN` (secret, no URL restriction). The public
  `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is URL-restricted (403 without the site Referer) and
  must not be used server-side. Missing token: skip Mapbox, fall back to Nominatim.
- Add `resolveDistributor(parts & { country? }) → { coords, parts: ResolvedParts,
  uncertain, source } | null`:
  - Mapbox: `language=en`, `country=<code>` when the row's country is known, parts from
    `context` (`place` → city, `region` → state, `postcode` → zip, `country.country_code`
    → country, uppercased).
  - Nominatim: `addressdetails=1&accept-language=en`; `countrycodes` only when known.
  - Any answer whose country contradicts a *supplied* country is discarded.
  - Zip/city fallbacks drop the hard-coded `, USA` and 5-digit assumption.
  - Keep `geocodeDistributor(parts)` as a coords-only wrapper for existing callers.
- v6 has no relevance score: a match is `uncertain` when `match_code.confidence` is
  `low` or missing, or the feature is coarser than an address (e.g. Busan matched only
  the street). Task 8 reports uncertain rows as `check this`.
- Test first: extend `tests/int/geocode.int.spec.ts` (fetch mocks) — Mapbox called
  first with `permanent=true`, `language=en`, and `country=nl` for an `NL` row; no
  `country` param for a blank-country row; parts parsed from `context`; skipped when the
  token is unset; Nominatim fallback has no `countrycodes=us` for `NL`; Geocodio not
  called for `NL`; contradicting country discarded; existing tests still pass.
- Acceptance: test green. Depends on: 3, 5. Needs `MAPBOX_GEOCODING_TOKEN` in Vercel
  (Preview, Production) and `.env.local` before Task 12.

### 7. Import patch + upsert carry `country`
- Edit `lib/distributors/import-patch.ts` (`country` joins `PATCH_STRINGS`,
  `DistributorImportFields`, `DistributorImportPatch`, `addressFieldsChanged`;
  `region` becomes optional) and `lib/distributors/upsert-existing.ts` (pass `country`
  into `geocode`; its `geocode` param type gains `country?`).
- Test first: extend the existing patch tests (locate with
  `grep -rl distributorImportPatch tests/`; if none, add
  `tests/int/distributor-import-patch.int.spec.ts`) — a changed `country` yields a patch
  and triggers re-geocoding; blank incoming `country` never clears a stored one.
- Acceptance: test green. Depends on: 1.

### 8. Endpoint: enrich, group, dry-run, report
- Edit `src/endpoints/import-distributors-csv.ts`:
  1. **Enrich phase** before matching: for each row with a blank `country`, `city`, or
     `state` (US rows with all three present skip it), call `resolveDistributor`, apply
     `fillBlankParts`, keep the coords on the row. A row that cannot be located is
     reported and dropped, as today.
  2. **Re-check duplicates** on `groupKey|name` now that groups are final.
  3. **Match existing rows** by group: US rows query `region in […]`, non-US rows query
     `country in […]`; index by `groupKey` instead of `region`.
  4. Create reuses the enrichment coords (no second geocode); update passes them to
     `applyExistingDistributorPatch` when address fields changed.
  5. `dryRun` form field: do 1–3, then report `Would import:` / `Would update:` /
     `Would skip:` and write nothing.
  6. Every success/would-line carries the resolved address and `inferred: …`, e.g.
     `Imported: Craft Metropolis — 47 High Street, Penge, London, United Kingdom (inferred: country, city)`.
- Test first: extend the `importDistributorsCsv endpoint` describe in
  `tests/int/distributor-csv-import.int.spec.ts`, stubbing geocoding the same way the
  existing endpoint tests do — creates an `NL` row with `country` stored and no region;
  fills a blank city/country from the resolved parts and lists them as inferred; never
  overwrites a supplied city; `dryRun` writes nothing and reports resolved addresses;
  re-import of an unchanged non-US row is skipped, not duplicated; a US row's behavior
  is unchanged; an unlocatable row is still reported and not created.
- Acceptance: test green; existing endpoint tests pass unmodified except for the
  `dryRun` default being opt-in at the API (the UI default lives in Task 9). Depends on:
  4, 6, 7.

### 9. Sync page: dry-run checkbox and label
- Edit `src/components/SyncViewClient.tsx`: `csvDryRun` state (default `true`, same
  pattern as `recalcDryRun`), checkbox beside Upload CSV, `formData.append('dryRun', …)`
  (`:229-231`); heading `Distributor CSV (any state)` → `Distributor CSV (US or
  international)`; results pills read `would import / would update` while dry.
- Test first: UI rendering is exempt from TDD — verify visually in the admin after the
  change (dry-run checked by default; a dry upload of the real CSV shows resolved
  addresses and writes nothing; unchecked upload writes).
- Acceptance: `tsc` clean; visual check recorded in the PR description. Depends on: 8.

### 10. Place search is no longer US-only
- Edit `lib/hooks/use-location-search.ts:38`: drop `country=US` (keep `proximity`).
- Test first: extend `tests/int/use-location-search.int.spec.ts` — the request URL has
  no `country=` param and still carries `proximity` when coordinates are known.
- Acceptance: test green. Depends on: none (parallel with everything).

### 11. Documentation
- Update `public/distributor-csv-import.md`: add the `country` column (ISO-2,
  optional, blank = US/inferred), `state` free text outside the US, `zip`/`phone`
  free text outside the US, `region` blank for non-US; rewrite "The upload does no
  guessing" to "fills blank `city`/`state`/`country` from the geocoder and never
  overwrites a cell you supplied; preview with Dry run first"; add an international
  example row.
- Update module/header comments: `parse-distributors-csv.ts`, `import-distributors-csv.ts`
  (it says "Works for any US state or DC"), `geocode.ts`, `fields.ts` (`region` is
  US-only), `Distributors.ts`; README's CSV-import paragraph; `formatAddress` JSDoc
  ("Format a US address").
- Acceptance: no stale "US only / any state / no guessing" text remains
  (`grep -rniE "any state|us state|no guessing|a US address" lib src public README.md`).
  Depends on: 8, 9.

### 12. Final validation and real-file acceptance
- Run `pnpm type-check`, `pnpm test`, `pnpm lint`.
- Acceptance run against local dev (needs the sandbox off, per project notes): Dry
  run `lolev-venues-validated-international-v2.csv`; confirm 53/53 parse, review every
  `inferred:` line for a wrong country/city, then run unchecked and confirm pins appear
  on `/beer-map`. Record the report in the PR description.
- Depends on: 1–11.

## Parallelism

- Sequential spine: 1 → (4, 5, 7) → 6 → 8 → 9 → 11 → 12.
- Parallel after 1: Tasks 2, 3, 4, 5, 7. Task 10 is independent from the start.
- Task 6 waits on 3 and 5; Task 8 waits on 4, 6, 7.

## Risks and ceilings

- **Silent wrong match.** A blank country on an ambiguous address ("47 High Street,
  Penge") can resolve to the wrong place and the pin still looks plausible. Guards:
  dry run default-on, resolved address + `inferred:` in every report line, a supplied
  country restricts the search. Not built: ambiguity detection across multiple
  candidates (false rejections likely); add only if dry runs show real misses.
- **Throughput.** Mapbox answers first; Nominatim (1 req/s) is only a fallback. A row can take up to three provider calls;
  the endpoint has no `maxDuration` (platform default 300 s), so roughly 100 non-US rows
  per upload. A dry run and the real run each geocode (nothing is cached between them).
  Split larger files. Nominatim's usage policy is for light use, fine at this scale.
- **Mixed scripts.** Filled `city`/`state` are English while supplied cells stay as
  written (Decision 5), so a stored row can read `東京都` for state beside an English
  city. Addresses and map pins are unaffected; only the displayed text mixes.
- **Out of scope:** map default center/zoom (stays Pittsburgh), FAQ/JSON-LD copy that
  says "Pittsburgh, PA, NY, OH" (`lib/utils/faq-schema.ts:112`; it describes the
  taprooms, not the retailer list), Locations (taprooms), and the PA/OH Encompass
  importer (unchanged; it keeps passing a US `state`).
