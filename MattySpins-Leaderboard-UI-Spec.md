# MattySpins Leaderboard — Complete UI Specification

`/leaderboard` and `/leaderboard/claim`. Companion to
`MattySpins-LateNight-UI-Spec.md`, which holds the tokens (§1), the type scale (§2), the
light layer (§3), the motion system (§4) and the primitives (§5). **Read those five
first.** This document supersedes `Late Night` §20 and §21, which were summaries.

Content, data and behaviour come from `MattySpins-UI-Requirements.md` §3 Leaderboard and
Claim. Every rule in it survives.

**Routes:** `app/(site)/leaderboard/page.tsx`, `app/(site)/leaderboard/claim/page.tsx`,
`components/site/Leaderboard.tsx`, `components/site/ClaimFlow.tsx`. **Presentation
only.** `fetchRazedLeaderboard`, `healthFrom`, `toBoardRows`, `currentPeriod`,
`prizeForRank` and the server-side masking are untouched.

---

## The organising principle

The homepage asks you to feel something. The games ask you to trust them. **The board
asks you to believe a number about someone else.**

That is a harder thing to sell, and it is why this page carries more explanation than
any other page on the site. Requirements gives it a stale banner, a sync timestamp in a
fixed position, a provenance row, four paragraphs on how it works, and a base note about
who actually pays. **None of that is padding. It is the page.**

```
   WHO IS WINNING?   ─→  podium, rows          §4 §5
   HOW MUCH?         ─→  period strip, prizes  §3
   IS IT CURRENT?    ─→  sync stamp, stale     §1 §2
   WHERE IS IT FROM? ─→  provenance row        §6
   HOW DOES IT WORK? ─→  four paragraphs       §7
   WHO PAYS?         ─→  base note             §8
   DID I WIN?        ─→  frozen, claim         §10 §11
```

**The design job here is restraint.** A board that looks designed looks editable. This
page gets the light, the type and the podium falloff, and then it stops. No entrances on
rows, no counting numbers, no living elements below the podium. The homepage earns
attention; the board earns trust, and those want opposite amounts of motion.

---

## The three highest-value decisions

**1. The sync timestamp never disappears.** Requirements states it as a rule and it is
the page's single most important pixel. It lives in **one fixed slot** that always
renders something: `Updated 4 minutes ago`, or `Checking…`, or `Last checked 2 hours
ago`. It never blanks during a refresh, never collapses when the feed fails, and never
moves. A figure about money whose freshness vanishes while you look at it is worse than
no figure.

**2. An empty board and an unreachable feed must never look alike.** Requirements: never
render an empty board silently, say why. These are two different states with two
different panels (§2, §14). Rendering a failed fetch as an empty board silently tells
every viewer they are not on the leaderboard, and it is the worst failure this site can
produce.

**3. Frozen is a state the whole page enters, not a banner it wears.** When a period
closes and enters its 72 hour verification, **the light stops drifting**, the ranks lock,
the countdown becomes the word `Final`, and a gold band appears with `Claim a position`.
The page physically stops moving. That is the signature doing real work: the room is
still lit, but nothing in it is changing any more.

---

## A note on masked usernames

Requirements: **usernames are masked server-side and the browser never receives a full
one.** That is a privacy decision, and the design has to keep it from reading as evasion.

- **The mask is consistent and it is obvious.** `matt••••ns`, using `•` at
  `--color-faint`, never `***` and never a blurred sprite. A reader should be able to
  tell instantly that characters were removed on purpose rather than lost.
- **It is explained once, in the provenance row (§6)**, in one sentence, and never
  repeated as a tooltip on every row.
- **The claimer sees their own full name they typed**, not a mask, in the claim flow. The
  mask protects other people's identities on a public page; it is not a rule about the
  claimant's own input.
- **Never mask the rank, the wagered total or the prize.** Only the name. A board that
  hides its numbers is not a board.

---

## Screen inventory

1. Header, period chips, and the sync slot
2. The stale banner
3. The period strip
4. The podium
5. The board rows
6. The provenance row
7. How the board works
8. Last month's winner, and the base note
9. The archive tab
10. The frozen board
11. The claim flow
12. Responsive
13. The copy block
14. States to build
15. The self test
16. Build order

---

## 1. Header, period chips, and the sync slot

