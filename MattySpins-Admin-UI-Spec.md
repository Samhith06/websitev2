# MattySpins Admin — Complete UI Specification

The admin dashboard: shell, overview, and nine screens. Companion to
`MattySpins-LateNight-UI-Spec.md`, which holds the tokens (§1), the type scale (§2) and
the primitives (§5). **Read those three first.** §3 the light layer and §4 the motion
system are **deliberately not inherited here**; see The reduced system below. This
document supersedes `Late Night` §36.

Content, data and behaviour come from `MattySpins-UI-Requirements.md` §5. Every rule in
it survives.

**Routes:** everything under `app/admin/`, plus `components/admin/*`.
**Presentation only.** Every server action, every query and the audit writer are untouched.

---

## The organising principle

The public site is for people who might stay. **This is for two or three people who are
here because something needs doing.**

Requirements: its own shell, denser than the public site, never sharing the public chrome,
deliberately unlinked from the public navigation. That is not a styling note, it is the
whole brief. An operator running twenty redemptions does not want the room breathing at
them.

```
   IS ANYTHING BROKEN?     overview: feed health, coin flow      §2
   DOES ANYTHING NEED ME?  the redemption queue                  §2 §9
   WHO IS THIS PERSON?     members, Razed players                §5 §6
   WHAT IS THE BOARD?      prizes and periods                    §3
   WHAT GOES ON THE SITE?  clips                                 §4
   WHO DID WHAT?           audit log                             §8
```

**The admin is a record-keeping tool that happens to have buttons.** Every action writes
an audit row, every reason is stored on the thing it explains, and nothing is ever
rewritten. The design's job is to make that feel normal rather than bureaucratic.

---

## The three highest-value decisions

**1. Owner-only areas are visible, greyed, and labelled.** Requirements is explicit and
the reasoning is worth repeating: a moderator should see what exists and know who to ask,
rather than finding a hole. Hiding a control from someone who lacks permission teaches
them the feature does not exist. §0.6 specifies one treatment used everywhere.

**2. A reason is not a form field, it is part of the record.** Coin adjustments and
rejections take a **mandatory** reason, and Requirements says it is stored on the ledger
row itself rather than only in the audit log, so it travels with the movement it explains.
The UI treats it that way: the reason sits inside the same block as the amount, not in a
separate "notes" section, and the apply button does not enable without it.

**3. Resist adding charts.** Requirements says this about the overview and it holds for
the whole dashboard. This page answers two questions and every extra element makes that
slower. There are **no charts anywhere in this document.** Figures are figures, status is
a pill with a real detail line, and trends live in the audit log where they can be read.

---

## The reduced system

**What admin inherits from `Late Night`:** the tokens (§1), the type trio (§2), the radii,
the primitives (§5), the focus ring, the empty and loading states (§34), and `Num` with
its `—` for null.

**What admin does not get, deliberately:**

- **No light layer.** Flat `--color-canvas`, no key gradient, no drift, no `.lit`
  gradients on panels. Panels are flat `--color-panel` with a `--color-line` hairline.
- **No living elements.** Nothing breathes, pulses or cycles. The one exception is a
  status pill that is genuinely polling (§2 feed health), and it gets a 2px dot, not a
  glow.
- **No entrances.** No `Reveal`, no stagger, no counting numbers. Rows appear.
- **No display face above `display-s`.** Page titles are `display-s`. Nothing is larger.
- **No interactive moment**, no signature element, no full-bleed anything.

**Density, against the public site:**

| | Public | Admin |
|---|---|---|
| Body | 16px / 1.6 | **13px / 1.5** |
| Table row | 64px | **44px** |
| Panel padding | 24 to 32px | **16px** |
| Section gap | 96 to 140px | **32px** |
| Control height | 44 to 48px | **36px** (44px under `pointer: coarse`) |

**Colour keeps its public meanings**, so an operator switching between the two is never
retrained: blue is action and the active state, gold is money, `--color-danger` is
failure and destruction. Admin adds one: **`--color-gold` also marks owner-only.**

---

## Shared patterns

Six things appear on nearly every screen. Build them once.

