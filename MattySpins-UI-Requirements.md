# MattySpins — UI Requirements

A build spec for every screen on the site, written against what is actually in
the repo today rather than what was originally planned. Where a screen is still
unbuilt or reading placeholder data, it says so.

Read this alongside `MattySpins-UI-Spec.md` (the original design document) and
`MattySpins-Master-Plan.md` (the product decisions). Where they disagree with
this file, this file is what shipped.

**How each screen is described**

| Field | Meaning |
|---|---|
| Route | The URL |
| Data | Where the numbers come from — a database table, an API, or `lib/mock.ts` |
| States | Every state the screen must handle, not just the happy one |
| Status | `built` · `built, needs work` · `shell only` · `not built` |

---

## 0. The five rules everything obeys

These are the ones easiest to erode by accident, and every review should check
them first.

1. **Blue is the only loud colour.** `#2B8FFF`. One exception: green `#2ED47A`
   means "Matty is live" and nothing else — earned because live/offline is the
   most-checked fact on the site and the convention is universal.
2. **Amber means money.** `#FFB93B`, and nothing else ever. Never blue and amber
   on the same element.
3. **Every number in a column is mono with tabular figures.** Money, coins,
   wagered totals, multipliers, countdowns, ranks. Non-negotiable — columns of
   proportional digits do not line up and read as amateur.
4. **Derived figures are never stored or typed.** A multiplier comes from bet and
   payout. A prize pool comes from summing the tiers. If a number can be
   computed from two others on screen, compute it, so they can never disagree.
5. **Nothing is invented.** A figure we do not have renders as an em dash, not a
   zero. `0` is a claim; `—` is an admission. `lib/format.ts` exports `maybe()`
   for exactly this.

---

## 1. Foundations

### Colour

Defined once in `app/globals.css` as Tailwind v4 `@theme` tokens. Never write a
hex value in a component — if a colour is missing, add a token.

| Token | Hex | Use |
|---|---|---|
| `bg` | `#070B14` | Page ground |
| `surface` | `#0D1422` | Cards, panels |
| `surface-2` | `#111A2B` | Raised inside a card; a resting tile |
| `line` | `#1B2740` | Every border by default |
| `line-2` | `#29354D` | Only on something pressed, typed into, or revealed |
| `ink` | `#E8EDF5` | Primary text |
| `ink-2` | `#A9B6C9` | Body text |
| `muted` | `#8C99AD` | Labels, secondary |
| `faint` | `#6B7891` | Timestamps, hints, disabled |
| `brand` | `#2B8FFF` | The one loud colour |
| `brand-dim` | `#6BB0FF` | Hover on brand text |
| `brand-ink` | `#04121F` | Text on a brand fill |
| `brand-bg` | `#0C1B33` | Brand-tinted panel |
| `brand-line` | `#1E3A63` | Brand-tinted border |
| `gold` | `#FFB93B` | Money |
| `gold-bg` / `gold-line` | `#1A1608` / `#33290F` | Money-tinted panel |
| `silver` / `bronze` | `#C6CFDD` / `#B07A4E` | Ranks 2 and 3 |
| `online` | `#2ED47A` | Live only |
| `online-bg` / `online-line` | `#07201A` / `#14452F` | Live panel |
| `danger` | `#FF8A6B` | Errors, destructive, self-exclusion |
| `danger-bg` / `danger-line` | `#1C0F0B` / `#3B1D14` | Danger panel |
| `live` | `#E5352B` | The Kick-style LIVE tag on a player |
| `discord` | `#5865F2` | The only other brand's colour allowed |

### Type

- **Display** — Anton, uppercase only. Headings and big figures.
- **Body** — Barlow.
- **Numbers** — JetBrains Mono, `tabular-nums`, always.

Sizes are set per component; there is no type scale to memorise. Match the
neighbouring screen.

### Layout

- Container `1440px`, gutters `56px` desktop / `18px` mobile
- `72px` between major sections, `20px` inside cards
- Two breakpoints only: below `768px` mobile, `1024px+` desktop
- Hairline dividers are a 1px-gap grid over a `line`-coloured background, not
  borders — see `Hairlines` in `components/ui/surfaces.tsx`

### Radii

Tight. `3px` cards and buttons, `2px` chips, circles only for avatars and status
dots. **Exception:** the games use larger radii (`10–16px`) because they follow
a supplied casino design; do not spread that to the rest of the site.

### Motion

Four things move, and nothing else:

- the live dot pulses
- buttons transition colour at 150ms
- cards brighten their border on hover
- the play button scales slightly on press

Keno adds two: a drawn tile pops with a slight overshoot (260ms), a history chip
rises in (220ms). All must be disabled under `prefers-reduced-motion`.

---

## 2. Primitives — `components/ui/`

These exist and should be reused rather than re-implemented.