> Build the page header. **Sticky under the nav at 60px**, condensing on scroll, because
> a viewer reading rank 80 still needs to know which board they are looking at.
>
> ### At rest, before scroll
>
> - **Eyebrow**, `label` size, `--color-muted`, with the Razed Z mark:
>   `RAZED · CODE MATTY · ALL TIMES UTC`
> - **Heading** `Leaderboard` at `display-m`.
> - **Period chips**, right: `Weekly` · `Monthly` · `Archive`. Three, not two.
>   Requirements names Archive as a period chip and it belongs in the same control, not
>   as a separate link, because it answers the same question at a different time.
>   The active chip is a blue filled box with `--color-light-ink` text. The rest are
>   `--color-line-lit` outlines.
> - **The sync slot**, right, beneath the chips.
>
> ### The sync slot
>
> **One fixed 22px-tall slot, always occupied.** It is `min-width: 200px` and right
> aligned, so its contents can change without anything around it moving.
>
> | Condition | Renders | Colour |
> |---|---|---|
> | Fresh | `● Updated 4 minutes ago` | `--color-faint`, dot blue |
> | Refreshing | `● Checking…` | `--color-faint`, dot pulsing blue |
> | Stale | `● Last checked 2 hours ago` | `--color-gold`, dot gold |
> | Unreachable | `● Feed unreachable · last checked 2 hours ago` | `--color-danger` |
> | Frozen | `● Frozen 12 March, 23:59 UTC` | `--color-gold` |
>
> **It never renders nothing.** Not during a refresh, not during an error, not while the
> page is loading. On first load, before any data, it reads `● Checking…`. This is
> Requirements' rule that the timestamp never disappears during a refresh, and the way to
> guarantee it is a slot that has no empty case.
>
> 12px mono, tabular for the figures.
>
> ### On scroll past 140px
>
> The bar condenses to 52px: the eyebrow and heading collapse to `Leaderboard · Weekly`
> at 15px, and the chips and the sync slot stay. One transition, 240ms, `--ease-soft`,
> and it never happens twice.

---

## 2. The stale banner

> Build the stale banner. It sits **above the board**, full width, below the header, and
> it carries the real reason.
>
> Two variants, and they must not look alike:
>
> **Stale**, `--color-gold-line` hairline on `--color-gold-bg`, mark at 16px:
> **The board is behind.** Razed last answered 2 hours ago, so these positions may have
> moved. The figures below are the last ones we were given.
>
> **Unreachable**, `--color-danger-line` hairline on `--color-danger-bg`:
> **We can't reach Razed right now.** These positions are from 2 hours ago and nothing
> newer has arrived. Nothing here is lost; the board catches up when the feed does.
>
> **The reason is real, not generic.** Requirements: the banner carries the real reason.
> If the feed returned an error code, the banner says the feed answered with an error. If
> it timed out, it says it did not answer. `healthFrom(feed)` already knows which; the
> banner reads it rather than guessing.
>
> **Both keep the board visible beneath them.** The banner explains the board's age; it
> does not replace the board. A viewer with a two hour old rank still wants to see it.
>
> A `Retry` ghost link sits at the banner's right. It refetches and puts the sync slot
> into `Checking…` while it runs.
>
> **`role="status"`**, so it is announced when it appears rather than silently arriving.

---

## 3. The period strip

> Build the period strip. Three figures, and **not three equal boxes** — the same rule as
> the homepage strip and for the same reason.
>
> **Desktop:** a grid at `1fr 1fr 1.3fr`, hairline separated, 72px tall, baseline aligned.
>
> | Slot | Label | Figure |
> |---|---|---|
> | 1 | `PERIOD` | `6 – 12 March` at 15px mono `--color-ink-2` |
> | 2 | `CLOSES IN` | `Countdown` inline at `num-m`, or the word **`Final`** in gold when frozen |
> | 3 | `PRIZE POOL` | `num-l` in gold with its currency symbol |
>
> The prize pool is the dominant figure and it is why slot three is wider.
>
> **`Final` is a word, not a zeroed countdown.** A frozen board showing `00:00:00` reads
> as broken. Requirements asks for "Final" and it is the right call.
>
> **Prize figures carry a currency symbol. Coin figures never do.** Requirements §8:
> coins are not money, so `MC` is the unit for coins and a currency symbol is the unit for
> prizes, and the two are never interchanged anywhere on this page.
>
> **Mobile:** stacked, hairline separated, label left and figure right on one row each.