> **0.1 — The page header.** Eyebrow at `label` size, title at `display-s`, and an optional
> right-hand actions slot. Hairline beneath. 56px tall. Identical on every screen.
>
> **0.2 — The calculated panel.** Requirements rule 2 runs through admin harder than
> anywhere: prize pools, multipliers and keno's RTP are all derived, and there is
> deliberately no field for any of them.
>
> One inset panel: `--color-panel-2`, no border, 12px padding, with `CALCULATED` at 9px
> mono `--color-faint` in its top right corner. The figure at `num-m` mono, and beneath it
> the derivation in words at 11px `--color-muted` (`summed from 6 tiers covering 20 ranks`,
> or `€425 ÷ €100`).
>
> **It is never an input and never looks like one.** No border, no background matching the
> form fields, no cursor change. An operator must not be able to try to type in it.
>
> **0.3 — The reason field.** Wherever a reason is mandatory, it is a field **inside the
> same bordered block as the thing it explains**, not below it and not in a separate
> section.
>
> Label at `label` size with a blue asterisk: `REASON *`. A 36px mono input. Beneath, at
> 11px `--color-muted`, one line naming where it goes: `Stored on the ledger row, not just
> the audit log.` **The apply button is disabled until it has content**, and the disabled
> reason is named on the button: `Add a reason first`.
>
> **0.4 — The confirm.** Any action that moves money, changes a public page, or cannot be
> undone gets a dialog stating the consequence in full and, where a figure is involved, the
> resulting figure. **No default focus on confirm.** Destructive confirms additionally
> require the typed word named in that screen's section.
>
> **0.5 — The no-database state.** Requirements: every screen needs one, and it names the
> variable to set.
>
> A `--color-danger-line` panel replacing the screen's content:
> **No database connection.** Set `DATABASE_URL` and restart. Nothing here can load or save
> until it is set.
>
> The variable name is in mono with a `CopyButton`. **Every screen names the actual
> variable it needs**, not a generic message.
>
> **0.6 — Owner-only, and the not-an-admin state.**
>
> **Owner-only, seen by a moderator:** the control renders in full, at 55% opacity, not
> interactive, with a gold `OWNER ONLY` pill beside its label and one line beneath at 11px:
> `Ask an owner to do this.` Sidebar links to owner-only screens render the same way.
>
> The moderator sees the shape of the whole system and knows exactly who to ask. That is
> the requirement and it is worth the extra pixels.
>
> **Not an admin:** the entire shell is replaced by one centred panel, no sidebar:
> **This area is for moderators.** If you think you should have access, ask an owner in
> Discord. A ghost link back to the public site.

---

## 1. The shell

> Build the admin shell. **It shares nothing with the public chrome**: no public nav, no
> coin bar, no mobile tab bar, no light layer, no footer.
>
> **Layout:** a fixed 232px sidebar left, content right, `max-width: none` because tables
> want the room.
>
> ### The sidebar
>
> Flat `--color-panel`, right hairline, full height, `position: sticky`.
>
> - **Top:** the coin mark at 22px and `MATTYSPINS` at 14px Unbounded 700, then `ADMIN` at
>   10px mono `--color-faint` beneath. It does not link to the public site; a stray click
>   here should not lose an operator's place.
> - **The admin block:** avatar at 28px, name at 13px, and the role at 10px mono in a pill
>   — `OWNER` gold outline, `MODERATOR` blue outline. **The role is always visible**,
>   because half the greyed controls on this dashboard only make sense if you can see why.
> - **Links**, in Requirements' order: `Overview` · `Razed players` · `Members and coins` ·
>   `Redemptions` · `Giveaways` · `Shop items` · `Prizes and periods` · `Clips` · `Games` ·
>   `Audit log`.
>   - 36px rows, 13px, icon at 16px, `--color-ink-2`, active is `--color-ink` on
>     `--color-panel-2` with a 2px blue left border.
>   - **A count badge** at 10px mono where a screen has waiting work: `Redemptions 4`. It
>     is blue when non-zero and absent when zero, never `0`.
>   - Owner-only screens follow §0.6.
> - **Bottom:** a `Sign out` ghost row, and the build's short commit hash at 10px mono
>   `--color-faint`. An operator reporting a bug should be able to say which build.
>
> ### The content area
>
> 24px padding, the §0.1 header, then the screen. **No page transitions.**

---

## 2. Overview

