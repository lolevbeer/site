# Distributor CSV import format

Use this to turn any raw distributor list (a sales report, an xlsx, a PDF, a
pasted email) into a CSV that the admin Sync page ("Distributor CSV (US or
international)") accepts. It works for any US state or DC, and for venues in
other countries.

The upload validates every cell you supply and keeps it exactly as written. The
one thing it fills in is a **blank** `city`, `state`, or `country`, from the map
lookup it already does to place the pin; it never changes a cell you filled. Your
job as the normalizer is to make every other judgment call here, before upload,
and to report what you did. Preview with **Dry run** (on by default) before the
real upload: the preview lists each row's resolved address and which cells were
filled in.

## Output

One CSV file, UTF-8, comma-separated, first line is the header. Fields that
contain a comma or a double quote must be wrapped in double quotes (`"` inside a
field is written `""`). A field cannot span lines.

Header names are case-insensitive and columns can be in any order. Unknown
columns are ignored.

| Column         | Required | Rule                                                                                            |
| -------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `name`         | yes      | The business name only. See "Names".                                                            |
| `address`      | yes      | Street line only: no city, state, zip, or phone. Keep suite/unit (`7110 Patterson Ave A`).      |
| `city`         | no       | City name, properly capitalized (`Ashburn`, not `ASHBURN`). Blank is filled from the lookup.    |
| `state`        | no       | US: two-letter USPS code, uppercase (`DC` is valid). Elsewhere: free text (`Noord-Holland`).    |
| `zip`          | no       | US: `12345` or `12345-6789`. Elsewhere: the postcode as written (`1012 RR`). Never guess one.   |
| `country`      | no       | Two-letter ISO code, uppercase (`NL`, `JP`, `GB`). Blank means US when `state` is a US code.    |
| `latitude`     | no       | Decimal degrees (`52.3719711`). Give with `longitude` or not at all. See below.                 |
| `longitude`    | no       | Decimal degrees (`4.8903227`). Give with `latitude` or not at all.                              |
| `phone`        | no       | US: ten digits (a leading `1` is fine), formatted `(804) 288-0816`. Elsewhere: kept as written. |
| `region`       | no       | US only: two-letter state code for grouping. Leave blank: it defaults to `state`.               |
| `customerType` | no       | Exactly `Retail`, `On Premise`, or `Home-D`. Only when the source says so; otherwise blank.     |
| `website`      | no       | Full URL starting with `http://` or `https://`. Otherwise blank.                                |
| `active`       | no       | `true` or `false`. Blank leaves an existing row unchanged and makes a new row active.           |

Optional `latitude` and `longitude` columns (decimal degrees, e.g. `52.3719711`,
`4.8903227`) give the map pin directly. Give both or neither. A row with them is not
geocoded: the pin is used as-is and the upload only looks up any blank city, state, or
country from it. A row without them is located from its address; a row that cannot be
located is reported and not created.

A two-letter `state` with a blank `country` must be a US code: `QC` or `DE` alone is
ambiguous, so fill `country` for a non-US venue.

## Example

```csv
name,address,city,state,zip,phone,country,latitude,longitude
Corks & Kegs,7110 Patterson Ave A,Richmond,VA,23229,(804) 288-0816,,,
Crafted Haymarket,20693 Ashburn Rd #125,Ashburn,VA,,(703) 272-4200,,,
"Smith, Jones & Co",90 Featherbed Ln,Winchester,VA,22601,,,,
BeerTemple,250 Nieuwezijds Voorburgwal,Amsterdam,Noord-Holland,1012 RR,,NL,52.3719711,4.8903227
Craft Metropolis,47 High Street,Penge,,,,GB,,
```

## Normalization rules

### Names

- Remove license and permit identifiers from the end of the name: `Corks & Kegs
ABC #48896` becomes `Corks & Kegs`. This covers `ABC #`, `ABC#`, `ABC License`,
  `Lic.`, and similar. Do not remove anything that is part of the business name.
- Collapse repeated spaces and trim the ends.
- Keep punctuation and capitalization the source uses otherwise (`Lucky's
Woodlake`, `Kettles & Grains`).

### Addresses

- Split a combined line into `address`, `city`, `state`, `zip`, and `phone`.
  Typical inputs: `1608 Pleasure House Rd, Virginia Beach, VA 23455`,
  `11355 Nuckols Rd, Glen Allen, VA 23059 (804) 447-3065` (phone on the same
  line), `3471 Washington Blvd. Arlington, VA 22201` (no comma before the city),
  `20693 ASHBURN RD # 125 — ASHBURN, VA` (em dash separator, no zip).
- Do not invent missing parts. A missing zip stays blank. Leave a missing city,
  state, or country blank rather than guessing; the upload fills those from the
  map lookup and the preview shows what it chose. A row with **no street
  address** cannot be imported: leave it out of the CSV and list it in your
  report (see below).
- Apply `address` capitalization the way the source writes it; only fix
  ALL-CAPS text by converting to normal capitalization.

### Rows to leave out

Drop, and list in your report: totals and subtotals, header or label rows,
customers with no street address, and anything that is not a customer.

### Duplicates

A name may appear once per US state, or once per country outside the US. If the source lists the same customer
several times (for example one block per invoice), emit one row. If two
different locations share a name, make the names distinguishable using the
source's own wording (a city or store number), and say so in your report.

### Judgment calls you must not make

- Do not infer `customerType` from the name or from what they buy.
- Do not infer `active=false` from low sales; only use it when the source says
  the account is closed.
- Do not look up or fill in websites, phone numbers, or zip codes the source
  does not contain.

## Report back

Along with the CSV, give a short report:

1. Row count in the source versus rows in the CSV.
2. Every row left out, with the reason.
3. Every name or address you changed beyond whitespace, as `before -> after`.
4. Anything you were unsure about.

## What the upload does

- A row missing `city`, `state`, or `country` is looked up (Mapbox, then
  OpenStreetMap, then Geocodio for US rows). Only the blank cells are filled; the
  preview marks them `inferred: …`, and marks a low-confidence match `check this`.
- US rows are grouped by `region` (default: their `state`); other rows by `country`.
- Rows are matched to existing distributors by exact `name` within that group.
  A match is updated (only fields that differ, and `customerType`, `website`,
  and `active` only when the cell is not blank); no match creates a new
  distributor. Uploading the same file twice changes nothing the second time.
- A name that matches more than one existing distributor in the group is
  skipped and reported.
- Rows with problems are reported with their line number; valid rows in the
  same file are still imported. A file with no valid rows, or a missing
  required column, imports nothing.