---

## 4. The podium

> Build the podium. Ranks 1 to 3, **the winner centred and raised.**
>
> **Grid `1fr 1.15fr 1fr`, bottom aligned**, rank one at 100% height and ranks two and
> three at 88%.
>
> ### The light falloff carries the ranking
>
> | Rank | `.lit` gradient | Hairline | Numeral |
> |---|---|---|---|
> | 1 | 100% | `--color-gold-line` | `--color-gold` |
> | 2 | 60% | `--color-silver` at 40% | `--color-silver` |
> | 3 | 25% | `--color-bronze` at 40% | `--color-bronze` |
>
> **The ranking reads before a single number does.** This is the same treatment as the
> homepage preview (`Home §4`), deliberately, so the preview and the full board are
> visibly the same object at two sizes.
>
> ### Each card
>
> - Rank numeral at `num-l` in the metal, top left.
> - Avatar at 56px.
> - **Masked username** at 18px Manrope 600, with the mask dots at `--color-faint`.
>   `min-width: 0` on this grid child, or a long unbroken handle pushes the whole page
>   sideways (Requirements §7).
> - Wagered at `num-m` in gold with its currency symbol, label `WAGERED` above at `label`
>   size.
> - Prize at `num-m` in gold, label `PRIZE` above.
> - Rank one additionally carries a slow gold bloom behind its numeral, 8 second cycle.
>   **It is the only living element on this page**, and it stops entirely when the board
>   is frozen.
>
> ### The accessibility rule that gets missed
>
> **DOM order is 1, 2, 3. The visual reorder is presentational.**
>
> Requirements states this explicitly. Build the three cards in rank order in the markup
> and use `order: 2 / 1 / 3` (or a grid column assignment) to place the winner in the
> middle. **Never reorder the source.** A screen reader user hearing second, first, third
> is being told the wrong thing about who won.
>
> **On mobile the visual order collapses back to 1, 2, 3 stacked**, which means the
> `order` rules only apply at 1024px and up, and the DOM was already correct.
>
> ### Fewer than three players
>
> Render only the ranks that exist. **Never a placeholder card**, never a card reading
> `—`. Two players make a two card podium.

---

## 5. The board rows

> Build the board from rank 4 down. Grid
> `56px 44px 1fr 72px auto auto`, 64px tall, hairline separated, **no zebra striping**
> (it fights the light and makes the board look like a spreadsheet).
>
> | Column | Content |
> |---|---|
> | Rank | `num-m` in `--color-muted` |
> | Avatar | 36px |
> | Name | Masked, 15px Manrope 600, `min-width: 0`, truncated |
> | **Movement** | see below |
> | Wagered | `num-s` gold, right aligned, tabular |
> | Prize | `num-s` gold, right aligned, tabular |
>
> ### Movement, and colour is never the only signal
>
> Requirements adds a movement column and Requirements §7 says colour is never the only
> signal. So movement is **a glyph, a number and a colour**, all three:
>
> - Up: `▲ 3` in blue
> - Down: `▼ 2` in `--color-muted`
> - No change: `—` in `--color-faint`
> - New entry: `NEW` at 10px mono in a blue outlined pill
>
> Mono, tabular, fixed width so the column does not jitter between rows. **In greyscale
> the glyph still carries it**, which is the test.
>
> When the feed gives no previous position, the column renders `—`, never `▲ 0`.
>
> ### Show more
>
> Requirements: collapsed to a few rows with a show more control.
>
> Render **ten rows** (ranks 4 to 13), then a full width ghost button:
> `Show all 84 positions`. It expands in place with no scroll jump: measure, set an
> explicit height, transition it over 320ms `--ease-soft`, then release to `auto`.
>
> Once expanded it becomes `Show fewer`. The state is not remembered across navigations.
>
> ### The you row
>
> If the signed in viewer is on the board, their row takes **a 2px blue left border
> and a `YOU` pill**, and nothing else changes. Highlighting it further makes the board
> look like it is about the viewer, and it is not.
>
> **A pinned strip** at the bottom of the viewport carries the same row while the real one
> is off screen: `.lit`, blue hairline, full width, 56px, with rank, masked name,
> wagered and prize. When the real row scrolls into view the pinned strip fades out over
> 200ms. **Never both at once.**
>
> **Signed in and not on the board**, the pinned strip reads their own wagered total and
> the gap: `£420 more this week to reach rank 50`. **If the gap cannot be computed it
> reads the instruction instead**, never a guess:
> `Wager on Razed under code MATTY to appear here`.
>
> **Signed out**, there is no pinned strip. An empty strip inviting a sign in on a page
> about other people's money is nagging.
>
> ### Motion
>
> **Rows do not animate in.** No entrance, no stagger, no counting. Hover brightens the
> row background by 4% and moves nothing. A board row that lifts on hover makes scanning
> eighty rows feel seasick.