> Build `/admin`. Requirements: it answers two questions, is anything broken and does
> anything need me, and **every extra element makes that slower.**
>
> **Eyebrow:** `TODAY` · **Title:** `Overview`
>
> ### Four figures
>
> One row, four cells, hairline separated, 80px. Label at `label` size, figure at `num-m`
> mono tabular.
>
> | Cell | Figure | Note |
> |---|---|---|
> | `COINS MINTED THIS WEEK` | gold, `MC` | |
> | `DESTROYED BY THE EDGE` | `--color-ink-2`, `MC` | |
> | `EARNING RIGHT NOW` | `--color-ink` | with `of 1,204 accounts` at 11px beneath |
> | `ROUNDS TODAY` | `--color-ink` | |
>
> ### The redemption queue
>
> A panel: the count at `num-m` blue in the header, the waiting items as up to five
> 36px rows (member, item, cost, age in mono), and a ghost link, `Open the queue`.
>
> **Age is the useful column**, so it is right-aligned and turns gold past 24 hours and
> `--color-danger` past 72. A queue that does not show what is going stale is a list.
>
> **Requirements gap:** no redemption table exists, so this renders `—` today. **Render the
> panel with its empty state, not a hidden panel.** `Waiting on the redemptions table.`
>
> ### Feed health
>
> Four rows, hairline separated, 44px, grid `1fr auto auto`. **Each needs a real detail
> line, not just a pill.**
>
> | Row | Detail line |
> |---|---|
> | Razed leaderboard | last sync time |
> | Kick webhook | last event received |
> | Coin tick job | last tick |
> | Database | connection latency in ms |
>
> Status pill: `OK` blue outline, `SLOW` gold outline, `DOWN` danger outline.
>
> **On `DOWN` the detail line is the actual error string**, in mono at 11px, truncated with
> a copy button. Not "an error occurred". The whole value of this block is that it saves a
> log dive.
>
> This is the one place a polling indicator is allowed: a 2px dot beside the block heading
> while a check is in flight. No glow, no pulse ring.
>
> ### Coin flow this week
>
> Three figures on one row: `MINTED`, `DESTROYED`, **`NET`** (dominant, gold above zero and
> `--color-danger` below), then one line at 11px `--color-muted`:
>
> **The lever here is shop prices, never the advertised RTP.**
>
> That sentence is a guardrail written into the UI, and it stays.
>
> ### Last ten actions
>
> Ten 36px rows from the audit log: time, admin, action, target, all mono at 12px. A ghost
> link, `Full audit log`.
>
> ### And nothing else
>
> **No charts. No sparklines. No trend arrows. No "this week vs last week".** If a figure
> needs context, the audit log has it. Requirements asks for this restraint by name and it
> is the easiest instruction in this document to quietly break.

---

## 3. Prizes and periods

The screen where a mistake costs real money.

> **Eyebrow:** `THE BOARD` · **Title:** `Prizes and periods`
>
> ### The explanatory note, first
>
> A `--color-panel-2` panel at the top, 13px, capped at `84ch`:
> **A period's dates are the window sent to Razed.** Freezing is a button, not a clock, so
> a board stays open until somebody closes it.
>
> ### Open a board
>
> A form panel: type (segmented, `Weekly` / `Monthly`), start date, end date, a checkbox
> `Copy the last board's tiers`, and a primary `Open board` button.
>
> Beneath, at 11px `--color-muted`:
> **Both dates are inclusive and in UTC. Only one board of each type can be open at a
> time.**
>
> When one is already open, the button is disabled and names why:
> `A weekly board is already open`.
>
> ### The period list
>
> 44px rows, hairline separated: date range (mono), type, tier count, **derived pot**
> (gold, mono), status pill. Selecting a row opens its detail below, in place, without
> navigating.
>
> Status pills: `OPEN` blue, `FROZEN` gold, `PAID` blue filled, `ARCHIVED`
> `--color-line-lit` outline.
>
> ### Period detail
>
> **Dates** are editable **only while open**, with a save control. When not open, the
> fields render as read-only mono values, and a banner explains why:
>
> **This board is frozen and its dates and tiers are locked.** It is the record of what
> people competed for, so it cannot be changed after the fact.
>
> **Status actions**, as a row of buttons in order: `Freeze` **(owner only, §0.6)** →
> `Mark paid` → `Archive`, plus `Reopen`. Each is disabled with a named reason when it is
> not the legal next step: `Freeze the board first`.
>
> **The moderator banner**, when a moderator opens a period detail:
> **You can edit tiers, but only an owner can freeze a board.**
>
> ### The prize pool
>
> **A §0.2 calculated panel**, and Requirements is emphatic that there is deliberately no
> field for it. The derivation line reads:
> `summed from 6 tiers covering 20 ranks`
>
> ### Prize tiers
>
> One row each, 44px: rank range (`4 – 10`), **how many places it covers** (`7 places`),
> amount each with an inline editor, **the row total** (calculated, gold), and
> save / remove controls.
>
> The row total is a second §0.2 figure at row scale: no border, `CALCULATED` omitted at
> this size but the value never editable.
>
> ### Add a tier
>
> `Rank from`, `Rank to`, `Amount each`, and an `Add` button. Beneath at 11px:
> **A range is one row. Ranks cannot overlap.**
>
> **An overlap is refused with a message naming the clash**, not a generic error:
> **Ranks 8 to 12 overlap the existing tier 4 to 10.** Change one of them.
>
> Requirements' reasoning is worth carrying in the code comment as well as the UI: a rank
> paid twice is the kind of mistake nobody notices until someone is owed money.
>
> ### States
>
> No periods yet · open · frozen · paid · archived · moderator vs owner · overlap refused.