| File | Exports | Notes |
|---|---|---|
| `typography.tsx` | `Display`, `Label`, `Num`, `SectionHeading` | `Num` enforces mono + tabular |
| `controls.tsx` | `Button`, `ButtonLink`, `Input`, `Chip`, `ChipRow`, `StatusDot` | `Button` variants: primary, outline, danger |
| `surfaces.tsx` | `Card`, `Banner`, `EmptyState`, `Hairlines`, `Stat` | `Card` tones: default, brand, gold, danger |
| `marks.tsx` | `CoinMark`, `PlatformMark`, `RazedZ`, `RazedWordmark`, `SOURCE_LABELS` | |
| `Countdown.tsx` | `Countdown` | Ticks client-side, tabular |
| `CopyButton.tsx` | `CopyButton` | Compact and labelled variants |

**Missing primitives worth adding:** a `Toast`/inline-feedback component (every
admin screen currently rolls its own status paragraph), a `Modal`, a `Tooltip`,
and a `Skeleton` for loading states.

---

## 3. Global chrome

### Nav — `components/site/Nav.tsx` · built

Links: Giveaways · Leaderboard · Shop · Community · Games. Right side: live
badge, then either **Sign in with Discord** or the account menu.

- **Games is visible to everyone.** It disappears only on self-exclusion. Do not
  gate it on sign-in — the page is public and the age gate runs first.
- The live badge is green when live, neutral when not. Never fake it.
- Mobile collapses to a hamburger; the bottom tab bar carries the primary four.

### Mobile tab bar — `components/site/MobileTabBar.tsx` · built

Fixed, `62px`, four items: Home · Board · Shop · Me. Page content needs
`pb-[62px]` so nothing hides behind it.

### Footer — `components/site/Footer.tsx` · built

Site links, trust links, legal links, socials, and the responsible-gambling
line. The four legal pages must always be reachable from here.

### Age gate — `components/site/AgeGate.tsx` · built

Blocks the whole site until confirmed, stored per browser. States 18+, names the
Razed affiliate link, and says coins cannot be bought and are not a wager.

### Coin bar — `components/site/CoinBar.tsx` · built

The signed-in strip showing balance, multiplier and earning state. Three states:
signed out · signed in but no Kick link · earning.

---

## 4. Public screens

### Home — `/` · built

| | |
|---|---|
| Data | Stream from `stream_sessions`; clips and big wins from `clips`; board from Razed; stats from `lib/mock.ts` (**still placeholder**) |
| Status | built, needs work |

Sections in order: hero, stat strip, weekly board preview, how coins work,
clips, biggest wins, about Matty, socials.

**States**
- Live vs offline hero — offline shows the last VOD and the schedule strip
- Signed out vs signed in vs signed in without a Kick link (earning status block)
- No clips → the whole clips section is absent, not an empty carousel
- No big wins → the band is absent
- No open period → board preview says "No board to show yet", countdown shows `—`

**Needs work:** the four stat-strip figures (weekly prize pool, members earning,
paid out to date) still read `null` from mock and render as `—`. They need real
sources: pot from the open period, members from `users`, paid-out from finalised
prize claims.

### Leaderboard — `/leaderboard` · built

| | |
|---|---|
| Data | Periods and tiers from `lb_periods` / `prize_tiers`; rows live from Razed |
| Status | built |

Tabs: Weekly · Monthly · Archive. Podium for ranks 1–3, then a table from 4.

**States**
- **No period open** — "No board is open", explains a period must be set in admin
- **Period open, feed healthy** — podium + rows + "Updated N minutes ago"
- **Feed stale or failing** — gold banner above the board carrying the real
  reason. Never render an empty board silently; that is how you get accused of
  rigging
- **Frozen** — brand banner, ranks locked, "Claim a position" button
- **Archive empty** — "Nothing has closed yet"

**Requirements**
- The sync timestamp has a fixed position and never disappears during a refresh
- Usernames are masked server-side; the browser never receives a full one
- Movement arrows need two stored snapshots — currently always `null`, so the
  column renders empty. Either build the snapshot store or drop the column

### Claim a prize — `/leaderboard/claim` · built

Multi-step: pick your position → state your Razed username → confirm.

**States:** no frozen board · signed out · in progress · submitted.

### Wall of fame — `/wins` · built

Grid of big wins with bet, payout and derived multiplier. Record cards for
biggest multiplier and biggest win appear **only** once a record exists. Sort by
multiplier / win / date, filter by month when more than one month exists.

### Clips — `/clips` · built

Filter chips by source. Nothing embeds until clicked — a thumbnail with a play
button, replaced in place. Aspect ratio is a data field, so 9:16 reels are not
letterboxed.

### Games lobby — `/games` · built

Card grid, five per row, image + name below. Blackjack and baccarat show
"Coming soon" and are not clickable. "Biggest hits today" table appears only
when there were rounds today.

