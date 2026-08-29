# MattySpins — Complete UI Specification

Companion to the build plan, which holds the systems: the coin engine, Razed ingest, the data model, auth and compliance. This document is the interface — every screen, in the order you should build them.

**The organising principle:** the whole site is driven by two clocks, and every screen is in one of their states.

```
Stream clock   OFFLINE ─────────▶ LIVE ─────────▶ OFFLINE
Home hero      schedule + VOD     player + earning strip     schedule + VOD
Coins         frozen             ticking every 3 minutes    frozen
Nav badge      grey OFFLINE       blue LIVE NOW, pulsing     grey OFFLINE

Period clock   OPEN ──▶ FINAL HOUR ──▶ FROZEN ──▶ PAID ──▶ ARCHIVED
Board          live ranks   urgent countdown  "verifying"   winners  read-only
Prizes         editable     locked            locked        locked   historical
Claims         closed       closed            open          closing  closed
```

Build the two hero states and the five period states as first-class variants, not as afterthoughts. The site is offline more hours than it is live, and a board spends most of its life in a state other than "open".

**What makes this UI different from an ordinary community site:** every number on it is either money somebody else won or coins the viewer earned by turning up. Both are trust-critical. A figure that looks stale, unexplained or self-reported is worse than no figure at all. So most of the design work here is about **provenance** — where did this number come from, when was it last true, and can I check it. That is why the leaderboard carries a sync timestamp, why the wall of fame shows bet and payout rather than just a multiplier, and why a redemption tells the viewer who approved it.

---

## Screen inventory

**Public**
1. Home — live
2. Home — offline
3. Leaderboards
4. Prize claim
5. Clips
6. Wall of fame
7. Coin shop
8. Giveaways
9. Razed hub
10. My account, including Kick verification
11. Official accounts
12. Games — opt-in gate
13. Games — lobby
14. Keno
15. Wheel, dice and limbo
16. Fairness and verification
17. Limits and self-exclusion

**Admin**
12. Shell and overview
13. Razed players
14. Members and coins
15. Redemption queue
16. Clip and big-win editor
17. Prizes and periods
18. Giveaways
19. Audit log

**Components**
20. Nav and live badge
21. Leaderboard table
22. Clip card and carousel
23. Big-win card
24. Shop item card
25. Coin bar and ledger
26. Admin table and filter bar
27. Prize tier editor
28. Mobile shell

---

## 0. Setup

Next.js with the App Router, TypeScript, Tailwind. React server components for anything that reads the database — the leaderboard, the shop, the wall of fame — and client components only where something ticks, plays or is typed into. Auth through Discord OAuth with database sessions rather than JWT-only, so an account can actually be revoked.

Install alongside the framework: a class-merging helper, an icon set with a consistent stroke style, and nothing else. This site has no need for a component library — every element in it is a bordered rectangle with type in it, and a library will fight the density you want.

Folder shape: routes under `app`, three component folders (`ui` for primitives, `site` for public composites, `admin` for the dashboard), and a `lib` holding exactly three things — the class helper, the formatters, and a single mock-data file. Keep every screen on mock data until step 11 of the build order; when the backend lands you change one import, not forty components.

Two formatters, written once and never inlined: **money** (no decimals except where cents matter) and **coins** (thousands separators). A third derives the multiplier from bet and payout — that number is never stored as typed, always computed, so it can never disagree with the two figures beside it.

---

## 0.5 The currency

The site's currency is the **Matty Coin**. Written **MC** where space is tight ("50 MC"), spelled out in prose, and shown as the gold coin mark beside any balance figure. It is earned by watching, spent in the shop, on giveaway entries and in the games. It cannot be bought and has no cash value.

The word "points" appears nowhere in the interface. Three assets ship with it: a full-detail coin for hero and balance use, a flat 24px version for inline use beside numbers, and a single-colour outline for places that need to inherit the text colour.

---

## 1. Design tokens

One theme, dark, deliberately. No light mode — this is a stream site and it will be viewed beside a dark player.

| Token | Value | Used for |
|---|---|---|
| `bg` | `#070B14` | Page ground, near-black with a navy bias |
| `surface` | `#0D1422` | Cards, panels, table bodies |
| `surface-2` | `#111A2B` | Table headers, insets, hover |
| `line` | `#1B2740` | Every border and divider |
| `line-2` | `#29354D` | Inputs, outline buttons — anything clickable |
| `ink` | `#E8EDF5` | Primary text |
| `ink-2` | `#A9B6C9` | Secondary text |
| `muted` | `#8C99AD` | Labels, meta |
| `faint` | `#6B7891` | Timestamps, disabled |
| `brand` | `#2B8FFF` | The accent, taken from the M$ logo |
| `brand-dim` | `#6BB0FF` | Link and button hover |
| `brand-ink` | `#04121F` | Text on a brand-filled surface |
| `brand-bg` / `brand-line` | `#0C1B33` / `#1E3A63` | Tinted panels |
| `gold` | `#FFB93B` | Money: prizes, wins, multipliers, rank 1 |
| `gold-bg` / `gold-line` | `#1A1608` / `#33290F` | Big-win and prize panels |
| `silver` / `bronze` | `#C6CFDD` / `#B07A4E` | Ranks 2 and 3 |
| `danger` | `#FF8A6B` | Rejections, flags, errors |
| `live` | `#E5352B` | The LIVE tag on the player, nothing else |

Four rules that keep it coherent:

1. **Blue is the only loud colour.** Primary actions, active states, links, the live indicator. Nothing else competes.
2. **Amber means money.** Prize amounts, win figures, multipliers, first place. If it isn't currency or a multiplier, it isn't amber.
3. **Never both on one element.** A blue button with amber text does not exist here.
4. **Borders are `line`.** `line-2` only on something a user types into or presses.