---

## 4. Clips

> **Eyebrow:** `WHAT GOES ON THE SITE` · **Title:** `Clips and wins`
>
> **Two columns:** the form left at `1fr`, the preview right at `380px`, sticky.
>
> ### The form
>
> 1. **Entry type** chips: `Big win` · `Regular clip`. The choice shows and hides block 4.
> 2. **Source URL** with a `Fetch` button that resolves platform, embed and thumbnail.
>    Beneath at 11px: **Kick and YouTube give a thumbnail from the link alone. Instagram
>    and X need one uploading.**
>    While fetching, the button reads `Fetching…` and is disabled. On failure, an inline
>    line beneath, never a toast: **Could not read that link.** Check it opens in a browser,
>    or add the thumbnail by hand.
> 3. **Title.**
> 4. **Big wins only:** slot, date of the win, bet, payout.
> 5. **Multiplier** as a **§0.2 calculated panel**, derivation `€425 ÷ €100`, with the
>    note: **There is deliberately no field for this.**
> 6. **Preview**, in the sticky right column: the fetched thumbnail **at its stored aspect
>    ratio** with the multiplier overlaid exactly as `Media and Trust §3` renders it. What
>    you see here is what the site shows.
> 7. **Toggles:** `Pin to the homepage` with a used/total count beside it (`2 of 3 used`),
>    and `Announce in Discord`, **disabled**, with the note: **No bot behind this yet.**
>    **A fourth pin is refused with a message, not silently dropped:**
>    **Three clips are already pinned.** Unpin one first.
> 8. **`Save as draft`** ghost and **`Publish`** primary.
>
> ### The list
>
> 44px rows: title, source, aspect, date, figures, status pill, and per-row `Pin`/`Unpin`,
> `Publish`/`Unpublish`, `Delete`.
>
> **Drafts are visibly different**, not just a pill: the row's title renders in
> `--color-muted` with a `DRAFT` pill. **Nothing reaches the public site until published**,
> and Requirements names the reason: it is what stops the carousel filling with filler
> inside a week.
>
> `Delete` is a §0.4 confirm requiring the typed word `DELETE`.
>
> ### The aspect column
>
> A plain mono value: `16:9`, `9:16`, `1:1`. **It is a data field and it is editable here**,
> because `Media and Trust §6` depends on it being right and a wrong value letterboxes a
> reel on the public site.

---

## 5. Members and coins

