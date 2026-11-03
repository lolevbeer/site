# Elevate roadmap: from up-to-date to indispensable

Status: proposal. Nothing here is approved. Each item becomes its own plan
(`docs/plans/<item>.md`) before any code is written.

## Where we are

The site is already good at showing what is true right now:

- Live tap and can menus, pushed over Ably to the web and the taproom TVs.
- Beer detail pages (`/beer/[variant]`) with Product JSON-LD, OG cards and
  Untappd reviews.
- Events with a per-event `.ics` file, recurring events, food truck schedules
  and holiday hours.
- A distributor beer map, a private-events funnel, jobs, donations, `llms.txt`
  and a feed, plus a lot of Lighthouse and accessibility work.

What it doesn't do yet is give people a reason to come back on their own.
Today a visitor has to check the site. The best brewery site would tell them
when something they care about changes, and would turn that into a visit or a
sale. Everything below works toward that.

## Ranked opportunities

### 1. Release alerts: "Tell me when it's back" (highest leverage)

- A follow button on each beer page and on the "coming soon" list. The visitor
  enters an email and gets one message when that beer goes on tap or into cans
  at any location.
- Why: it is the only item on this list that brings people back without them
  having to think of it. Every beer that rotates off becomes a future visit
  instead of a lost fan.
- Fit: Resend is already wired up (#341, #342), and menu saves already fire
  hooks (revalidation, Slack, Ably). A new menu-publish hook diffs which beers
  were added and emails their followers.
- Needs: a `beer-followers` collection (email, beer, double opt-in token,
  unsubscribe), a public intake route with rate limiting (the same pattern as
  inquiries), and an update to the privacy page (it currently says there is
  no mailing-list form).
- Open question: should this replace or feed the Square newsletter, or sit
  beside it?

### 2. Subscribable event calendar (cheap, high frequency)

- One `webcal://` feed for every public event, plus one per location. Today
  there is only a `.ics` file per event (`events/[id]/calendar.ics`).
- Why: people subscribe once and trivia, releases and food trucks show up in
  their own calendar forever.
- Fit: reuses the existing ICS builder and public-only event reads
  (`overrideAccess: false`, no user). About one route per scope.

### 3. "Where can I buy this?" on every beer page

- Beer pages show taproom tap and can availability. Distributor data exists
  (the beer map and the CSV importer, #271) but isn't linked from the beer.
- Add a "Find it near you" block that lists the distributors and regions
  carrying that beer and links to the map pre-filtered to it.
- Why: it turns a page someone reads into an answer to the question they
  actually have, especially for out-of-market fans and search traffic
  ("<beer name> near me").

### 4. "Tonight at <location>" right now view

- One glance answers: open now and until when (holiday hours included), what
  just tapped, today's food truck, tonight's event. Pick the location from the
  URL or the last one viewed.
- Why: the most common visit intent is "should I go tonight?". The data
  already exists across Menus, HolidayHours, food schedules and Events. This
  is composition, not new content.
- Check first: the homepage journey links (#345) and the location pages may
  already cover part of this. Audit before building.

### 5. Pre-orders and can-release pickup (biggest prize, biggest cost)

- Reserve or pre-pay limited can releases and merch for pickup at a taproom.
- Why: direct revenue, and limited releases are where brewery fans are most
  engaged.
- Cost: payments, inventory, fulfilment, and staff process. This is a business
  decision before it's an engineering one. If we go ahead, use a provisioned
  commerce integration (for example Square, which already runs the
  newsletter), not custom checkout.

### 6. Search and local presence

- Add Menu and Event structured data for what's pouring and what's on, if it
  isn't there already. Product, breadcrumb and webpage schema exist on beer
  pages today.
- Keep Google Business Profile hours and events in sync from HolidayHours and
  Events, so the knowledge panel never contradicts the site.

### 7. Measure it

- Decide on three to five outcome metrics: inquiries submitted, follows,
  calendar subscribes, direction or map clicks, and (if item 5 ships) orders.
  "Number one brewery site" needs a number.
- Check first: the `cx3/tracking` worktree may already be adding analytics
  events. Build on it rather than duplicating it.

## Deliberately skipped

- PWA or app install: release alerts by email deliver most of the value with
  none of the upkeep.
- Loyalty or mug club accounts: that's a point-of-sale feature and belongs in
  Square, not here.
- Translations: no evidence yet of non-English demand.

## Suggested order

1. Release alerts (item 1) and the calendar feed (item 2) in parallel. They
   don't touch the same files.
2. Where to buy (item 3).
3. Tonight view (item 4), after the homepage audit.
4. Pre-orders (item 5), only after a business decision.
5. Metrics (item 7) as soon as item 1 ships, so follow conversion is measured
   from day one.