Radii are tight — 3px on cards and buttons, 2px on chips, full circles only on avatars and status dots. Nothing on this site is pill-shaped except a count badge.

### Razed's marks

Razed supplies two: the full **RAZED wordmark** and the standalone **Z mark**. Use them differently and never redraw either.

- **Wordmark** — the casino strip on the home page, the Razed hub header, and anywhere the partnership is being sold. Give it a dark plate matching its own background rather than sitting it on your surface colour.
- **Z mark** — inline, at 15–18px, beside labels that say where data came from: the leaderboard eyebrow, the admin sidebar item, the Razed players header. It reads as a provenance stamp, which is exactly the job.

One thing to watch: Razed's brand blue is close to the accent taken from Matty's logo. That works in your favour — the two brands sit together comfortably — but it means the wordmark must always appear inside its own bordered plate, or the page starts to read as Razed's site rather than Matty's.

---

## 2. Typography

Three faces. A condensed display face used only in uppercase, a workhorse sans, and a mono for every number.

| Role | Size and treatment | Where |
|---|---|---|
| Display XL | 78px, line-height 0.9 | Home hero headline |
| Display L | 64px, 0.95 | Page titles |
| Display M | 46px, 1.0 | Section headings |
| Display S | 26px | Panel headings, wordmark |
| Stat | 30–34px, mono, tabular | Stat tiles, bet / win / multiplier |
| Body L | 18px, 1.55, secondary ink | Hero subcopy |
| Body | 15px, 1.5 | Everything |
| Body S | 14px, muted | Card descriptions |
| Label | 11px mono, 0.18em tracking, uppercase, muted | Every eyebrow, table header, field label |
| Meta | 11.5px mono, faint | Timestamps, counts |

Three rules, and the third is the one people skip:

- The display face is **uppercase only**. It has no lowercase personality.
- The label style appears roughly eighty times. Make it a component on day one.
- **Every number in a column is mono with tabular figures.** Money, coins, wagered totals, multipliers, countdowns. Proportional digits in a leaderboard look broken, and it is invisible until you see it side by side.

---

## 3. Layout

Content sits in a 1440px container with 56px gutters on desktop and 18px on mobile. Major sections are separated by 72px. Page-level splits use a twelve-column grid at 40px gaps; card grids use 20px.

Two breakpoints matter — below 768px is mobile, 1024px and up is desktop, and the space between is the mobile layout with more air.

The divider pattern used throughout: a grid with a one-pixel gap over a `line`-coloured background, each child painted `surface`. That gives hairline dividers that never double at the joins. It builds the stat strips, the prize tiers, the bet/win/multiplier row and every table section.

---

## 4. Home — live

The single most important screen, and the one a viewer sees while a stream is running in another tab.

> Build the live state of the MattySpins home page. Twelve-column grid, dark navy ground, with a soft radial glow behind the upper right of the hero.
>
> **Hero, left half.** A meta row first — a blue dot and "LIVE ON KICK", then the current viewer count in mono. Below it the headline at 78px in the condensed display face, three lines, the last one in brand blue. Then a paragraph of subcopy no wider than 46 characters explaining the two ways to earn: minutes in chat, and dollars wagered under Matty's code. Two buttons — a filled "Watch the stream" and an outlined "See this week's board".
>
> Beneath those, the earning strip: a brand-tinted card sized to its content, a small blue dot, and the sentence "You're earning **2 MC** every 3 min — sub bonus active" with the figure in mono. For a signed-out visitor the same strip reads "Sign in to start earning" and is itself the button. This strip is the single most valuable element on the page — it is the only place the viewer sees the mechanic working in real time.
>
> **Hero, right half.** The Kick player at 16:9 inside a bordered frame. Until it is clicked it shows the stream thumbnail with a 66px circular play button and a red LIVE tag pinned top-left. Under the frame, a single row: the current stream title on the left, uptime in mono on the right.
>
> **Stat strip**, full width, four hairline-divided tiles: weekly prize pool in gold, board reset countdown in mono, members earning, paid out to date in gold. On mobile it becomes two columns.
>
> **Weekly board preview.** A section heading with the Razed Z mark and "wagered on Razed under code MATTYSPINS" as the eyebrow, plus WEEKLY and MONTHLY chips on the right. Then the podium — three cards, each with a large rank numeral in gold, silver or bronze, the prize in mono, the masked username, and the wagered total beneath. Then three table rows and a "View the full board" link.
>
> **How coins work.** A bordered panel with three cells: "1 pt every 3 minutes", "+10 MC for a full hour", "2× everything, for subs". The third cell gets the brand-tinted treatment so the sub incentive is visually louder than the other two. Each cell has two sentences of plain explanation beneath the figure.
>
> **Clips.** Filter chips — All, Kick, YouTube, Instagram, X — then a horizontally scrolling row of clip cards.
>
> **Biggest wins.** A full-bleed band, bordered top and bottom, on a slightly lifted background. Sort chips on the right: by multiplier, by win, all time. Then one featured big win at two-thirds width with two compact ones stacked beside it. Detailed in §23.
>
> **About Matty.** Portrait left at five columns, copy right at seven — 120 to 150 words in his voice — with two info cards beneath in a two-column grid: the stream schedule, and the four socials with handles.
>
> **Razed strip.** A brand-tinted card: headline "Play on Razed under code MATTYSPINS" with the code in blue, one line of explanation, and on the right the Razed wordmark on its own plate above a filled "Claim the bonus" button.
>
> **Footer.** Two rows split by a rule. Logo and links above; the 18+ roundel, the responsible-gambling paragraph, the affiliate disclosure and the "Matty will never DM you first" line below.

The order is deliberate. Live state first because that is why they came, the board second because that is the money, coins third because that is what converts a watcher into an account, and the personality — clips, wins, about — after all three have done their work.

---

## 5. Home — offline

Not a lesser version of the live page. Most visits happen while the stream is down, and this state has a different job: tell them when he's back, and give them something to do until then.