> **Eyebrow:** `PEOPLE` · **Title:** `Members and coins`
>
> ### Search
>
> One 36px input, full width of the panel, placeholder:
> `Discord name, Kick name or Kick id`.
>
> **Requirements gap: the search box is not wired.** Until it is, render it **disabled with
> a named reason** beneath at 11px gold: `Search is not wired up yet.` **Never render a
> live-looking input that does nothing.**
>
> ### The member table
>
> 44px rows: member, **Kick link**, balance, lifetime earned, joined, status.
>
> **The Kick link column is called out, and this is deliberate.** An unlinked account earns
> nothing, and Requirements says it is the first thing to check when somebody says coins
> are broken. So:
> - Linked renders the Kick username in mono at 12px.
> - **Unlinked renders `NOT LINKED` in a gold outline pill**, not an empty cell and not a
>   `—`. It is the most useful cell on the screen and it should be the one your eye lands
>   on when scanning.
>
> Status pills: `ACTIVE` `--color-line-lit`, `FROZEN` danger outline.
>
> ### Member detail
>
> Opens in place beneath the row.
>
> - **Identity:** username, Kick username **and numeric id** (mono, copyable), member since.
> - **Three figures**, one row: balance, lifetime earned, multiplier.
> - **Coin adjustment**, one bordered block containing all three parts together:
>   - `AMOUNT` — a mono input accepting a signed value.
>   - **`REASON *`** — the §0.3 field, mandatory, with its line:
>     `Stored on the ledger row, not just the audit log.`
>   - `Apply` primary, **disabled until both are filled**, with the reason named on the
>     button when missing.
>   - **A moderator cap** applies. Above it the form refuses with:
>     **That is above the moderator cap of 5,000 MC.** An owner has to make this one.
>     The refusal is inline and the entered values are **kept**, not cleared.
>   - **A negative adjustment cannot take a balance below zero**, refused with:
>     **That would take the balance to −240 MC.** Balances cannot go negative.
> - **`Freeze` / `Unfreeze`**, a §0.4 confirm naming the effect: **Freezing stops this
>   account earning immediately. It does not remove their balance.**
> - **The member's coin ledger**, using the public `Profile §5` row grid at admin density,
>   **including the grouped watch sessions**. An operator investigating a complaint needs
>   the same view the member is looking at.
>
> **Every moderator adjustment shows its reason in the ledger**, as a line under the
> reason column, exactly as the public profile does. The two views must agree.

---

## 6. Razed players

> **Eyebrow:** `RAZED FEED · CODE MATTY` · **Title:** `Razed players`
>
> Header actions: `Sync now` outline, `Export CSV` ghost. A synced timestamp in a **fixed
> slot with no empty case**, same rule and same reason as `Leaderboard §1`.
>
> ### The filter bar
>
> `From`, `To`, `Top N`, and period preset chips, plus a feed-health pill matching the
> overview's.
>
> **Requirements gap: the date and top inputs are display-only; the window comes from the
> open period.** So they render **disabled with the reason stated in the bar**, at 11px
> gold: `The window comes from the open period. These are not wired yet.`
>
> ### The table
>
> 44px rows: rank, **Razed player**, matched member, wagered, coins, last seen in chat,
> action.
>
> **The Razed player column is unmasked here, and only here.** Every public surface masks
> usernames; a moderator verifying a claim needs the real one. It renders in mono at 12px
> with a `CopyButton`, because the next thing that happens to it is being pasted into a
> claim check.
>
> **The action column:**
> - A matched member gets `View`, ghost, opening their member detail.
> - **An unmatched player gets `Invite`, primary.** Requirements: a big wagerer with no site
>   account is the highest-value person on this screen. It is the only primary button in
>   any table in this dashboard, and that is on purpose.
>
> **Matched member** renders the match at 12px with a `LIKELY` pill in `--color-line-lit`
> when it was inferred. One line under the table:
> **Matching is a note for convenience. It is never used to pay a prize automatically.**
>
> ### The honest count
>
> Beneath the table, and it is not decoration:
> **Showing all 33.** Or, when a page was not read:
> **Showing 100 of at least 140. A page was left unread.** in gold.
>
> Then, always:
> **This is a top-N feed, not a per-player lookup.** Somebody below the cut-off simply does
> not appear here, and their absence is not evidence they did not wager.
>
> That last sentence prevents a specific wrong decision, so it renders at body contrast and
> never at `--color-faint`.

---

## 7. Games

Shell only. Every input is display-only and nothing saves.