---

## 6. The provenance row

Requirements gives this its own numbered section, separate from the sync timestamp, and
it is right to: the timestamp says *when*, this says *where from* and *why it looks like
this*.

> Build the provenance row directly beneath the board. Full width, hairline top, 20px
> vertical padding, 12px mono `--color-faint`, capped at `88ch`.
>
> Three sentences, one line each on desktop and wrapped on mobile:
>
> **Positions come straight from Razed for accounts registered under the code MATTY.**
> **Usernames are shortened before they reach your browser, so nobody's full Razed name is
> published here.**
> **Wagered totals are Razed's own figures. All times UTC.**
>
> That second sentence is the **one place the mask is explained** (see the note near the
> top of this document). It is not a tooltip, it is not repeated per row, and it is not
> omitted.
>
> **This row renders in every state**, including the empty board and the unreachable feed.
> Where the figures came from is exactly as relevant when there are none.

---

## 7. How the board works

> Build the explanation block. Four paragraphs, and it is the plainest thing on the page.
>
> **A two column grid on desktop** at `1fr 1fr`, 32px gap, so four paragraphs do not
> become a wall. Each has a `label` size heading above it and body at 15px
> `--color-ink-2` capped at `56ch` **on the paragraph**.
>
> **`QUALIFYING`**
> Sign up to Razed under the code MATTY and wager as you normally would. Positions appear
> once you pass the minimum wager for the period. There is nothing to link and nothing to
> claim until the period closes.
>
> **`TIES`**
> If two people finish on the same amount, the one who got there first wins, by Razed's
> own timestamps. We do not break ties ourselves.
>
> **`FREEZING`**
> The board closes at the end of the period in UTC, then spends 72 hours being verified
> before anything is paid. Positions cannot move during those 72 hours.
>
> **`CLAIMING`**
> Once a board is frozen you state your Razed username and a moderator checks it against
> the position. Prizes that go unclaimed for 14 days roll into the next pot.
>
> **No light on this block.** It sits on flat `--color-canvas` with a hairline above and
> below. Every other block on this page is lit; this one is the reference material and it
> should read like it.

---

## 8. Last month's winner, and the base note

> **Last month's winner** is one lit card, `--color-gold-line` hairline, sitting after the
> explanation block.
>
> Grid `auto 1fr auto`: avatar at 48px, then the masked username at 18px with
> `LAST MONTH'S WINNER` at `label` size above it, then the prize at `num-m` gold and the
> wagered total at 13px mono beneath. A ghost link at the right: `See that board` into the
> archive.
>
> **Absent entirely when there is no closed monthly period.** No placeholder, no `—` card.
>
> **The base note** closes the page. Full width, 12px `--color-faint`, centred, 24px above
> the footer, capped at `72ch`:
>
> **Prizes are funded and paid by Matty personally. Razed provides the wagering figures
> and nothing else.**
>
> Requirements asks for this and it is the single most important sentence on the page from
> a legal standpoint. It is set at real contrast, 4.5:1, not styled to be skipped.

---

## 9. The archive tab