> Build the offline state of the home page. Same structure, four changes.
>
> **The hero headline becomes the schedule.** "Back live Tuesday, 8PM" at display size, with a countdown beneath in mono. The subcopy shifts from "start earning" to what happened last session.
>
> **The player frame shows the most recent VOD or big win**, with a "Watch the last stream" label rather than a live tag. It is the same click-to-play component.
>
> **The earning strip is replaced by the week's schedule** as a compact three-row table.
>
> **The live badge in the nav goes grey**, reads OFFLINE, and stops pulsing.
>
> Everything below the hero is unchanged. The board, the shop and the wall of fame are all still live content when the stream isn't.

---

## 6. Leaderboards

> Build the leaderboard page.
>
> **Header block.** The Razed Z mark and eyebrow "Razed · referral code MATTYSPINS · all times UTC", then the page title at 64px. On the right, WEEKLY / MONTHLY / ARCHIVE chips, and beneath them "Updated 4 minutes ago" in faint mono. That timestamp is not decoration — it is the page's credibility, so give it a fixed position and never let it disappear during a refresh.
>
> **Period strip.** Three hairline-divided tiles: the date range, the countdown to close in brand blue, and the prize pool in gold.
>
> **The board.** Podium of three, then rows. Each row carries rank, masked username, movement since the last sync as a small up or down triangle, the wagered total, and the prize. Movement is blue for up, coral for down, a faint dash for unchanged.
>
> **The provenance row**, pinned to the bottom of the table on a brand-tinted ground: an info icon and the sentence "Every figure here comes straight from Razed — nothing is self-reported", followed by the claim instruction. This replaces the "your position" row that a self-linked design would have, and it does more work: it explains the absence rather than leaving the viewer wondering why they can't find themselves.
>
> **Two cards below.** "How the board works" — qualification, tie rule, freeze time, verification window — in plain sentences, not bullet fragments. And "Last month's winner" in the gold variant: the masked name at display size, the amount, and a link into the archive.
>
> **Archive tab.** A list of closed periods, each row a date range, the winner, the pot and a link to the frozen board. Never delete these. The archive is the proof that the prizes were real, and it is most of what convinces a new viewer to sign up.

**Mobile:** the row collapses to rank, username and prize, with the wagered total moving to a second line beneath the name at 12px. Do not build this as a table element — it must restructure at the breakcoin, and a horizontally scrolling leaderboard on a phone is a failed screen.

---

## 7. Prize claim

The flow that replaces account linking. It only appears when a period is frozen and the viewer is signed in.

> Build the prize claim flow as a modal opened from the frozen leaderboard.
>
> **Step one — which position.** The frozen board's paying positions listed as selectable rows, each showing rank, masked username and prize. Positions already claimed are dimmed with a "claim pending" or "paid" tag. The viewer picks the row they believe is theirs.
>
> **Step two — prove it.** A single field: the full Razed username. Beneath it, plain text explaining that a moderator will check this against Razed's own figures before anything is paid, and that a false claim costs them their account. One optional field for a payout note.
>
> **Step three — submitted.** A confirmation panel showing the claim reference, the position, the amount, and what happens next with an expected timeframe. The same panel is what they see if they return to the page later, so build it as a state of the claim, not as a one-time success screen.
>
> **On the account page**, an active claim appears as a card at the top with its status — submitted, verifying, approved, paid, or rejected with a reason.
>
> If someone has already claimed that position, don't race them. Show "Another claim is being reviewed for this position" and let them submit anyway; a second claimant is a flag for a moderator, not a competition.

---

## 8. Clips

> Build the clips page. A filter chip row — All, Kick, YouTube, Instagram, X — above a grid of clip cards at four columns, dropping to two and then one.
>
> Each card is a thumbnail with a centred play glyph, a source chip top-left and a duration bottom-right, then the title and the age and view count in mono beneath.
>
> **Nothing embeds until it is clicked.** The card holds a thumbnail; the player replaces it in place on click. Three live embeds on one page is a six-megabyte page that stutters on a phone, and this is the single decision that determines whether the site feels fast.
>
> Auto-synced YouTube and Instagram posts appear here only once a moderator has published them, so the page never fills with filler.

---

## 9. Wall of fame

The big wins, in full. The most shareable page on the site and the one a new viewer is most likely to land on from a link in chat.

> Build the wall of fame. A header with sort chips — by multiplier, by win, by date, all time — and, pinned above the grid, two record cards in the gold variant: biggest multiplier ever and biggest win ever, each showing the figure at display size with the slot, date and a link to the clip.
>
> Then the grid of big-win cards at three columns, each in the compact variant described in §23.
>
> A month filter down the side or as a chip row, because "what did he hit in August" is a question people actually ask.

---

## 10. Coin shop

> Build the coin shop.
>
> **Header** with category chips: All, Entries, Discord, Merch, On stream.
>
> **Coin bar** directly beneath, in the brand-tinted variant: the balance at display size in blue, then hairline-divided figures for earned this week and pending redemptions, the live earn rate on the right, and a "Coin history" outline button.
>
> **Item grid**, four columns. Each card: an icon panel tinted to its category, then the category label, the item name, two lines of description, and a buy bar carrying the cost in blue display type and the action button.
>
> Out of stock drops the whole card to 55% and replaces the button with a chip reading OUT OF STOCK. A cooldown does the same with "Available in 12 days". Never hide an unavailable item — its price is part of what makes the coin feel worth earning.
>
> **Signed out:** prices stay fully visible, buttons read "Sign in to redeem" and open Discord OAuth.
>
> **Moderation note** at the bottom of the page, quietly: merch and on-stream redemptions are reviewed by a moderator, usually within a day, and rejected redemptions refund automatically.

---

## 11. Giveaways