### Shop — `/shop` · shell only

| | |
|---|---|
| Data | `lib/mock.ts` — **no table exists** |
| Status | shell only |

Renders the catalogue and costs but **nothing can be redeemed**. Needs:
`shop_items` and `redemptions` tables, a redeem action, a confirmation step, and
per-item states (affordable · too expensive · out of stock · on cooldown ·
already pending).

### Giveaways — `/giveaways` · shell only

Same situation. Needs `giveaways` and `giveaway_entries`, an entry action, the
entry counter, and the provably-fair draw reveal.

### Profile — `/me` · built

Desktop is a sidebar + content layout; mobile is its own component
(`ProfileMobile.tsx`). Sections: overview, coin history, redemptions, play
settings, account.

**Requirements**
- Self-exclusion must be reachable on every viewport. It was desktop-only once;
  that is a responsible-gambling failure, not a layout bug
- No deposit and no withdraw, ever. Coins cannot be bought
- Kick verification card lives here — see below

### Kick verification — `components/site/Verification.tsx` · built

Four states in one card:

1. **Unlinked** — explains the process, "Generate my code"
2. **Waiting** — shows `MS-XXXX`, a copy button, a countdown, and a note if
   Matty is offline. **Polls the server** and updates itself when the bot
   confirms — the viewer must never have to refresh
3. **Expired** — greyed and struck through, offers a new code. Not an error
4. **Linked** — Kick username, verified date, a check mark

### Verifier — `/verify` · built

Public. Recomputes any round from server seed, client seed and nonce. Works
signed out and on somebody else's round.

### Casinos / Official accounts — `/casinos`, `/official` · built

Static. `/official` is the impersonation-defence page listing real accounts.

### Legal — `/terms`, `/privacy`, `/giveaway-rules`, `/responsible` · built

All four exist and carry a draft banner while `LEGAL_REVIEWED` is false in
`lib/legal.ts`. A lawyer flips that flag.

---

## 5. Games

### Shared — `components/games/shared.tsx`

- `useGame(slug)` — state, play, rotate, error, signed-out
- `SignInToPlay` — the signed-out screen
- `FairnessDrawer` — server seed hash, client seed, nonce, rotate, verify link
- `OptInGate` — the 18+ opt-in, shown when games are off for this account

**Every game must:** refuse to compute an outcome client-side, send an
idempotency key with every play, disable controls while a round settles, and
show its own RTP.

### Keno — `/games/keno` · built

Follows the supplied Claude Design board.

- Header: eyebrow, balance in gold, labelled sound toggle
- Left rail (292px): bet with ½ and 2×, risk as a 2×2 grid with a hue per level,
  number picker (slider + Pick + Clear + "N / 10 selected"), play button
- Board: 8 across desktop, 5 across mobile
- Below: history strip of multiplier chips, then the paytable as one cell per
  hit count

**The four tile states must be visually distinct at a glance:**

| State | Treatment |
|---|---|
| Idle | `surface-2`, `line` border, muted number |
| Picked | brand-tinted fill and border, bright number |
| Drawn, missed | sunken — darker than the board, lighter rim, pop animation |
| Hit | solid brand fill, brand-ink number, glow, pop |

This is the one thing most likely to regress: if "drawn but not picked" looks
like "untouched", the ten numbers the round is actually about become invisible.

**Paytable:** every tier is shown including the ones that pay `0×`. On High you
can hit five of six and win nothing, and that belongs on screen before the round.

### Dice — `/games/dice` · built

Slider target, over/under, derived win chance and payout. Result reads back on
the same rail that set it.

### Limbo — `/games/limbo` · built

Target multiplier, a number that counts up and stops in under a second, and a
history strip — limbo players read streaks.

### Blackjack / Baccarat — not built

Lobby cards say "Coming soon" and are not clickable. No further UI needed until
fairness has run in public for a month.

---

## 6. Admin dashboard

Its own shell, denser than the public site, never sharing the public chrome.
Reachable at `/admin`, deliberately unlinked from the public nav.

### Shell — `components/admin/AdminShell.tsx` · built

Left sidebar: Overview · Razed players · Members and coins · Redemptions ·
Giveaways · Shop items · Prizes and periods · Clips · Games · Audit log.

**Requirements**
- Owner-only areas are greyed and labelled, never silently hidden — a moderator
  should be able to see what exists and who to ask
- Every destructive action writes an audit row
- Every screen has a no-database state that names the variable to set

### Overview — `/admin` · built

Four figures, a redemption queue, feed health, coin flow, last ten audit rows.

Feed health must show **real** status for: Razed, the Kick webhook, the coin
tick job, and the database. A green light nobody checked is worse than no light.

**Needs work:** the redemption queue shows `—` because no table exists.

### Prizes and periods — `/admin/prizes` · built