> Build the archive as **a different skeleton to the board**, so the two never blur
> together. The board is a podium and rows; the archive is a plain table.
>
> Selected by the `Archive` chip in the header (§1). It replaces the period strip, the
> podium, the board and the explanation block. **The header, the provenance row and the
> base note stay.**
>
> **A mono table**, columns: period, winner (masked), wagered, pot, and a `View board`
> ghost link per row. Header row at `label` size with a hairline beneath. Rows 56px,
> hairline separated, newest first.
>
> - Period at 14px mono `--color-ink-2`.
> - Winner masked, 14px Manrope 600.
> - Wagered and pot at `num-s` gold, right aligned, tabular.
> - `View board` opens that frozen board, read only.
>
> **Nothing is ever removed from the archive.** Requirements states it, and it is worth a
> line in the table's footer at 12px `--color-faint`:
> **Every closed board stays here. Nothing is removed.**
>
> **Empty archive:** a plain empty state, no card, no illustration:
> **No boards have closed yet.** The first one appears here when the current period ends.
>
> **The table scrolls inside its own container on mobile**, with masked edges, and the
> page body never scrolls sideways (Requirements §7).

---

## 10. The frozen board

The page's most designed state, and the one that matters most, because it is when money
is decided.

> Build the frozen state. **The whole page enters it.** It is not a banner worn over a
> live board.
>
> 1. **The light stops drifting.** The room stays lit; nothing in it moves any more. The
>    rank one bloom (§4) stops too. This is the signature doing real work and it is felt
>    before any text is read.
> 2. **The countdown becomes the word `Final`** in gold (§3). Not `00:00:00`.
> 3. **A gold band** sits above the podium, full width, `--color-gold-line` on
>    `--color-gold-bg`, 72px:
>    - Left: **This board is frozen.** Positions are locked while they are verified. That
>      takes up to 72 hours.
>    - Right: a primary button, `Claim a position`, to `/leaderboard/claim`.
> 4. **Ranks lock.** The movement column renders `—` for every row, because nothing can
>    move any more, and a stale `▲ 3` on a frozen board is a lie.
> 5. **The sync slot** reads `● Frozen 12 March, 23:59 UTC` in gold.
>
> **Frozen must never be mistakable for stale.** Stale is gold too, so the difference has
> to be structural rather than chromatic: frozen removes the countdown and adds a button;
> stale keeps the countdown running and adds a retry link. Check the two side by side.
>
> **`aria-live="polite"`** on the band, and the word `frozen` is in the text, because
> Requirements §7 says colour is never the only signal and a frozen board also says
> "frozen".

---

## 11. The claim flow

`/leaderboard/claim` · `components/site/ClaimFlow.tsx`

> Build the claim flow. **It is a money screen, so it is the second plainest page on the
> site after `/verify`.** Display face appears once, in the heading, and nowhere else. No
> light drift. No living elements. No entrances beyond a single fade between steps.
>
> **Motion on a money form reads as instability**, and this is the form where someone
> tells us who they are in order to be paid.
>
> **A single centred column at `560px`**, with a back link at the top:
> `Back to the board`, ghost, with a leading arrow.
>
> **Eyebrow** naming the frozen period: `WEEKLY BOARD · 6 – 12 MARCH · FROZEN`
> **Heading** `Claim your position` at `display-m`.
>
> **The paragraph that has to be there**, at 15px `--color-ink-2`, capped at `54ch`:
> **Positions on the board are Razed usernames, not accounts on this site.** That means
> nothing is paid automatically. Tell us which position is yours and which Razed username
> it belongs to, and a moderator checks it before anything is sent.
>
> ### A step rail, not a wizard chrome
>
> Four steps, shown as a thin horizontal rail above the form: four segments, the completed
> ones blue, the current one blue with a 2px underline, the rest `--color-line`.
> Labels at 11px mono beneath: `POSITION`, `USERNAME`, `CONFIRM`, `DONE`.
>
> It is a progress indicator, not navigation. Completed steps are clickable to go back;
> future steps are not.
>
> ### Step 1 — Pick your position
>
> The frozen board's **paying ranks only**, as selectable rows. Grid
> `56px 44px 1fr auto`: rank numeral, avatar, masked username, prize in gold.
>
> - Radio semantics: a `role="radiogroup"` with arrow key navigation, not a list of
>   divs with click handlers.
> - Selected: `--color-light-line` 2px border, `--color-light-bg` fill.
> - **Already claimed by someone else:** the row renders at 55% opacity with a
>   `CLAIMED` pill and is not selectable. It stays visible. Removing it makes the ranking
>   look wrong and invites the question of what happened to rank 4.
>
> ### Step 2 — State your Razed username
>
> One field, full width, 48px, mono, `--color-line-lit` border, label above at `label`
> size: `YOUR RAZED USERNAME`.
>
> **The warning sits above the field, not below it**, at 13px in `--color-gold`:
> **It has to match your Razed username exactly.** A different spelling is a different
> account and the claim will not pass the check.
>
> The claimant sees **their own full typed username**, never masked. The mask protects
> other people on a public board; it is not a rule about your own input.
>
> Inline validation is on blur, never on keystroke. An error under the field at 13px
> `--color-danger`, and the field border turns `--color-danger-line`.
>
> ### Step 3 — Confirm
>
> A summary block, hairline separated rows: the period, the rank, the prize in gold, and
> the Razed username typed. Then one sentence:
> **A moderator checks this against Razed before anything is paid. You'll get a reference
> number on the next screen.**
>
> Primary button, full width: `Submit claim`. A ghost link beneath: `Change something`.
>
> **No default focus on the submit button.** This is the last reversible moment.
>
> ### Step 4 — Submitted
>
> - The reference number at `num-m` mono in gold, with a `CopyButton`, label above:
>   `YOUR REFERENCE`.
> - Status pill: `PENDING CHECK` in a gold outlined pill.
> - **What happens next**, three numbered lines at 14px:
>   1. A moderator checks the username against Razed's figures.
>   2. You'll be messaged on Discord when it clears.
>   3. Unclaimed prizes roll into the next pot after 14 days.
> - A ghost link: `Back to the board`.
>
> ### The states that are not the happy path
>
> - **No frozen board:** the whole flow is replaced by one centred panel.
>   **There's no frozen board to claim from right now.** Claims open when a period closes,
>   and the board says when the current one does. Ghost link back.
> - **Signed out:** the flow renders through to step 3 and the submit button reads
>   `Sign in to submit`. **Do not gate the form behind auth at step 1** — someone should
>   be able to see that their position is claimable before being asked to sign in.
> - **Already claimed by someone else, discovered at submit:** an inline
>   `--color-danger-line` panel above the button, not a redirect and not a toast:
>   **That position already has a claim against it.** If you think it is yours, message a
>   moderator in Discord with your Razed username.
> - **Already claimed by you:** step 4 renders directly with the existing reference and
>   status. A second claim is never opened.