> Build the giveaways page.
>
> **Active giveaways** as wide cards: prize at display size, entry cost, entries so far, your entries, and the draw time as a countdown. The primary action is "Enter for 50 MC", which increments in place rather than navigating.
>
> **The fairness block** on each card, collapsed by default: the published server seed hash, an explanation in one sentence, and after the draw the revealed seed with a link explaining how to verify. This is a few hours of work and it is most of the credibility the site has.
>
> **Past winners** below as a simple list — date, prize, masked winner, and a "verify" link that expands the seed and the arithmetic. Never delete a row from this list.

---

## 12. Razed hub

> Build the Razed hub page. One partner today, but structure it as a list so a second is data entry rather than a rebuild.
>
> Per casino: the wordmark on its own dark plate, the bonus offer in plain words rather than marketing copy, the referral code in mono with a copy button, and a filled sign-up button carrying the tracking link.
>
> Beneath, a three-step "how to get on the leaderboard" block — sign up with the code, wager as normal, appear on the board within ten minutes. Three steps, one line each.
>
> Then the responsible-gambling block, larger here than in the footer, and the affiliate disclosure stated plainly.

---

## 13. My account

> Build the account page.
>
> **Identity card** at the top: Discord avatar and name, the linked Kick account with a verified tick, and the member-since date. If Kick is not yet linked, this card is replaced by the verification flow.
>
> **Verification flow**, three states in one card. *Unlinked:* an explanation and a "Generate my code" button. *Waiting:* the six-character code at display size with a copy button, the instruction "Type this in Matty's Kick chat while he's live", a ten-minute countdown, and a live status line. *Linked:* the Kick username with the date it was verified.
>
> The waiting state must update itself when the bot confirms — the viewer should never have to refresh. It is the first thing they ever do on the site and it sets their expectation of whether it works.
>
> **Coins block:** balance, lifetime earned, current multiplier, and a ledger table — date, reason, change, running balance. Every row is a real entry: watch tick, hour bonus, redemption, adjustment. Show adjustments with the moderator's note attached, because an unexplained deduction is the fastest way to lose someone.
>
> **Redemptions** as a status list — pending, approved, fulfilled, rejected with reason.
>
> **Danger zone** at the bottom: delete my account, with a plain explanation of what goes and what stays.

---

## 14. Official accounts

> Build the official accounts page. Deliberately plain, deliberately short.
>
> The four real handles as large rows — Kick, YouTube, Instagram, X — each with the platform mark, the exact handle in mono, and a link. The Discord invite as a fifth.
>
> Above them, one sentence in ink at 18px: **Matty will never DM you first and will never ask you to deposit.** Below them, two lines on what to do if someone claiming to be him gets in touch.
>
> No decoration. Someone reading this page is checking whether they are being scammed, and the page should feel like a fact sheet.

---

## 15. Admin — shell and overview

Admin shares the tokens but runs denser: smaller base type, tighter rows, more per screen.

> Build the admin shell. A fixed 236px sidebar on a slightly darker ground, content to the right at 26px vertical padding.
>
> **Sidebar:** the logo mark and "ADMIN" at the top; then the nav — Overview, Razed players (with the Z mark), Members and coins, Redemptions, Giveaways, Shop items, Prizes and periods, Clips, Audit log. Counts that need attention sit right-aligned as gold pills. At the bottom, a signed-in card showing the name and the role in mono — OWNER or MOD.
>
> **Overview** is four things and nothing else: today's numbers as a stat strip, the redemption queue length, feed health for Razed and the Kick webhook, and the last ten audit entries. Resist adding charts. This page exists to answer "is anything broken and does anything need me", and every extra element makes that slower.
>
> **Role differences are visible, not hidden.** A moderator sees prize tiers and casino config greyed with a small "owner only" tag rather than absent — it prevents the "where did that menu go" support message.

---

## 16. Admin — Razed players

> Build the Razed players screen.
>
> **Header:** the Z mark, the eyebrow "Razed · referrals/leaderboard · code Mattyspins", the title, and on the right "Synced 4 min ago", a "Sync now" outline button and "Export CSV" as the primary.
>
> **Filter bar** as its own card: from and to dates, the `top` count, then preset chips for this week, this month and custom. Pushed right, a feed-health pill — a blue dot with "FEED HEALTHY · 200 OK", or gold with "STALE · LAST OK 4H AGO", or coral with the failing status code.
>
> **The table.** Rank, Razed player at full unmasked name, matched member, wagered, coins, last seen in chat, and an action. The matched-member cell is the interesting one: a blue dot and the Discord handle when a moderator has matched them, gold and "Unmatched" when not, coral and a flag reason when the abuse checks have marked them. Flagged rows carry a faint coral tint across the whole row.
>
> The action column reads "View" for a matched member, "Invite" for an unmatched one — the second opens a prefilled message a moderator can send, because a big wagerer with no account is the highest-value person on this screen.
>
> **Footer row:** "Showing 6 of 25 returned by Razed" in mono, and a "Show all" link. State the ceiling plainly. Razed returns a top-N list and a moderator needs to know they are not looking at everybody.

---

## 17. Admin — members and coins

> Build the member lookup. A search field over Discord name, Kick name or ID, then a result table: member, Kick link status, balance, lifetime earned, last seen, status.
>
> **The member detail panel** is where the work happens. Identity at the top, then the full coin ledger, then redemptions, then flags. Two actions in the header: an adjustment with a mandatory reason field, and freeze or unfreeze earning with the same.
>
> The reason field is mandatory for a reason — six months later the audit log needs to say why someone got 500 coins, and "adjustment" is not an answer.
>
> **Owner and moderator differ here:** a moderator's adjustment is capped, and above the cap the field shows "Owner approval required" rather than failing on submit.

---

## 18. Admin — redemption queue

The screen used most often. It should be operable in a few seconds per item, on a phone, between bonus buys.