> **Eyebrow:** `GAMES` · **Title:** `Games`
>
> ### The kill switch, at the top, owner only
>
> A `--color-danger-line` panel, first thing on the page, §0.6 for moderators.
>
> Heading at `display-s`: **Turn every game off**
> Body at 13px: This disables every game instantly, with no deploy. The lobby is replaced
> by a single message, balances are untouched, and rounds already in progress settle
> normally.
> A danger outline button: `Turn games off`, a §0.4 confirm requiring the typed word
> `OFF`.
>
> ### Coin flow for the week
>
> The same three figures as the overview (§2), so the two never disagree. Same component.
>
> ### A config card per game
>
> One panel each for Keno, Dice and Limbo: enabled toggle, RTP, min bet, max bet, max win.
>
> **Keno additionally gets the full editable paytable**, one cell per hit count per risk,
> mono, tabular, in a horizontally scrolling container.
>
> **Beside it, a §0.2 calculated panel: the RTP recomputed from the table itself.**
> Requirements: so a bad edit is visible before it ships.
>
> **This figure updates on every keystroke in the table**, and it is the point of the whole
> screen. When the recomputed RTP moves more than 0.5% from the advertised one, the panel
> turns `--color-danger` and adds a line:
> **This table pays 94.10%, not the 99.00% shown to players.** Fix the table or change what
> is advertised.
>
> ### The live round feed
>
> A table with anomaly filter chips: `Biggest wins today` · `Longest win streaks` · `Most
> rounds per hour`. 44px rows: time, member, game, bet, multiplier, payout, and a `Verify`
> ghost link.
>
> ### The display-only state
>
> **Every input on this screen is display-only and nothing saves.** So the whole screen
> carries one gold banner at the top, above the kill switch:
> **Nothing on this screen saves yet.** It needs a game config table. The kill switch is
> the exception and it works.
>
> *(If the kill switch is also unwired, say so instead. Do not ship a working-looking
> danger button that does nothing.)*

---

## 8. Audit log

> **Eyebrow:** `THE RECORD` · **Title:** `Audit log`
>
> Search input and an admin filter select, both **disabled with their reason stated**
> (Requirements gap: neither is wired): `Search and filtering are not wired up yet.`
>
> ### The table
>
> 44px rows, mono throughout: `WHEN` (mono, tabular, UTC), `ADMIN`, `ACTION`, `TARGET`.
>
> Action renders as a `--color-line-lit` outline pill in mono at 11px, so scanning for one
> kind of action is possible without search.
>
> ### The note, beneath the table
>
> At 12px `--color-muted`, and it is the most important sentence in the dashboard:
>
> **Rows here are never edited or deleted, including by the owner.** A correction is a
> second row, not a rewrite of the first.
>
> **There is no delete control anywhere on this screen**, for anyone, at any role. Not
> greyed, not owner-only. Absent. A greyed delete on an append-only log implies it exists
> somewhere.

---

## 9. Redemptions *(shell only)*

> **Eyebrow:** `QUEUE` · **Title:** `Redemptions`
>
> ### The queue
>
> 44px rows: member, item, cost (gold, mono), **age**. Age turns gold past 24 hours and
> `--color-danger` past 72, matching the overview.
>
> Per-row actions: `Approve` primary, `Reject` danger outline.
>
> **Reject takes a mandatory reason** (§0.3), in a dialog, and the line beneath it names
> where it lands: **The member sees this on their profile.** That is true per
> `Profile §6`, where a declined redemption renders its moderator note as a full-width
> sub-row, and it is why the reason cannot be optional.
>
> ### Fulfilment capture
>
> Where an item needs data, `Approve` opens a form first: size, address, chat colour, per
> the item's own requirements. **Approving without the data is not possible**, and the
> button names why: `Fill in the delivery details`.
>
> ### History
>
> A second table beneath: the handled ones with **who handled them** and when, plus the
> reason on rejections. Never removed.
>
> **Shell only:** the whole screen renders behind a gold banner:
> **This queue needs the redemptions table.** Nothing here loads or saves yet.

---

## 10. Giveaways *(shell only)*

> **Eyebrow:** `DRAWS` · **Title:** `Giveaways`
>
> **Create form:** title, prize, entry cost, cap per user, opens at, draws at.
>
> **Active giveaways:** one panel each showing the **published server seed hash** in mono
> with a copy button, the entry count, and a `Draw` button.
>
> **The draw control is the screen's one consequential action.** A §0.4 confirm:
> **Drawing reveals the server seed and cannot be undone.** Anybody will be able to
> recompute the winner from it. Requires the typed word `DRAW`.
>
> On completion the panel shows the winner and **the revealed seed**, both copyable, with
> a `Verify this draw` ghost link to `/verify`.
>
> **The rule rendered as UI:** beneath the create form, at 11px:
> **The hash is published when the giveaway opens and the seed is revealed at the draw, so
> anybody can recompute the winner.**
>
> **Past table:** prize, drawn date, entries, cost, winner, **and the revealed seed**. A
> row missing its seed renders as a `--color-danger-line` row with `NOT PUBLISHED`, exactly
> as the public table does (`Shop and Giveaways §10`). If it is wrong on the public site it
> should be visibly wrong here first.
>
> **Shell only:** gold banner. **This screen needs the giveaways table.**