---

## 12. Responsive

**Two breakpoints only: below 768px, and 1024px and up.** Requirements §7 sets this, and
this document follows it rather than inventing a third tier.

| Section | ≥1024 | <768 |
|---|---|---|
| Header | Sticky 60px → 52px, chips and sync right | Heading, then chips scrolling horizontally, sync beneath |
| Stale banner | Full width, retry right | Stacked, retry full width |
| Period strip | `1fr 1fr 1.3fr` | Stacked rows, label left, figure right |
| Podium | 3 across, winner centred and raised, `order` applied | **Stacked 1, 2, 3**, no `order` |
| Rows | Full grid with movement | Movement moves under the name as a 12px line; wagered and prize stack right |
| You strip | Pinned bottom | Pinned above the tab bar |
| How it works | 2 columns | 1 column |
| Archive | Full table | Table scrolls inside its container |
| Claim | 560px centred | Full width, step rail labels drop to icons + current label |

**Phone specifics.**

- **`min-width: 0` on every grid child that holds a username.** Requirements §7 names this
  exactly: grid children holding long unbreakable strings refuse to shrink and push the
  whole page sideways. It is the most likely cause of a horizontal scroll on this page.
- **The page body never scrolls horizontally.** The archive table and the chip row scroll
  inside their own containers. Verify at 375px.
- The podium's `order` rules are scoped to `@media (min-width: 1024px)` only, so the
  stacked mobile order is the DOM order and no override is needed.
- Every control at least 44px under `(pointer: coarse)`.
- Body padding reserves the tab bar and the pinned you strip.

---

## 13. The copy block

Every viewer facing line, verbatim.