> Build the redemption queue. Rows rather than cards: the item and the member on one line, the cost and the age in mono beneath, then Reject in a coral outline and Approve as the primary.
>
> Rejecting opens a small reason field with three preset chips — out of stock, ineligible, suspected abuse — because a reason is required and typing one every time is what makes people stop giving reasons. Coins refund on rejection and the row says so.
>
> Approving an item that needs fulfilment detail — merch size, an address, a slot name — expands the row to show what the viewer entered rather than opening a new screen.
>
> Handled rows stay visible for the session at 60% with the moderator's name and the time, then drop to a "recently handled" tab. Seeing what your co-moderator just did prevents the double-approval.
>
> **On mobile this screen must work properly.** It is the one admin screen that gets used away from a desk.

---

## 19. Admin — clip and big-win editor

> Build the clip editor as a two-column card.
>
> **Left column.** A mode toggle at the top — big win or regular clip. Then the URL field with a "Fetch" button and a hint line naming the four accepted platforms, or a file drop zone for a raw video. When it is a big win, a two-by-two grid of slot, date of the win, bet and payout. Beneath those, the multiplier in an inset panel at display size in gold, labelled "calculated" — never an editable field.
>
> **Right column.** A live preview frame showing the fetched thumbnail with the multiplier overlaid exactly as it will appear on the site, then two toggles — "Pin to the homepage wall" and "Announce in Discord" — and, at the bottom, "Save as draft" and "Publish".
>
> **Beneath the card**, a note: auto-synced YouTube and Instagram posts land here as drafts with a count, and nothing reaches the site until someone publishes it.
>
> **The clip list** below shows everything with its status, source, and pinned flag, drag-reorderable for the homepage row. Three pins maximum, enforced with a message rather than a silent failure.

---

## 20. Admin — prizes and periods

> Build the prize tier editor.
>
> **Header:** the period being edited, with WEEKLY and MONTHLY chips to switch.
>
> **Tiers** as rows: the rank or rank range on the left in its metal colour, the amount as a numeric input, the currency in faint mono. A range tier — "4–10 → $400 each" — is a first-class row type, not a workaround, so Matty isn't typing seven identical lines every month.
>
> Beneath: a dashed "+ Add tier" button, then Preview and "Save & publish" pushed right. Preview opens the public board with the new prizes applied so he can see the pot before committing.
>
> **The warning inset**, always visible: changes apply to the *next* period by default; editing a live period is allowed but is logged and shows viewers a "prizes updated" note with a timestamp.
>
> **Period list** below: each period with its state — open, frozen, paid, archived — the pot, the winner, and the claims outstanding. A frozen period offers "Finalise and open claims"; a finalised one offers "Mark paid" per position.

---

## 21. Component — nav and live badge

> Build the site nav at 76px with a bottom rule. The logo mark at 38px with a 9px radius, the wordmark beside it with "MATTY" in ink and "SPINS" in brand. Links at 15px in secondary ink; the active one gains ink colour and a two-pixel brand underline.
>
> Right side, in order: the live badge, then either a Discord sign-in button in Discord's own blurple — the one place another brand's colour is allowed — or the account chip showing avatar, name and coins balance in blue mono.
>
> **The live badge** is a bordered pill: when live, a blue dot with a soft glow, pulsing slowly, and "LIVE NOW" in mono blue on a tinted ground. When offline, a faint dot with no glow, "OFFLINE" in faint text, a plain border. The pulse stops entirely for reduced-motion.
>
> **Mobile:** logo, live pill and a 44px hamburger. The drawer slides from the right and repeats the nav plus the account block.

---

## 22. Component — leaderboard table

> Build the board as two pieces that share their data.
>
> **The podium.** Three cards, each with a metal-tinted border and a gradient fading from the metal into the surface. The rank numeral at 40px in gold, silver or bronze with the prize in mono on the same line; the masked username at 19px; the wagered total beneath in muted mono.
>
> **The rows.** A five-column grid — rank, player, movement, wagered, prize — with a header row in the label style on the inset ground. Rows separated by hairlines, first place carrying a faint gold wash if it appears in the row list rather than the podium.
>
> Build it from divs with table roles, not a table element, so the mobile breakcoin can restructure it. Masking is applied server-side, never in the browser.

---

## 23. Component — big-win card

The component the site is judged on. Two variants from one definition.

> **Featured.** A player frame with a gold-tinted gradient, a centred 82px play button in gold, and the multiplier overlaid top-left at 56px with a "RECORD HOLDER" label above it and a heavy text shadow so it survives any thumbnail. Source chip bottom-left, duration bottom-right.
>
> Directly beneath, three hairline-divided cells at equal width: **BET** in ink, **WIN** in gold, **MULTIPLIER** in gold, each a label above a 30px mono figure. Then a footer row with the clip title on the left and the slot and date in mono on the right.
>
> **Compact.** The same three parts at two-thirds scale: a 212px frame, the multiplier at 30px in ink rather than gold, the three cells at 16px with "MULTI" as the third label, and the title and meta stacked in a small footer.
>
> **Playback:** clicking anywhere on the frame swaps the thumbnail for the player in place. No lightbox, no navigation. Everything below the frame stays put, so the numbers remain readable while the clip plays.
>
> **Aspect ratio is a data field, not a constant.** Kick and YouTube clips are 16:9, Instagram reels are 9:16. Read it from the record and size the frame accordingly, capping a vertical clip's height and centring it. Letterboxing every reel into a 16:9 box is the single most common way this component gets built wrong.

The three figures are the coin. A multiplier alone is a boast; bet and payout beside it are evidence, and evidence is what gets screenshotted into other people's chats.

---

## 24. Component — clip card and carousel