---

## 11. Shop items *(shell only)*

> **Eyebrow:** `CATALOGUE` · **Title:** `Shop items`
>
> 44px rows: item, category, cost (gold, mono), stock, cooldown, status, plus an `Active`
> toggle per row.
>
> Create and edit forms: name, description, category, cost, stock, cooldown, active.
>
> **The rule that needs stating in the UI**, beneath the cost field at 11px:
> **Changing a price does not change what past redemptions recorded.** They keep the price
> they were redeemed at.
>
> Without that line an operator will assume a price change is retroactive, and the first
> time they find out otherwise will be during a dispute.
>
> **Description is limited to three lines' worth of characters**, with a live counter,
> because `Shop and Giveaways §3` clamps it to three lines and reserves the height. A
> description that gets silently truncated on the public site is authored blind here.
>
> **Shell only:** gold banner. **This screen needs the shop items table.**

---

## 12. Responsive

**Admin is a desktop tool and this document says so rather than pretending otherwise.**
It stays usable down to 768px and it is not designed for a phone.

| Region | ≥1024 | 768–1023 | <768 |
|---|---|---|---|
| Sidebar | 232px fixed | **56px icon rail**, labels on hover and in the title attribute | **Top bar with a drawer**, opened by a menu button |
| Content | Full width | Full width | Full width, 16px padding |
| Tables | Full columns | Full columns, horizontal scroll in their own container | Same, scroll in container |
| Clips form | `1fr 380px`, preview sticky | Stacked, preview above the form | Stacked |
| Member detail | In place beneath the row | In place | In place, figures stacked |
| Keno paytable | Scrolls in container | Scrolls | Scrolls |

**Rules that hold at every width.**

- **Every table scrolls inside its own container.** The page body never scrolls
  horizontally. Verify at 768px with the widest table, which is Razed players.
- **`min-width: 0` on every cell holding a username, an item name or a seed.**
- **Controls go to 44px under `(pointer: coarse)`** even though they are 36px on a desktop
  pointer, so a moderator handling a queue from a phone can still hit `Approve`.
- **No admin action is desktop-only.** A moderator approving redemptions from a phone at
  midnight is the realistic case, and it is the one this dashboard exists for.
- The sidebar drawer traps focus, closes on `Escape`, and returns focus to the menu
  button.

---

## 13. States to build

| State | Where | Behaviour |
|---|---|---|
| **Not an admin** | Every screen | Whole shell replaced by one panel. **No sidebar** (§0.6) |
| **No database** | Every screen | Danger panel **naming the actual variable** with a copy button (§0.5) |
| **Owner-only, seen by a moderator** | Freeze, kill switch, and their sidebar links | Rendered in full at 55%, `OWNER ONLY` gold pill, `Ask an owner to do this.` **Never hidden** |
| Loading | Every screen | Skeleton at final size, no layout jump |
| Empty table | Every screen | Empty state naming what makes a row appear |
| Feed down | Overview | **The actual error string**, mono, copyable. Never "an error occurred" |
| Redemption queue, no table | Overview | Panel renders with `Waiting on the redemptions table.` **Not hidden** |
| Queue item over 24h / 72h | Overview, Redemptions | Age turns gold, then danger |
| Board already open | Prizes | `Open board` disabled, **naming why** |
| Board not open | Prizes | Dates read-only, banner explaining it is the record |
| Moderator on a period | Prizes | Banner: tiers yes, freeze no. `Freeze` per §0.6 |
| **Overlapping ranks** | Prizes | Refused **naming the clash**, values kept |
| Fetch fails | Clips | Inline line, never a toast. Manual thumbnail offered |
| **Fourth pin attempted** | Clips | Refused with a message. **Never silently dropped** |
| Draft | Clips | Title muted **and** a `DRAFT` pill. Not on the public site |
| **Unlinked member** | Members | `NOT LINKED` gold pill. **Never an empty cell** |
| Reason empty | Members, Redemptions | Apply disabled, **button names the reason** |
| **Over the moderator cap** | Members | Refused inline, **values kept**, owner named |
| **Adjustment would go negative** | Members | Refused, **naming the resulting figure** |
| Razed player unmatched | Razed | `Invite` primary. The only primary in any table |
| **A page went unread** | Razed | Gold count line. **Never a clean "showing all"** |
| **Keno RTP drifts >0.5%** | Games | Calculated panel turns danger, **naming both figures** |
| Screen is display-only | Games, Redemptions, Giveaways, Shop | Gold banner naming the missing table. **No live-looking inputs** |
| Search not wired | Members, Audit | Input **disabled** with the reason stated |
| Audit log | Audit | **No delete control exists for anyone.** Not greyed, absent |