The screen that decides what the leaderboard measures.

- **Open a board**: type, start, end, optional "copy the last board's tiers"
- **Period list**: date range, type, tier count, derived pot, status
- **Detail**: editable dates (open boards only), status actions, derived prize
  pool, tier table
- **Tiers**: rank-from, rank-to, amount each. A range is one row — "4–10 → $400
  each" pays $2,800 and is a single line
- Prize pool is labelled **calculated** and has no input
- Overlapping ranks are refused with a message naming the clash
- Freeze / mark paid / archive are owner-only and labelled as such

### Clips — `/admin/clips` · built

Paste a URL → Fetch (parses platform, embed, thumbnail) → title, and for a big
win the slot, date, bet and payout. Multiplier is an inset panel labelled
**calculated**, never a field. Pin (max 3, a fourth refused with a message),
Save as draft, Publish. List below with pin/publish/delete per row.

"Announce in Discord" is disabled — there is no bot behind it yet.

### Members and coins — `/admin/members` · built

Searchable list: member, Kick link, balance, lifetime earned, joined, status.
Unlinked shows in gold — an unlinked account earns nothing, and that is the
first thing to check when someone says coins are broken.

Detail: balance, lifetime earned, multiplier, coin adjustment (amount + a
**mandatory** reason, stored on the ledger row itself), freeze/unfreeze, ledger.
Moderator adjustments cap at 500 MC.

**Needs work:** the search box is not wired.

### Razed players — `/admin/razed` · built

The live feed, **unmasked** — a moderator verifying a claim needs the real
username. Date range, top-N, feed health pill, and an honest count ("showing 33
of 33", or a truncation warning).

**Needs work:** the date and top inputs are display-only; the range comes from
the open period.

### Games — `/admin/games` · built

Kill switch at the top (owner-only, disables every game without a deploy), coin
flow, per-game config cards, live round feed with anomaly filters.

**Needs work:** every input is display-only. Nothing here saves. Wiring it means
a `game_configs` table and the same server-action pattern as clips and prizes.

### Audit log — `/admin/audit` · built

When, admin, action, target. Rows are never edited or deleted, including by the
owner — a correction is a second row.

**Needs work:** search and the admin filter are not wired.

### Redemptions / Giveaways / Shop items — shell only

All three render but write nothing, because their tables do not exist. Building
the shop is the next meaningful piece of work: it is what makes the coins people
are now earning worth having.

---

## 7. States every screen must handle

Screens are usually built for the happy path and then fail on the other five.

| State | Requirement |
|---|---|
| **Loading** | Never a layout jump. Prefer a skeleton at the final size |
| **Empty** | Say what will appear here and how to make it appear. Never an empty table with headings |
| **Error** | Say what failed and what to do. Never a silent zero |
| **Signed out** | A first-class state on shop, giveaways, profile, games and claim |
| **No Kick link** | Signed in but earning nothing — the site must say so, prominently |
| **No database** | Admin screens name the variable to set. Public screens degrade to empty |
| **Frozen / excluded** | Games vanish from the nav; play endpoints refuse |

---

## 8. Accessibility and responsive

- Every interactive element reachable by keyboard, visible focus ring (`brand`,
  2px)
- Icon-only buttons carry `aria-label`; toggles carry `aria-pressed`
- Tabs use `role="tablist"` / `role="tab"` / `aria-selected`
- Status messages that appear after an action use `role="status"`
- Colour is never the only signal — a hit tile also animates, a frozen board
  also says "frozen"
- **The page body never scrolls horizontally.** Wide content scrolls inside its
  own container. Check at 375px
- Grid children that hold long unbreakable strings need `min-w-0`, or they
  refuse to shrink and push the page sideways

---

## 9. Copy rules

- Say what a thing is, not how it feels. "Earning paused — stream offline", not
  "Come back soon!"
- Never imply coins have cash value. No `$` on a coin figure, ever
- Losing states are stated plainly, not softened
- Every claim about money carries its provenance — where the figure came from
  and when it was last checked

---

## 10. Status summary

| Area | Status |
|---|---|
| Design tokens, primitives | built |
| Nav, footer, tab bar, age gate | built |
| Home | built; four stat figures still placeholder |
| Leaderboard, claim, archive | built |
| Clips, wall of fame | built |
| Keno, dice, limbo | built |
| Profile, Kick verification | built |
| Verifier, casinos, official, legal | built |
| Admin shell, overview, audit | built |
| Admin prizes and periods | built |
| Admin clips | built |
| Admin members and coins | built |
| Admin Razed players | built |
| Admin games | shell only — nothing saves |
| Shop, giveaways, redemptions | shell only — no tables |
| Blackjack, baccarat | not built |

**If you are picking one thing to build next:** the shop. Coins are being earned
and there is nothing to spend them on, which breaks the loop the whole site is
built around.
