# Distributor CSV import format

Use this to turn any raw distributor list (a sales report, an xlsx, a PDF, a
pasted email) into a CSV that the admin Sync page ("Distributor CSV (any
state)") accepts. It works for any US state or DC.

The upload does no guessing. It either accepts a row exactly as written or
rejects it with its line number. Your job as the normalizer is to make every
judgment call here, before upload, and to report what you did.

## Output

One CSV file, UTF-8, comma-separated, first line is the header. Fields that
contain a comma or a double quote must be wrapped in double quotes (`"` inside a
field is written `""`). A field cannot span lines.

Header names are case-insensitive and columns can be in any order. Unknown
columns are ignored.

| Column         | Required | Rule                                                                                         |
| -------------- | -------- | -------------------------------------------------------------------------------------------- |
| `name`         | yes      | The business name only. See "Names".                                                         |
| `address`      | yes      | Street line only: no city, state, zip, or phone. Keep suite/unit (`7110 Patterson Ave A`).   |
| `city`         | yes      | City name, properly capitalized (`Ashburn`, not `ASHBURN`).                                  |
| `state`        | yes      | Two-letter USPS code, uppercase. `DC` is valid.                                              |
| `zip`          | no       | `12345` or `12345-6789`. Leave blank if the source has none; never look one up or guess.     |
| `phone`        | no       | Any layout with ten digits (a leading `1` is fine); the upload formats it `(804) 288-0816`.  |
| `region`       | no       | Two-letter code used for grouping and the distributor map. Leave blank: it defaults to `state`. |
| `customerType` | no       | Exactly `Retail`, `On Premise`, or `Home-D`. Only when the source says so; otherwise blank.  |
| `website`      | no       | Full URL starting with `http://` or `https://`. Otherwise blank.                             |
| `active`       | no       | `true` or `false`. Blank leaves an existing row unchanged and makes a new row active.        |

There is no latitude/longitude column. The upload looks up map coordinates from
the address. A row it cannot locate is reported and not created.

## Example

```csv
name,address,city,state,zip,phone
Corks & Kegs,7110 Patterson Ave A,Richmond,VA,23229,(804) 288-0816
Crafted Haymarket,20693 Ashburn Rd #125,Ashburn,VA,,(703) 272-4200
"Smith, Jones & Co",90 Featherbed Ln,Winchester,VA,22601,
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
- Do not invent missing parts. A missing zip stays blank. A row with **no street
  address** cannot be imported: leave it out of the CSV and list it in your
  report (see below).
- Apply `address` capitalization the way the source writes it; only fix
  ALL-CAPS text by converting to normal capitalization.

### Rows to leave out

Drop, and list in your report: totals and subtotals, header or label rows,
customers with no street address, and anything that is not a customer.

### Duplicates

A name may appear once per state. If the source lists the same customer
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

- Each row is stored in its `region` (default: its `state`).
- Rows are matched to existing distributors by exact `name` within that region.
  A match is updated (only fields that differ, and `customerType`, `website`,
  and `active` only when the cell is not blank); no match creates a new
  distributor. Uploading the same file twice changes nothing the second time.
- A name that matches more than one existing distributor in the region is
  skipped and reported.
- Rows with problems are reported with their line number; valid rows in the
  same file are still imported. A file with no valid rows, or a missing
  required column, imports nothing.