---

## 14. The self test

1. Screenshots of all ten screens at **1440×900 and 768px**, as owner and as moderator.
2. **The moderator pass, and it is the important one.** Sign in as a moderator and walk
   every screen. Every owner-only control must be **visible, greyed, labelled, and
   explained**. If anything is missing rather than greyed, that is the failure Requirements
   names.
3. **Force the not-an-admin state** and confirm the sidebar is gone, not just the content.
4. **Force the no-database state on every screen** and confirm each names its actual
   variable, not a shared generic message.
5. **The reason gate:** try to apply a coin adjustment with no reason, over the cap, and
   into a negative balance. All three refuse, all three name why, and **the entered values
   survive**.
6. **Confirm the adjustment reason lands on the ledger row**, then open that member's
   public profile and confirm the same reason renders there.
7. **Overlapping tiers**: add `8–12` over an existing `4–10` and confirm the message names
   the clash.
8. **Edit a keno paytable until the recomputed RTP drifts past 0.5%** and confirm the panel
   turns danger and names both figures.
9. **Try to pin a fourth clip** and confirm it is refused with a message.
10. **Publish and unpublish a clip** and confirm the public site changes accordingly, and
    that a draft appears nowhere public.
11. **Confirm the aspect field is editable** and that changing it changes the public
    `/clips` card's shape.
12. Razed players: confirm the username is **unmasked and copyable**, and that an unmatched
    row's action is `Invite`.
13. **Force an unread page** on the Razed feed and confirm the gold count line.
14. **Search the audit screen for any delete affordance.** There must be none, at any role.
15. Every table scrolled inside its container at 768px. **Body never scrolls sideways.**
16. Approve a redemption from a 375px viewport. Every control reachable at 44px.
17. Console clean. **No chart library loaded anywhere.**
18. **The fresh eyes pass.** Open the overview cold. Can you answer "is anything broken"
    and "does anything need me" in under five seconds without scrolling?

---

## 15. Build order

```
§0 shared patterns        six things, used by every screen after this
§1 the shell              sidebar, roles, the owner-only treatment
§2 overview               the two questions, and the restraint
§8 audit log              small, and it is the record everything else writes to
§5 members and coins      the reason field's real home, and the cap rules
§3 prizes and periods     the calculated pot and the overlap refusal
§4 clips                  the preview, and the aspect field the public site needs
§6 razed players          the unmasked column and the honest count
§7 games                  the recomputed RTP, behind its display-only banner
§9 §10 §11                the three shell-only screens, as shells with banners
```

**§0 first, and none of it is optional.** Six patterns appear on nearly every screen, and
building them per-screen is how the reason field ends up mandatory in one place and
optional in another.

**§1's owner-only treatment is part of the shell, not a per-control decision.** Build it
once as a wrapper. The moment it is a judgement call at each control, one of them will be
hidden instead of greyed.

**§8 the audit log comes early despite being small.** Every other screen writes to it, and
having the reading end finished makes every subsequent action verifiable while it is being
built rather than after.

**§5 before §3.** Members carries the mandatory reason, the moderator cap and the negative
balance guard, which are the three hardest refusals in the dashboard. Prizes reuses the
same refusal pattern for its overlap message, and inheriting a proven one beats inventing
a second.

**§9, §10 and §11 ship as shells with honest banners**, not as hidden links. A moderator
should be able to see that redemptions exist and that the table is not built yet. That is
the same principle as owner-only: show the shape of the system, and say who or what is
missing.
