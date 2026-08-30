# MattySpins — UI Requirements

What every page contains, section by section. No colour, no styling — this
describes **content, structure, behaviour and state**, so the visual design is
yours to make.

Written against the code as it stands, not the original plan. Where a screen is
half-built or reading placeholder data, it says so.

**How each page is described**

- **Answers** — the one question a visitor arrives with
- **Contains** — every section, in order, with every element in it
- **Data** — where each figure comes from
- **States** — every state that must be designed, not just the happy one
- **Rules** — things that must stay true however it is styled
- **Status** — `built` · `built, gaps` · `shell only` · `not built`

---

## Contents

1. [Principles](#1-principles)
2. [Global chrome](#2-global-chrome)
3. [Public pages](#3-public-pages)
4. [Games](#4-games)
5. [Admin dashboard](#5-admin-dashboard)
6. [States every page must handle](#6-states-every-page-must-handle)
7. [Accessibility and responsive](#7-accessibility-and-responsive)
8. [Copy rules](#8-copy-rules)
9. [Status summary](#9-status-summary)

---

## 1. Principles

Five rules that survive any restyle.

**1. Every number in a column is monospaced with tabular figures.** Money,
coins, wagered totals, multipliers, countdowns, ranks. Proportional digits do
not line up in a column and read as amateur.

**2. Derived figures are computed, never stored or typed.** A multiplier comes
from bet and payout. A prize pool comes from summing the tiers. A win chance
comes from the target. If a number can be derived from two others on screen,
derive it — then the three can never disagree. Anywhere a derived figure is
shown, label it *calculated* and give it no input.

**3. Nothing is invented.** A figure we do not have renders as an em dash, never
a zero. `0` is a claim; `—` is an admission. There is a `maybe()` helper for
exactly this. This applies to viewer counts, prize pools, member counts,
everything.

**4. Provenance travels with money.** Any figure about money says where it came
from and when it was last checked. The leaderboard's sync timestamp is not
decoration — it is the page's credibility.

**5. Losing is stated plainly.** Losing tiers appear in paytables as `0×` rather
than being omitted. A lost round says so. Nothing is softened.

---

## 2. Global chrome

### Top navigation

**Contains**
- Wordmark, links to home
- Primary links: Giveaways · Leaderboard · Shop · Community · Games
- Live badge — "Live now" or "Offline"
- Right side: **Sign in with Discord**, or when signed in: avatar, username,
  coin balance, and a menu with Profile / Admin (admins only) / Sign out

**States**
- Signed out · signed in · signed in as admin
- Live · offline
- Self-excluded — the Games link is removed entirely
- Mobile — collapses to a hamburger

**Rules**
- Games is visible to everyone. It disappears **only** on self-exclusion
- The live badge reflects real stream state. Never hardcode it
- Admin is never linked for non-admins

### Bottom tab bar (mobile only)

Four items: Home · Board · Shop · Me. Fixed to the bottom, roughly 62px tall.
Page content needs bottom padding so nothing hides behind it.

### Footer

Four columns plus a base row.

- **The site** — Home, Leaderboard, Games, Shop, Giveaways, Clips, Wall of fame
- **Trust** — How fairness works, Verify a round, Official accounts, Casinos
- **Legal** — Terms, Privacy, Giveaway rules, Responsible play
- **Community** — Discord invite, Kick, YouTube, Instagram, X
- **Base row** — 18+ notice, affiliate disclosure, the line stating coins cannot
  be bought and have no cash value, a helpline reference

### Age gate

A full-screen block before anything else renders, remembered per browser.

**Contains** — the wordmark; a heading stating the site is for over-18s; a
paragraph naming that the site covers casino streaming and carries an affiliate
link to Razed, and that gambling with real money carries real risk; a second
paragraph stating Matty Coins are earned by watching, cannot be bought, hold no
cash value and are not a wager; two buttons — "I am 18 or over — continue" and
"I am under 18 — leave".

### Coin bar

A strip shown above coin-spending pages (shop, giveaways).

**Contains** — coin mark and balance; current earning multiplier and its reason
(Member / Sub / VIP); earning state.

**States**
- Signed out → "Sign in to start earning"
- Signed in, no Kick link → "Link your Kick account to start earning"
- Linked, stream offline → "Earning paused — stream offline"
- Linked, live → "Earning N MC every 3 minutes"

---

## 3. Public pages

### Home — `/` · built, gaps

**Answers:** what is this, is he live, and why would I sign up?

**Contains, in order**

1. **Hero**
   - Live: a "Live on Kick" tag, viewer count *if known*, headline, one-paragraph
     pitch, "Watch live" and "See board" buttons, and an earning-status card
   - Offline: an "Offline" tag, the same headline, and a schedule strip of
     upcoming stream days instead of the earning card
   - Right side: the stream player — live embed, or last VOD thumbnail with a
     "Watch last stream" label. Below it the stream title and uptime, or "Last
     stream"
2. **Stat strip** — four figures: weekly prize pool · board resets in
   (countdown) · members earning · paid out to date
3. **Weekly board preview** — eyebrow naming the referral code, heading, weekly
   and monthly chips, podium for ranks 1–3, rows 4–6, a sync timestamp, and a
   link to the full board
4. **How coins work** — three rules as figure + unit + explanation: 1 MC every 3
   minutes · +10 MC for a full hour · 2× for subs (2.5× VIP, never stacking).
   Below: the line that coins cannot be bought and have no cash value
5. **Clips** — heading, source filter chips, horizontal carousel
6. **Biggest wins** — heading, sort chips, one featured win and two compact ones,
   link to the wall of fame
7. **About Matty** — portrait and four paragraphs in his voice
8. **Socials** — one row of platform links
9. **Discord call to action**

**Data** — stream from the live-stream session; clips and big wins from the
clips table; board live from Razed; the four stat figures are **still
placeholder and render as em dashes**.

**States** — live/offline · signed out/in/in-without-Kick · no clips (section
absent entirely) · no big wins (section absent) · no open period (preview says
no board, countdown shows an em dash).

**Gaps** — the four stat figures need real sources: pot from the open period,
members from the accounts table, paid out from finalised claims.

### Leaderboard — `/leaderboard` · built

**Answers:** who is winning, how much, and can I trust it?

**Contains**

1. **Header** — eyebrow naming Razed, the referral code and that all times are
   UTC; heading; period chips (Weekly · Monthly · Archive); a sync timestamp in
   a fixed position
2. **Stale banner** — when the feed is behind or unavailable, above the board,
   carrying the real reason
3. **Period strip** — three figures: date range · closes in (countdown, or
   "Final") · prize pool
4. **Podium** — ranks 1–3, the winner centred and raised. Each shows rank,
   masked username, wagered total, prize. On mobile the DOM order is 1, 2, 3 and
   the visual reorder is presentational, so a screen reader gets the right order
5. **Board rows** — from rank 4: rank, masked username, movement, wagered, prize.
   Collapsed to a few rows with a "show more" control
6. **Provenance row** — restates where the figures came from and when
7. **How the board works** — four paragraphs: qualifying (sign up under the
   code, minimum wager), ties (earliest to reach the amount wins, by Razed's
   timestamps), freezing (closes in UTC, then verifying for 72 hours), claiming
   (state your Razed username, a moderator checks it, unclaimed prizes roll over
   after 14 days)
8. **Last month's winner** — the winner, the prize, the wagered total, and a link
   into the archive
9. **Base note** — prizes are funded and paid by Matty personally, not by Razed

**Archive tab** — a table of closed periods: period, winner, wagered, pot, and a
link to that frozen board. Nothing is ever removed from it.

**States** — no period open ("No board is open", explains a period must be set
in admin) · open and healthy · stale or failing · frozen (banner, locked ranks,
"Claim a position") · archive empty.

**Rules**
- Usernames are masked server-side; the browser never receives a full one
- The sync timestamp never disappears during a refresh
- Never render an empty board silently — say why

### Claim a prize — `/leaderboard/claim` · built

**Answers:** I think I won — how do I get paid?

**Contains** — back link; eyebrow naming the frozen period; heading; a paragraph
explaining positions are Razed usernames rather than site accounts, so nothing
is paid automatically; then the flow:

1. **Pick your position** — the frozen board's paying ranks, selectable
2. **State your Razed username** — a single field, with a warning that it must
   match exactly
3. **Confirm** — a summary and a reference number
4. **Submitted** — reference, status, and what happens next

**States** — no frozen board · signed out · each step · submitted · already
claimed by someone else.

### Wall of fame — `/wins` · built

**Answers:** what are the biggest wins ever?

**Contains** — eyebrow, heading, sort chips (by multiplier · by win · by date);
two record cards (biggest multiplier ever, biggest win ever); a month filter
chip row when more than one month exists; a grid of win cards; a closing note
that every multiplier is calculated from the bet and payout beside it.

Each **win card**: thumbnail with a play control, the multiplier overlaid, the
source, bet, win, multiplier, the title, and the date.

**States** — empty (record cards absent entirely, an empty state explains wins
are added from admin) · one month only (no month filter) · a single win.

### Clips — `/clips` · built

**Answers:** what has he posted?

**Contains** — a count of published clips, heading, source filter chips (All ·
Kick · YouTube · Instagram · X), and a grid of clip cards each with thumbnail,
play control, title, source, duration and date.

**Rules** — nothing embeds until clicked; the thumbnail is replaced in place.
Aspect ratio is a data field, so vertical reels are not letterboxed into a
horizontal box.

**States** — empty overall · empty for the selected source (offer to clear the
filter).

### Shop — `/shop` · shell only

**Answers:** what can I spend coins on?

**Contains** — heading; the coin bar; category chips (Entries · Discord · Merch ·
Stream); a grid of item cards; a closing note that coins cannot be bought.

Each **item card**: name, description, cost with coin mark, stock if limited,
cooldown if any, and a redeem button.

**States per item** — affordable · not affordable (shows the shortfall) · out of
stock · on cooldown (with time remaining) · already pending · signed out.

**Status** — renders the catalogue but **nothing can be redeemed**. Needs shop
and redemption tables, a redeem action with a confirmation step, and a success
state that points at the profile.

### Giveaways — `/giveaways` · shell only

**Answers:** what can I enter, and is the draw fair?

**Contains** — eyebrow stating entries cost coins and draws are provably fair;
heading; the coin bar; **active giveaways** as cards (title, prize, entry cost,
your entries, total entries, cap per person, closes-in countdown, published
server seed hash, an enter control); **past giveaways** as a table (prize, drawn,
entries, cost, winner) with the revealed seed so anyone can recompute the draw.

**States** — none running · running · you have entries · at your cap · not
enough coins · signed out · drawn.

**Status** — shell only, same as the shop.

### Profile — `/me` · built

**Answers:** what do I have, what have I earned, and what are my settings?

**Contains**

1. **Header card** — avatar, username, tier badge, member-since, Kick username
   if linked, multiplier tags, and a balance panel with the balance, the line
   that coins are earned by watching and cannot be bought or withdrawn, and a
   link to the shop
2. **Stat tiles** — lifetime earned · earned this week · coins spent · net from
   games today
3. **Quick settings** — Discord (signed in as, sign out) · Kick account
   (verified as, or "Not linked — coins are blocked") · pending redemptions ·
   games on/off
4. **Prize claims** — an open claim with its reference, period, rank, amount and
   status, or an empty state
5. **Coin history** — the ledger: date, reason, delta, running balance. Watch
   ticks are grouped by session rather than listed as forty three-minute rows,
   expanding on click
6. **Redemptions** — each with item, cost, date, status and any moderator note
7. **Play settings** — session reminder interval; what you will see (played,
   wagered, net); today so far; and turning games off for a day, a week, a month
   or permanently
8. **Account** — the Kick verification card, and account deletion

**Account deletion** must state exactly what goes (Discord link, Kick link, coin
balance — permanently and immediately) and what stays (ledger rows anonymised,
because they are the accounting record; giveaways already won; claims already
paid), and that coins have no cash value and deleting forfeits the balance.

**Rules**
- No deposit and no withdraw, anywhere, ever
- Self-exclusion must be reachable on **every** viewport. It was desktop-only
  once — that is a responsible-gambling failure, not a layout bug

### Kick verification card

Four states in one card, on the profile.

1. **Unlinked** — explains that coins are earned for being in Kick chat so the
   site needs to know which Kick account is yours; that it is one short code
   typed in chat once, with no password and nothing to install; that it is one
   Kick account per site account both ways; and a "Generate my code" button
2. **Waiting** — the code in large type, a copy button, a live countdown to
   expiry, a line saying the page updates on its own, and a note if Matty is
   currently offline
3. **Expired** — the code greyed and struck through, an explanation that codes
   last ten minutes so they cannot be passed around, and a "Generate a new code"
   button. **This is not an error state**
4. **Linked** — Kick username, a verified check, and the date

**Rule** — the waiting state polls and updates itself when the bot confirms. The
viewer must never have to refresh. It is the first thing anyone does on the
site, and it sets their expectation of whether the whole thing works.

### Verify a round — `/verify` · built

**Answers:** can I check this myself?

**Contains** — eyebrow, heading, a form (game, server seed, client seed, nonce,
plus game-specific inputs), a verify button, the recomputed result, and a
four-step explanation: check the commitment · build the byte stream · turn bytes
into numbers · apply the game.

**Rules** — works signed out, and on somebody else's round. Prefills from a
query string so a "Verify" link on any round lands here ready to run.

### Casinos — `/casinos` · built

**Answers:** where does the leaderboard come from, and what is the offer?

**Contains** — eyebrow, heading, a Razed card with the offer, its detail, the
referral code with a copy control, and a sign-up link; a three-step explanation
(sign up with the code · wager as you normally would · appear on the board); a
"Before you sign up" warning card headed *Play with money you can lose*; and an
affiliate disclosure stating Matty earns a commission.

### Official accounts — `/official` · built

**Answers:** is this really him?

**Contains** — an anti-impersonation eyebrow, heading, an explanation, a list of
every genuine account with platform and handle, and a warning that he will never
DM first asking for money or seed phrases.

### Legal — `/terms`, `/privacy`, `/giveaway-rules`, `/responsible` · built

Each is a long-form document page with a heading, a last-updated date, and a
draft banner while the legal review flag is false.

`/responsible` additionally carries self-exclusion links, the helpline, and
deposit-limit guidance for the linked casino.

---

## 4. Games

### Shared behaviour

Every game must:

- Compute nothing client-side — the browser asks to play, the server decides
- Send an idempotency key with every round, so a double-tap is one bet
- Disable its controls while a round settles
- Show its own RTP on screen
- Carry a fairness drawer: server seed hash, client seed, nonce, a rotate
  control, and a verify link

**Fairness drawer contains** — the three values with copy buttons; a "Rotate
seed" button; a "Verify a round" link; and a sentence explaining the hash
commits the server to a seed it cannot change afterwards, and that rotating
reveals the old one so every round played on it can be recomputed by anyone.

**Opt-in gate** — shown when games are switched off for an account. States the
18+ requirement, that coins have no cash value, and offers to turn games on.

### Games lobby — `/games` · built

**Contains** — eyebrow (provably fair, played with coins you earned watching),
heading, balance, a card grid at five per row (key art, name below), and a
"Biggest hits today" table: player (masked), game, bet, multiplier, payout, and
a Verify link per row.

**States** — kill switch on (the whole lobby replaced by one message saying
balances are untouched and rounds in progress settled normally) · no rounds
today (table absent) · coming-soon games are labelled and not clickable.

### Keno — `/games/keno` · built

**Contains**

1. **Header** — eyebrow ("10 drawn from 40"), balance, a **labelled** sound
   toggle (not a bare icon — an unlabelled speaker is how people miss that
   sound exists)
2. **Left rail** — bet amount with ½ and 2× controls and the min/max/max-win
   line; risk as a 2×2 grid (Classic · Low · Medium · High); number picker with
   a 1–10 slider, a "Pick" button, a "Clear picks" link and an "N / 10 selected"
   readout; and the play button whose label states the blocking reason
3. **History strip** — the last dozen rounds as multiplier chips
4. **Board** — 40 tiles, eight across on desktop, five on mobile
5. **Paytable** — one cell per hit count, each showing the hit count and its
   multiplier, with the round's actual hit count highlighted; the table's own
   RTP; and a note that every tier is shown including the ones that pay nothing

**The four tile states must be distinguishable at a glance**

| State | Meaning | Treatment |
|---|---|---|
| Idle | Untouched | Resting, quiet number |
| Picked | You chose it, not yet drawn | Clearly marked as yours |
| Drawn, missed | The server drew it, you did not pick it | Sunken and obviously revealed |
| Hit | Both | The loudest thing on the board, animated |

This is the single most regression-prone thing in the app. If "drawn but not
picked" looks like "untouched", the ten numbers the round is actually about
become invisible.

**Number picker behaviour** — the slider keeps numbers already chosen and adds
or drops only the difference. The Pick button re-rolls the whole set. Dragging
from 3 to 6 must not discard three deliberate picks.

**Play button labels** — "Pick 1–10 numbers" · "Not enough coins" · "Place bet"
· "Drawing…" · "Loading".

### Dice — `/games/dice` · built

**Contains** — bet rail with amount and ½ / 2×; a target slider; an over/under
toggle; derived win chance and payout on target, both labelled as derived; the
roll button; a result readout; and a history strip.

### Limbo — `/games/limbo` · built

**Contains** — bet rail; a target multiplier field; derived win chance; the play
button; a large result number that counts up and stops in under a second; and a
history strip coloured by whether each round cleared. Limbo players read streaks,
which is why the history earns its place here.

**Rule** — auto-play is deliberately switched off, with a visible explanation.
Rounds that keep firing while nobody is watching are the ones people regret.

### Blackjack and baccarat — not built

Lobby cards only, labelled "Coming soon" and not clickable.

---

## 5. Admin dashboard

Its own shell, denser than the public site, never sharing the public chrome.
Deliberately unlinked from the public navigation.

### Shell

**Contains** — a sidebar with the wordmark, the signed-in admin's name and role,
and links: Overview · Razed players · Members and coins · Redemptions ·
Giveaways · Shop items · Prizes and periods · Clips · Games · Audit log. Each
page has a header with an eyebrow, a title, and optional right-hand actions.

**Rules**
- Owner-only areas are visible but greyed and labelled — a moderator should see
  what exists and know who to ask, rather than finding a hole
- Every action that changes something writes an audit row
- Every screen needs a no-database state naming the variable to set
- Every screen needs a not-an-admin state

### Overview — `/admin` · built, gaps

**Answers:** is anything broken, and does anything need me?

**Contains**
1. Four figures — coins minted this week · destroyed by the edge · earning right
   now (with total accounts) · rounds today
2. **Redemption queue** — a count, the waiting items, and a link to the queue
3. **Feed health** — one row each for the Razed leaderboard, the Kick webhook,
   the coin tick job and the database. Each with a status pill and a real detail
   line (last sync, last tick, connection latency, or the actual error)
4. **Coin flow this week** — minted · destroyed · net, and a note that the lever
   is shop prices, never the advertised RTP
5. **Last ten actions** from the audit log, with a link to the full log

**Rule** — resist adding charts. This page answers two questions and every extra
element makes that slower.

**Gaps** — the redemption queue shows an em dash because no table exists.

### Prizes and periods — `/admin/prizes` · built

**Answers:** what is the board measuring, and what does it pay?

**Contains**
1. A note explaining that a period's dates are the window sent to Razed, and
   that freezing is a button rather than a clock
2. **Open a board** — type (weekly/monthly), start date, end date, a "copy the
   last board's tiers" checkbox, and an open button. Below it, a line stating
   both dates are inclusive, in UTC, and that only one board of each type can be
   open at a time
3. **Period list** — date range, type, tier count, derived pot, status. Selecting
   a row opens its detail
4. **Period detail**
   - Editable start and end dates with a save control — **open periods only**
   - Status actions: Freeze (owner-only) → Mark paid → Archive, and Reopen
   - A banner when the board is not open, explaining its dates and tiers are
     locked because it is the record of what people competed for
   - A banner for moderators explaining they can edit tiers but not freeze
   - **Prize pool, labelled calculated**, with a note that it is summed from the
     tiers counting every rank a range covers, and that there is deliberately no
     field for it
   - **Prize tiers** — each row: rank range, how many places it covers, the
     amount each with an inline editor, the row total, and save/remove controls
   - **Add a tier** — rank from, rank to, amount each, and a note that a range is
     one row, and that ranks cannot overlap because a rank paid twice is the
     kind of mistake nobody notices until someone is owed money

**States** — no periods yet · open · frozen · paid · archived · moderator vs
owner · overlapping ranks refused with a message naming the clash.

### Clips — `/admin/clips` · built

**Answers:** how do I put a clip or a big win on the site?

**Contains**
1. **Entry type** chips — Big win · Regular clip
2. **Source URL** with a Fetch button that resolves the platform, the embed and
   the thumbnail, plus a note on which platforms yield a thumbnail from the link
   alone
3. **Title**
4. **Big wins only** — slot, date of the win, bet, payout
5. **Multiplier**, as an inset panel labelled **calculated**, with a note that
   there is deliberately no field for it
6. **Preview** — the fetched thumbnail with the multiplier overlaid as it will
   appear on the site
7. **Toggles** — pin to the homepage (with a used/total count, a fourth refused
   with a message rather than silently dropped) and announce in Discord
   (currently disabled, with a note that there is no bot behind it)
8. **Save as draft** / **Publish**
9. **The list** — every clip and win with title, source, aspect, date, figures,
   status, and per-row Pin/Unpin · Publish/Unpublish · Delete

**Rule** — nothing reaches the public site until published. Drafts are visible
here and nowhere else. That is what stops the carousel filling with filler
inside a week.

### Members and coins — `/admin/members` · built, gaps

**Answers:** who is this person, what do they have, and what did they do?

**Contains**
1. **Search** — by Discord name, Kick name or id
2. **Member table** — member, Kick link (unlinked is called out, because an
   unlinked account earns nothing and that is the first thing to check when
   someone says coins are broken), balance, lifetime earned, joined, status
3. **Member detail** — username, Kick username and numeric id, member since;
   three figures (balance, lifetime earned, multiplier); a **coin adjustment**
   form with an amount, a **mandatory** reason and an apply button, plus
   freeze/unfreeze; and the member's coin ledger

**Rules** — the reason is stored on the ledger row itself, not only in the audit
log, so it travels with the movement it explains. Moderator adjustments are
capped; above the cap it is refused and says an owner is needed. A negative
adjustment cannot take a balance below zero.

**Gaps** — the search box is not wired.

### Razed players — `/admin/razed` · built, gaps

**Answers:** who is on the feed, and does this claim check out?

**Contains** — eyebrow naming the endpoint and referral code; a synced
timestamp; Sync now and Export CSV controls; a filter bar with from, to, top and
period preset chips, plus a feed-health pill; and the table: rank, Razed player
(**unmasked** — a moderator verifying a claim needs the real username), matched
member, wagered, coins, last seen in chat, and an action (View or Invite).

Below: an honest count — "showing all 33", or a warning that a page was left
unread. Then a note that this is a top-N feed rather than a per-player lookup,
so somebody below the cut-off simply does not appear, and their absence is not
evidence they did not wager.

**Rules** — a big wagerer with no site account is the highest-value person on
this screen, so their action is "Invite". Matching is a moderator's note for
convenience and is never used to pay a prize automatically.

**Gaps** — the date and top inputs are display-only; the window comes from the
open period.

### Games — `/admin/games` · shell only

**Contains** — an owner-only kill switch at the top with an explanation that it
disables every game instantly without a deploy, replaces the lobby with a single
message, and lets rounds in progress settle; coin flow for the week; a config
card per game (enabled toggle, RTP, min bet, max bet, max win, and for keno the
full editable paytable with its recomputed RTP); and a live round feed with
anomaly filters (biggest wins today, longest win streaks, most rounds per hour).

**Rule** — the RTP shown beside a paytable is recomputed from the table itself,
so a bad edit is visible before it ships.

**Status** — every input is display-only. Nothing saves. Wiring it needs a game
config table and the same action pattern as clips and prizes.

### Audit log — `/admin/audit` · built, gaps

**Contains** — search; a filter by admin; and a table of when, admin, action,
target. Below, a note that rows are never edited or deleted, including by the
owner — a correction is a second row, not a rewrite of the first.

**Gaps** — search and the admin filter are not wired.

### Redemptions — `/admin/redemptions` · shell only

**Should contain** — a queue of pending redemptions with member, item, cost and
age; approve / reject with a mandatory reason on reject; fulfilment data capture
where an item needs it (size, address, chat colour); and a history of handled
ones with who handled them.

### Giveaways — `/admin/giveaways` · shell only

**Should contain** — a create form (title, prize, entry cost, cap per user, opens
at, draws at); active giveaways showing the published server seed hash and the
entry count; a draw control that reveals the seed and names the winner; and a
past table with prize, drawn date, entries, cost and winner.

**Rule** — the server seed hash is published when the giveaway opens and the
seed is revealed at the draw, so anybody can recompute the winner.

### Shop items — `/admin/shop` · shell only

**Should contain** — a table of item, category, cost, stock, cooldown and status;
create and edit forms; and an active toggle. Changing a price must not alter
what past redemptions recorded.

---

## 6. States every page must handle

Pages get built for the happy path and then fail on the other six.

| State | Requirement |
|---|---|
| **Loading** | No layout jump. Prefer a skeleton at the final size |
| **Empty** | Say what will appear here and how to make it appear. Never a table of headings over nothing |
| **Error** | Say what failed and what to do about it. Never a silent zero |
| **Signed out** | First-class on shop, giveaways, profile, games, claim |
| **No Kick link** | Signed in but earning nothing — say so prominently |
| **No database** | Admin names the variable to set; public pages degrade to empty |
| **Frozen / self-excluded** | Games leave the nav; play endpoints refuse |
| **Feed stale** | Say it, with the reason and the last-known timestamp |

---

## 7. Accessibility and responsive

- Everything interactive is keyboard reachable with a visible focus ring
- Icon-only buttons carry a label; toggles expose pressed state
- Tab groups use proper tab semantics
- Messages that appear after an action are announced
- Colour is never the only signal — a hit tile also animates, a frozen board
  also says "frozen", an error also has words
- **The page body never scrolls horizontally.** Wide content scrolls inside its
  own container. Verify at 375px
- Grid children holding long unbreakable strings need an explicit minimum-width
  override, or they refuse to shrink and push the whole page sideways
- Two breakpoints only: below 768px, and 1024px and up

---

## 8. Copy rules

- Say what a thing is, not how it feels. "Earning paused — stream offline", not
  "Come back soon!"
- Never a currency symbol on a coin figure. Coins are not money
- Never imply coins can be bought, sold, transferred or withdrawn
- Losing states are stated plainly, not softened
- Every claim about money carries its provenance
- Error text names the cause and the fix

---

## 9. Status summary

| Area | Status |
|---|---|
| Global chrome, age gate, coin bar | built |
| Home | built — four stat figures still placeholder |
| Leaderboard, claim, archive | built |
| Clips, wall of fame | built |
| Keno, dice, limbo, lobby | built |
| Profile, Kick verification | built |
| Verifier, casinos, official, legal | built |
| Admin shell, overview | built — redemption queue empty |
| Admin prizes and periods | built |
| Admin clips | built |
| Admin members and coins | built — search not wired |
| Admin Razed players | built — filters not wired |
| Admin audit log | built — search not wired |
| Admin games | shell only — nothing saves |
| Shop, giveaways, redemptions | shell only — no tables |
| Blackjack, baccarat | not built |

**Build the shop next.** Coins are being earned and there is nothing to spend
them on, which breaks the loop the whole site is built around.