```
HEADER
eyebrow    RAZED · CODE MATTY · ALL TIMES UTC
title      Leaderboard
chips      Weekly · Monthly · Archive

SYNC SLOT
fresh      Updated 4 minutes ago
checking   Checking…
stale      Last checked 2 hours ago
error      Feed unreachable · last checked 2 hours ago
frozen     Frozen 12 March, 23:59 UTC

STALE BANNER
stale      The board is behind. Razed last answered 2 hours ago, so these
           positions may have moved. The figures below are the last ones we
           were given.
error      We can't reach Razed right now. These positions are from 2 hours ago
           and nothing newer has arrived. Nothing here is lost; the board
           catches up when the feed does.
action     Retry

PERIOD STRIP
labels     PERIOD · CLOSES IN · PRIZE POOL
frozen     Final

BOARD
labels     WAGERED · PRIZE
movement   ▲ 3 · ▼ 2 · — · NEW
you        YOU
more       Show all 84 positions / Show fewer
gap        £420 more this week to reach rank 50
no gap     Wager on Razed under code MATTY to appear here

EMPTY
           No board is open.
           A period has to be opened before positions appear here. The last one
           closed on 12 March and its board is in the archive.

PROVENANCE
           Positions come straight from Razed for accounts registered under the
           code MATTY.
           Usernames are shortened before they reach your browser, so nobody's
           full Razed name is published here.
           Wagered totals are Razed's own figures. All times UTC.

HOW THE BOARD WORKS
QUALIFYING Sign up to Razed under the code MATTY and wager as you normally
           would. Positions appear once you pass the minimum wager for the
           period. There is nothing to link and nothing to claim until the
           period closes.
TIES       If two people finish on the same amount, the one who got there first
           wins, by Razed's own timestamps. We do not break ties ourselves.
FREEZING   The board closes at the end of the period in UTC, then spends 72
           hours being verified before anything is paid. Positions cannot move
           during those 72 hours.
CLAIMING   Once a board is frozen you state your Razed username and a moderator
           checks it against the position. Prizes that go unclaimed for 14 days
           roll into the next pot.

LAST MONTH
label      LAST MONTH'S WINNER
link       See that board

BASE NOTE
           Prizes are funded and paid by Matty personally. Razed provides the
           wagering figures and nothing else.

ARCHIVE
footer     Every closed board stays here. Nothing is removed.
empty      No boards have closed yet. The first one appears here when the
           current period ends.
link       View board

FROZEN BAND
           This board is frozen. Positions are locked while they are verified.
           That takes up to 72 hours.
button     Claim a position

CLAIM
back       Back to the board
eyebrow    WEEKLY BOARD · 6 – 12 MARCH · FROZEN
title      Claim your position
lede       Positions on the board are Razed usernames, not accounts on this
           site. That means nothing is paid automatically. Tell us which
           position is yours and which Razed username it belongs to, and a
           moderator checks it before anything is sent.
steps      POSITION · USERNAME · CONFIRM · DONE
field      YOUR RAZED USERNAME
warning    It has to match your Razed username exactly. A different spelling is
           a different account and the claim will not pass the check.
confirm    A moderator checks this against Razed before anything is paid.
           You'll get a reference number on the next screen.
buttons    Submit claim · Change something · Sign in to submit
ref        YOUR REFERENCE
status     PENDING CHECK
next       1. A moderator checks the username against Razed's figures.
           2. You'll be messaged on Discord when it clears.
           3. Unclaimed prizes roll into the next pot after 14 days.
none       There's no frozen board to claim from right now. Claims open when a
           period closes, and the board says when the current one does.
taken      That position already has a claim against it. If you think it is
           yours, message a moderator in Discord with your Razed username.
```

**Copy gate:** zero em dashes, zero stock words, run before this page is shown to anyone.
The `–` in `6 – 12 March` is an en dash in a date range and is fine. The `…` in
`Checking…` is an ellipsis and is fine.

**Requirements §8 checks specific to this page:**
- **Never a currency symbol on a coin figure.** Prizes and wagered totals carry a currency
  symbol; nothing on this page is denominated in MC.
- **Say what a thing is, not how it feels.** `Feed unreachable`, never `Oops, something
  went wrong`.

---

## 14. States to build