> A fixed-width card that does not flex: thumbnail with a centred play glyph, source chip and duration as small dark plates in opposite corners, then the title at 15.5px semibold and the age and views in faint mono.
>
> The carousel is a horizontally scrolling flex row with scroll-snap, snapping to the card's leading edge, with the scrollbar hidden and the container's padding matching the page gutter so the first card lines up with the heading above it. No carousel library — native scrolling gives momentum on touch, arrow keys and accessibility for free.

---

## 25. Component — Coin bar and ledger

> **The bar** is a brand-tinted card: the balance at 38px in blue, hairline dividers, then earned this week and pending redemptions in mono, the live earn rate pushed right, and a "Coin history" outline button. When the stream is live the earn rate shows a small blue dot and the current multiplier; when offline it reads "Earning resumes when Matty goes live".
>
> **The ledger** is a plain table — date, reason in words rather than codes, the change with sign and colour, and the running balance. Watch ticks aggregate by session ("Watched 2h 15m — 47 MC") rather than listing forty individual three-minute rows, but the aggregate expands to the raw entries on click. Adjustments always show the moderator's reason inline.

---

## 26. Component — admin table and filter bar

> The same grid mechanics as the leaderboard, denser: 14px base, 13px row padding, an actions column pinned right. Header cells in the label style on the inset ground.
>
> Status is a six-pixel dot plus a word, never colour alone. Rows needing attention take a six-percent tint of their status colour across the full width — enough to find while scanning, not enough to shout.
>
> **The filter bar** is its own card above the table: inputs on the left in a labelled row, preset chips beside them, and a health or count pill pushed right. Filters live in the URL so a moderator can send another moderator a link to exactly what they are looking at.

---

## 27. Component — mobile shell

Most viewers arrive from a phone while the stream is running, so this is not a downgrade of the desktop layout.

> **Nav** at 62px: logo, live pill, hamburger. **Bottom tab bar** fixed at 62px with four tabs — Home, Board, Shop, Me — each a 20px icon over a 9.5px mono label, the active one in brand.
>
> Every tap target is at least 44px. Buttons go full-width and 50px tall. The stat strip becomes two columns; leaderboard rows collapse to two lines; clip cards drop to 210px wide; the big-win card stacks its three figures into a single hairline-divided row that stays readable at that width.
>
> The bottom bar means the coin balance is always one tap away, which is the behaviour you want — a viewer checking their balance mid-stream is a viewer still watching.

---

## 28. States to build

| State | Where | Behaviour |
|---|---|---|
| Stream offline | Home, nav, Coin bar | Hero swaps to schedule, badge greys, earn rate reads "resumes when live" |
| Razed feed stale | Leaderboard, admin | Gold bar above the board naming the last successful sync time |
| Razed feed failing | Admin overview | Coral health pill with the status code and a "Sync now" retry |
| Period frozen | Leaderboard | "Verifying — prizes paid within 72 hours" banner, ranks locked, claims open |
| Period archived | Leaderboard | Read-only board, archive chip active, claim actions gone |
| Signed out | Shop, giveaways, account | Prices and prizes fully visible; every action becomes "Sign in with Discord" |
| Kick unlinked | Account, Coin bar | Coins blocked with a single line explaining verification, linking straight to the flow |
| Verification code expired | Account | Code greys out with "Expired — generate a new one", not an error |
| Earning frozen | Account, Coin bar | Plain statement with the moderator's reason and how to appeal |
| Zero coins | Shop | Prices stay; a line reads "Watch a stream to start earning" |
| Item out of stock | Shop | Card dims, cost greys, button becomes a chip |
| Redemption rejected | Account | Coral row with the reason and the refunded amount |
| No clips yet | Clips, home | One line and the admin action that fixes it — never an empty grid |
| Vertical clip | Wall of fame, clips | Frame switches to 9:16, height-capped and centred |
| Claim already pending | Prize claim | "Another claim is being reviewed" — submission still allowed, flagged for a moderator |
| Loading | Everywhere | Skeletons at the real element's dimensions, never spinners |
| Section error | Anywhere | Fails inline; the rest of the page still renders |

---

## 29. Motion

Four things move. Nothing else.

The live dot pulses on a two-second cycle. Buttons and chips transition their background and border over 150ms. Cards brighten their border on hover — no lift, no shadow. The play button scales slightly when its card is hovered.

All of it disabled under reduced-motion. On a site full of flashing casino content, restraint in the chrome is what makes it feel trustworthy rather than like another affiliate page.

---

## 30. Accessibility floor

Every interactive element is a real button or link. The focus ring is defined once globally and removed nowhere. Play buttons name the clip they play. Filter chip rows are tab lists with proper selected state. The countdown is never announced by a screen reader. Status is always a dot *and* a word. The faint text colour is for meta only — never for anything a viewer must read. Test at 200% zoom before shipping.

---

## 31. Build order

**§21 nav → §4 home live → §5 home offline → §22 leaderboard table → §6 leaderboards → §24 clip card and carousel → §23 big-win card → §9 wall of fame → §25 Coin bar → §10 shop → §13 account and verification → §7 prize claim → §15 admin shell → §26 admin table → §16 Razed players → §18 redemptions → §19 clip editor → §20 prizes → §11 giveaways → §12 Razed hub → §14 official accounts → §27 mobile pass → §28 states.**

Nav and both home states first, because the offline state is the one you'll otherwise discover too late and it changes the shape of the hero. The leaderboard table next — it is the pattern every other table on the site copies, and getting its mobile collapse right once saves doing it four times. Then the clip and big-win components, which are the site's personality and the part worth polishing while you still have patience for it.

Admin comes as a block in the middle rather than at the end. The redemption queue and the Razed players list are what make the site operable on day one, and a public site nobody can administer is not launched, it is just deployed.

Giveaways, the Razed hub and the official accounts page are last among the screens because each is small, self-contained and depends on nothing above it. The mobile pass and the state matrix close it out — do them as their own step, not as you go, because judging density and empty states properly needs the whole thing in front of you.