| State | Where | Behaviour |
|---|---|---|
| Loading, first paint | Whole page | **Skeleton at the final size**, no layout jump. Sync slot reads `Checking…` |
| No period open | Whole board | Empty panel naming why, and that the last board is in the archive. **Never a silent empty board** |
| Open and healthy | Whole page | Sync slot fresh, no banner, countdown running |
| **Stale** | Banner + sync slot | Gold banner with the **real reason**, board still visible beneath, retry link |
| **Unreachable** | Banner + sync slot | Danger banner, **last known figures still shown**, retry link |
| Refreshing | Sync slot | `Checking…` with a pulsing dot. **The timestamp never disappears** |
| **Frozen** | Whole page | Light stops, countdown becomes `Final`, gold band, ranks locked, movement all `—` |
| Fewer than 3 players | Podium | Only the ranks that exist. **No placeholder cards** |
| No previous position | Movement | `—`, never `▲ 0` |
| Viewer on the board | Rows + pinned strip | Blue left border and `YOU` pill. Pinned strip until the real row is visible, **never both** |
| Viewer not on the board | Pinned strip | Their total and the gap, **or** the instruction if the gap is unknown. Never a guess |
| Signed out | Pinned strip | Absent. Board fully visible |
| Rows collapsed | Board | Ten rows plus `Show all 84 positions` |
| Rows expanded | Board | Expands in place, **no scroll jump** |
| Long unbroken username | Podium + rows | Truncates. `min-width: 0` on the grid child. **Page never scrolls sideways** |
| Archive empty | Archive tab | Plain empty state naming when the first entry appears |
| Claim, no frozen board | Claim | Single panel, ghost link back |
| Claim, signed out | Claim | Flow visible through step 3, button reads `Sign in to submit` |
| Claim, rank taken | Step 1 | Row at 55% with a `CLAIMED` pill, **still visible**, not selectable |
| Claim, taken at submit | Step 3 | Inline danger panel above the button. **No redirect, no toast** |
| Claim, already claimed by you | Claim | Step 4 directly, existing reference and status |
| Claim, username mismatch | Step 2 | Inline error on blur, never on keystroke |
| No database | Whole page | Degrades to the empty board state with the provenance row intact |

---

## 15. The self test

1. Screenshots at **1440×900, 1280×800, 375×812**, in healthy, stale, unreachable, frozen
   and empty states.
2. **Force a refresh and watch the sync slot.** It must never be empty for a single
   frame. This is the page's headline rule and it is the easiest one to break.
3. **Put stale and frozen side by side.** Both are gold. Confirm they are structurally
   distinguishable, not just by wording.
4. **Kill the feed and confirm the board does not render empty.** The last known figures
   stay, the banner explains, the retry works.
5. **Screen reader pass on the podium.** Confirm it announces first, second, third. The
   `order` reorder is the thing to catch here.
6. **Greyscale pass on the movement column.** The glyphs must carry it with no colour.
7. **375px with the longest username in the data**, and one deliberately absurd unbroken
   string. The page body must not scroll sideways.
8. Expand and collapse the rows and confirm **no scroll jump** either way.
9. The you strip: on the board, off the board with a computable gap, off the board with
   no gap, signed out. Confirm the pinned strip and the real row are never both visible.
10. The archive at empty, one row, and fifty rows.
11. **The full claim flow, four ways:** happy path, signed out, rank taken at step 1, rank
    taken at submit.
12. Reduced motion on, then flipped mid session. The frozen board should look almost
    identical either way, which is a good sign.
13. Contrast measured on the gold on `--color-gold-bg` banner text and the base note.
14. Console clean at both breakpoints.
15. **The fresh eyes pass.** Would someone who has never seen this board believe the
    numbers? Can they find out where they came from without asking?

---

## 16. Build order

```
§1 header + sync slot     the page's most important pixel, and everything sits under it
§3 period strip           cheap, and it proves the frozen "Final" swap early
§4 podium                 the light falloff, and the DOM order rule
§5 rows + movement        the bulk of the page
§2 stale banner           needs the board beneath it to be right
§6 provenance row         one block, renders in every state
§10 frozen                the whole-page state, once the pieces it changes exist
§7 how it works           plain text, no dependencies
§8 last month + base note
§9 archive                a different skeleton, built last of the board pieces
§11 claim flow            its own route, after the frozen state it depends on
```

**The sync slot comes first, before any board.** It is the rule most likely to be broken
by a later refactor, and building it as a slot with no empty case from the start is much
cheaper than retrofitting that guarantee.

**§10 frozen comes after §1 to §6, not at the end.** It changes the light, the countdown,
the movement column and the header, so it cannot be built until those exist, but it must
not be left until after the claim flow, because the claim flow is only reachable from it.

**§9 archive is built last of the board pieces on purpose.** It is a plain table and it
is the one section with no dependency on anything above it, which makes it the safest
thing to cut if the wave runs long.