Everything through the admin block runs on mock data. Wire the real sources only once the interface is settled; changing a component because the API returned a different shape is cheap, changing a layout because the design was decided by the data is not.


---

# Part two — Games

Added after the first spec. Four games at launch — keno, wheel, dice, limbo — played with the same coins that buy shop items, hidden until a viewer opts in. Blackjack and baccarat come later.

Two things shape every screen here. **Matty Coins can never be bought**, and the interface should make that obvious rather than leave it implied — it is what separates this from a casino. And **every screen carries three things**: the daily limit, the fairness panel, and a route to switching the games off. Not buried in settings; present.

---

## 32. Games — opt-in gate

> Build the gate a viewer sees the first time they open the games section, before anything is playable.
>
> A single centred panel, no game visible behind it. In order: an 18+ statement; three short lines saying what this is — Matty Coins are earned by watching and can never be bought, every round can be checked afterwards, the house keeps a small edge stated on every paytable; a field to set an initial daily wager limit with a sensible default already filled in; a checkbox confirming they are over 18; and one button, "Turn on games".
>
> Beneath the button, in muted text, the line that matters: "You can switch these off again at any time, instantly, from your account."
>
> Until this is completed, **Games does not appear in the navigation at all** and every play endcoin refuses. Someone who wants nothing to do with this never sees it.
>
> No hype, no animation, no jackpot imagery. This screen is the site being honest about what it is about to offer, and it should read that way.

---

## 33. Games — lobby

> Build the games lobby.
>
> **Header:** the eyebrow "Provably fair · played with the coin you earned watching", the title, and chips on the right for All, My history, Verify a round.
>
> **Two panels below it, side by side.** The wider one is the balance strip in the brand-tinted variant: balance at display size, then wagered today and net today, and the live earn rate pushed right. Net today is coral when negative and gold when positive — one honest number, never hidden. The narrower one is the daily limit: a label, the amount used against the cap, a progress bar, and the sentence explaining that increases take 24 hours while decreases apply straight away.
>
> **The game grid**, three across. Each card is a live preview rather than a logo — keno shows a fragment of the grid with hits lit, the wheel shows a segmented ring, dice shows a target bar, limbo shows a multiplier and its curve. Then the name, two lines of plain description, and a footer with the bet range and a Play button. Blackjack and baccarat sit in the grid at 50% opacity with a "Coming soon" chip; showing what is coming is worth more than hiding it.
>
> **Biggest hits today** as a table: player, game, bet, multiplier, payout, and a Verify link on every row. Multipliers and payouts in gold. That Verify link on a stranger's win is the most persuasive thing on the page.
>
> **Two closing cards.** One explains provable fairness in four sentences and links to the verifier. The other, in the gold variant, is about playing sensibly: Matty Coins have no cash value, set a limit, and games can be switched off from the account instantly and for as long as you choose.

---

## 34. Keno

The only launch game with real interface work. Build it first; the other three reuse its bet panel, its fairness drawer and its result treatment.

**Four risk levels — Classic, Low, Medium, High.** They change the paytable, nothing else. Classic pays on the most hit counts with the lowest ceiling; High pays on the fewest with the highest. The full tables for every risk level and pick count are in `keno-paytables.md`, and they live in config so Matty can tune them.

Two rules for the interface. **Switching risk redraws the paytable instantly**, before the next round — the player is choosing a shape, and they need to see the shape change. And **the paytable must show the losing tiers explicitly**: "0 – 1 hits → 0×" is a row, not an omission. On High, a player can hit five of six and win nothing; discovering that after the round rather than before it is what makes a game feel rigged when it isn't.

> Build the keno screen. Two columns — the board at flexible width, a 380px bet rail on the right.
>
> **Risk selector** sits in the page header beside the title: four chips, Classic selected by default. It is the first thing a player touches and the last thing they think about, so it belongs above the board rather than buried in the bet rail.
>
> **The board.** A header line reading "Pick up to 10 · 6 selected" with Quick pick and Clear on the right, then a grid of 40 numbers, eight across, each tile 56px tall. Four tile states, and they must be distinguishable without colour alone: **unpicked** (inset panel, muted number), **picked** (brand-tinted fill, brand border, bold), **drawn but not picked** (dark fill, gold border), **hit** (solid gold fill, dark number, bold). Beneath the grid, a "Drawn this round" row listing the ten drawn numbers as small chips with the hits filled solid.
>
> **The bet rail.** Bet amount with ½, 2× and Max buttons; a two-cell strip showing picks and top payout; the primary button reading "Play for 120 MC" — the amount in the label, always, so nobody misclicks a bet size. Below it a "Skip the animation" toggle, which regulars will want by their tenth round.
>
> **The paytable** directly beneath, as a card: hits on the left, multiplier on the right, the row matching the current result highlighted, and the RTP printed in the header at two decimal places. It changes with both the number of picks and the risk level, so it must update live as either changes. Zero-paying tiers are rendered in faint ink with "0×" rather than left out.
>
> **The result panel**, in the gold variant: "You hit 3 of 6" as the label, the payout at display size in gold, and the arithmetic beside it in muted mono — "5.0× on 120". Wins and losses use the same panel; a loss reads "You hit 1 of 6" with "0" and no gold. Never celebrate a loss with a consolation animation.
>
> **The draw animation** reveals numbers one at a time, roughly 120ms apart, hits landing with a brief scale. Under three seconds total, and skippable. Longer and the tenth round is a chore.
>
> **The fairness drawer** spans the full width below: server seed hash, client seed and nonce as three hairline-divided cells, a Rotate seed action, a Verify button, and two sentences explaining what the commitment means.

**Mobile keno:** the grid goes five across at 48px tall, the result panel moves above the grid so it is visible without scrolling, the paytable collapses to the four meaningful rows, and the bet controls become a sticky bar pinned to the bottom with the play button full width at 52px. The daily-limit line sits directly above that bar.

---

## 35. Wheel, dice and limbo

Three games, one screen skeleton. Same bet rail, same fairness drawer, same result panel — only the middle changes.

> **Wheel.** A segmented ring rendered as SVG, a fixed coiner at the top, the wheel rotating beneath it. Two controls in the rail: risk level as a three-way segmented control, and segment count. The segment colours encode multiplier bands — muted for a loss, brand for small wins, gold for the big one — and the same bands appear as a legend beneath, because the ring alone cannot be read precisely. Spin lasts about four seconds with a long ease-out; the landed segment holds lit for a beat.
>
> **Dice.** A horizontal track from 0 to 100 with a draggable target marker, the roll landing as a second marker on the same track. The rail shows the three numbers that move together — target, win chance, payout multiplier — recalculating as the slider moves, plus an over/under toggle. The whole game is that one relationship, so make those three figures large and adjacent.
>
> **Limbo.** A target multiplier input, one button, and a single number that counts up fast and stops. Cleared targets settle in gold, missed ones in muted ink. Beneath, a small strip of the last twenty results as coloured ticks — the only history display that earns its place on these screens, because limbo players read streaks.
>
> All three: same bet rail, same "Play for X MC" label, same result panel, same fairness drawer. Building them as one component with a swappable middle is the difference between three days and three weeks.

---

## 36. Fairness and verification

> Build the verifier as a public page that works whether or not you are signed in.
>
> Three inputs — server seed, client seed, nonce — plus a game selector, and a Verify button. The result shows the outcome recomputed from those values, side by side with what the site recorded, and a plain statement of whether they match.
>
> Above the form, the explanation in four sentences and a worked example with real values from a revealed seed. Below it, the exact hashing steps in plain language, so a technical viewer can reimplement the check themselves. Someone doing that and posting the result in Discord is the best advertising this feature can get.
>
> From a round row anywhere on the site, Verify opens this page with the three fields prefilled.

---

## 37. Limits and self-exclusion

> Build this as its own block on the account page, not a settings sub-page.
>
> **Daily wager limit** with the current value, the amount used today, and a plain note that a decrease applies immediately while an increase takes 24 hours. When an increase is pending, show it as "Rising to 1,200 in 14 hours" with a Cancel action — the cancel must always work instantly.
>
> **Session reminder** as an interval selector, defaulting to one hour, and a preview of the reminder itself: time played, amount wagered, net position. Blunt numbers, no encouragement.
>
> **Turn games off** as a set of four buttons — a day, a week, a month, permanently. Confirming a period hides the games from the navigation and blocks every play endcoin server-side for that period, and the confirmation says plainly that it cannot be reversed early. The rest of the site keeps working normally throughout.
>
> Nothing on this block is styled as a warning or a penalty. It is a set of controls a sensible person uses, presented the way a sensible person would want to find them.

---

## 38. Admin — games

> Build the games admin as one screen with per-game config cards.
>
> Each card: enabled toggle, RTP, min and max bet, max win, and the paytable as editable rows. Everything is data, nothing is deployed. Preview shows the paytable as players will see it.
>
> **A live round feed** beneath, filterable by player and game, with the anomaly filters that matter: biggest wins today, longest win streaks, highest round counts per hour. Bots and exploits show up here before they show up in the balances.
>
> **The coin flow panel**, which is the number Matty actually needs: coins minted by watching this week against coins destroyed by the house edge. If the games drain faster than the stream mints, the site feels punishing; slower, and the shop inflates. One line each, weekly.
>
> **A kill switch** at the top of the page, owner-only, disabling every game instantly with a message shown in place of the lobby. You will want this the first time a paytable is wrong, and you will want it to work without a deploy.

---

## 39. States — games

| State | Where | Behaviour |
|---|---|---|
| Games not enabled | Nav, every game route | Section absent from the nav; direct URLs redirect to the opt-in gate |
| Daily limit reached | Lobby, every game | Bet controls disabled with the amount and the reset time stated; the rest of the site is untouched |
| Limit increase pending | Account, lobby | "Rising to X in N hours" with an always-available Cancel |
| Self-excluded | Everywhere | Games gone from the nav, endpoints refused, one line on the account page giving the end date |
| Insufficient coins | Bet rail | Play disabled, label reads "Not enough coins" with the shortfall, and a link to how coins are earned |
| Round in flight | Game screen | Controls locked until the server responds; a repeated tap can never place a second bet |
| Round failed | Game screen | The bet is returned, stated plainly, and the round appears in history as void |
| Seed rotated | Fairness drawer | Old server seed revealed with a link to verify every round played on it |
| Game disabled by admin | Lobby, game route | Card greys with "Temporarily unavailable"; in-progress rounds still settle |
| All games killed | Lobby | The lobby is replaced by a single message; no game is reachable |

---

## 40. Build order — games

**§36 fairness engine → §34 keno → §32 opt-in gate → §37 limits → §35 dice → §35 limbo → §35 wheel → §38 admin → §33 lobby polish.**

The fairness engine first, and not because it is the exciting part — because every game sits on it and retrofitting provable fairness to a game that already shipped means invalidating every round played before. It is also shared with the giveaway draw, so it pays for itself twice.

Keno second, since it is the only game with substantial interface work and it establishes the bet rail, the result panel and the fairness drawer that the other three inherit. The opt-in gate and limits come before any second game — the moment more than one game exists, people start playing seriously, and controls added afterwards arrive too late for whoever needed them.

Dice and limbo before the wheel: both are almost pure logic, so they prove the shared skeleton works with barely any new interface. The wheel needs real SVG and animation work and is the most likely to eat a day on easing curves.

Admin before the lobby polish, because the kill switch and the paytable editor are what let you run this safely in public, and a beautiful lobby you cannot turn off is worse than a plain one you can.
