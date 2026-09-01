# MattySpins Shop and Giveaways — Complete UI Specification

`/shop` and `/giveaways`. Companion to `MattySpins-LateNight-UI-Spec.md`, which holds the
tokens (§1), the type scale (§2), the light layer (§3), the motion system (§4) and the
primitives (§5). **Read those five first.** This document supersedes `Late Night` §24 and
§25, which were summaries.

Content, data and behaviour come from `MattySpins-UI-Requirements.md` §3 Shop and
Giveaways. Every rule in them survives.

**Routes:** `app/(site)/shop/page.tsx`, `app/(site)/shop/actions.ts`,
`app/(site)/giveaways/page.tsx`, `components/site/ShopItemCard.tsx`, `CoinBar.tsx`.

**Status, stated honestly:** Requirements marks both pages **shell only**. The shop
renders a catalogue and nothing can be redeemed; giveaways is the same. This document
specifies the finished pages, so parts of it describe UI for actions that do not exist
yet. §16 separates what can be built today from what waits on the shop, redemption and
giveaway tables.

---

## The organising principle

These are the two pages where **coins turn into something.** Every other page either
earns them, ranks them, or plays with them. Here they leave.

That gives both pages the same shape and one shared job:

```
   WHAT DO I HAVE?    the full coin bar, at the top, on both pages
        ↓
   WHAT CAN I GET?    the catalogue / the open giveaways
        ↓
   CAN I AFFORD IT?   the shortfall, the cap bar
        ↓
   IS IT FAIR?        the seed, on giveaways
        ↓
   WHERE DID IT GO?   → /me
```

**The balance is the heading on both pages.** On a page where coins are spent, the
balance is not a chrome element in the corner; it is the first thing on the page, at
`num-l`, because it is the number every decision below it is measured against.

---

## The three highest-value decisions

**1. Show the shortfall, not the price.** A card the viewer cannot afford renders
`1,240 MC short` in gold with a thin progress bar of their balance against the cost.
Telling someone how far away they are is useful. Greying out a price and walking away is
not. It is the same information and one of the two is a design.

**2. The seed hash lives on the giveaway card, not in a drawer.** Requirements puts the
published server seed hash in the card's own contents, and it belongs there: the claim
that a draw is fair is worthless if you have to go looking for the evidence. §8 also puts
the four-step timeline on the page, so "provably fair" stops being a phrase and becomes
something a viewer can follow.

**3. A past giveaway with no revealed seed is a danger row, not a blank cell.** The whole
promise is that the seed is revealed after the draw so anyone can recompute it. A missing
seed is a broken promise and the table should say so loudly rather than rendering an
empty column that nobody notices.

---

## A note on pressure

These pages ask someone to spend. The coins were earned by turning up, they cannot be
bought, and they have no cash value, so this is a loyalty catalogue rather than a store.
That does not make pressure tactics acceptable here.

**Banned on both pages, regardless of what a future admin panel makes possible:**

- **No artificial scarcity.** `3 left` renders only when stock is genuinely 3. No
  invented low-stock warnings, no `Selling fast`.
- **No fake urgency.** A countdown appears only against a real, stored end time. A shop
  item with no expiry gets no timer.
- **No loss framing.** `1,240 MC short` states a fact. `Don't miss out` does not.
- **No nudge toward playing to close a gap.** The shortfall never links to `/games`, and
  it never suggests a way to earn faster than showing up.

The progress bar in §3 exists because a goal you can see is easier to reach than one you
cannot, not because it makes anyone spend sooner.

---

## Screen inventory

**Shop**

1. Header and the full coin bar
2. Category chips
3. The item card, and its six states
4. The redeem flow
5. The closing note

**Giveaways**

6. Header and the fairness eyebrow
7. The active giveaway card
8. The seed, and the fairness timeline
9. The enter control, and its states
10. Past giveaways
11. The drawn state

**Both**

12. Responsive
13. The copy block
14. States to build
15. The self test
16. Build order, and what is blocked

---

## 1. Header and the full coin bar

> Build the shared page head used by both `/shop` and `/giveaways`. **It is the same
> component on both**, because a viewer moving between them should not have to re-find
> their balance.
>
> **The full coin bar**, per `Profile §10` and Requirements §2. A full width `.lit` panel,
> `--color-light-line` hairline, 96px tall, `--radius-card`, grid `auto 1fr auto`.
>
> - Coin mark at 26px.
> - **Balance at `num-l` in gold with the `MC` unit.** No currency symbol, ever.
> - Beneath it at 13px, the earning state and its multiplier with the reason, verbatim
>   from `Profile §10`: `Earning 2 MC every 3 minutes · 2× Sub`, or
>   `Earning paused · stream offline`, or `Link your Kick account to start earning`, or
>   `Sign in to start earning`.
> - Right: a ghost link, `Your ledger` → `/me`.
>
> **The balance counts on a tick**, 700ms, with the coin mark's Y-axis rotation. Same
> event, same treatment, as the nav bar and the profile header.
>
> **The unlinked state is gold hairlined** here too. Someone on the shop with no Kick link
> is looking at things they cannot reach yet and should be told why in the same words as
> everywhere else.
>
> Beneath the bar: the page eyebrow and heading at `display-m`.

---

## 2. Category chips

> Four chips, per Requirements: `Entries` · `Discord` · `Merch` · `Stream`, plus `All`
> first.
>
> Active chip is a blue filled box with `--color-light-ink` text. The rest are
> `--color-line-lit` outlines. 36px tall, `--radius-pill`, 14px label.
>
> **Each chip carries its count** at 11px mono in the chip, at 60% opacity: `Merch 4`.
> A category with nothing in it renders the chip at 45% opacity and is not clickable,
> rather than being removed. A chip row that changes length as stock moves is disorienting.
>
> **The row scrolls inside its own container under 768px** with masked edges. The page
> body never scrolls sideways.
>
> **Filtering does not animate the grid.** Cards swap in place. A staggered re-entrance
> on every chip tap makes a four-item catalogue feel slow.

---

## 3. The item card, and its six states

> Build the item card. Grid of three on desktop, two at 768px, one below.
>
> `.lit`, `--radius-card`, 20px padding, `min-height: 260px` so a short description does
> not make a card visibly smaller than its neighbours. **Every card in a row is the same
> height**; an uneven row of cards is the fastest way to look unfinished.
>
> **Contents, in order:**
> - The item's image or the coin mark at 48px, top left.
> - Name at `display-s`.
> - Description at 14px `--color-ink-2`, **clamped to three lines** with a `min-height`
>   reserving all three, so cards align whether the description is one line or three.
> - A spacer that pushes the footer down.
> - **Footer row**, grid `1fr auto`, baseline aligned: the cost at `num-m` in gold with
>   the coin mark and the `MC` unit, then the button.
>
> ### The six states
>
> | State | Card | Footer | Extra |
> |---|---|---|---|
> | **Affordable** | normal | primary `Redeem` | none |
> | **Not affordable** | normal | disabled | **shortfall + progress bar** |
> | **Out of stock** | 55% opacity | `Out of stock` pill, no button | no bar |
> | **On cooldown** | normal | mono countdown in place of the button | no bar |
> | **Already pending** | `--color-gold-line` hairline | `Pending` pill | ghost link to `/me` |
> | **Signed out** | normal, **fully visible** | primary `Sign in to redeem` | none |
>
> ### Not affordable, in detail
>
> The button is disabled and beneath it, at 13px mono in gold:
> **`1,240 MC short`**
>
> And across the card's **bottom edge**, a 3px bar: `--color-line` track with a gold fill
> at `balance / cost`, `--radius-pill`, transitioning over 400ms when the balance changes.
>
> **The figure is the shortfall, not the price.** The price is already in the footer. A
> second rendering of the price tells the viewer nothing they cannot see.
>
> **The bar never renders at 0%.** Below about 3% it renders a 3px minimum stub, so the
> element reads as a bar with almost nothing in it rather than as a missing element.
>
> ### Signed out
>
> **The catalogue renders in full, with every cost visible.** Requirements makes signed
> out first class here. Do not hide prices, do not blur cards, do not gate the grid. The
> catalogue is the argument for signing in, and hiding it removes the argument.
>
> ### Stock and cooldown
>
> - Stock renders **only when the item is genuinely limited**: `7 left` at 12px mono
>   `--color-muted`, beneath the name. An unlimited item shows nothing. See the note on
>   pressure.
> - Cooldown replaces the button with a mono countdown, `Available in 4h 12m`, and a
>   `label`-size line above it: `ON COOLDOWN`. When it reaches zero the card returns to
>   its normal state **on its own**, without a refresh.
>
> ### Hover
>
> Lift 4px and brighten the blue top edge, 240ms, **only on affordable and signed-out
> cards.** A card that lifts and then cannot be pressed is a broken promise. Out of stock,
> cooldown and pending cards do not move.

---

## 4. The redeem flow

> Requirements: a redeem action with a confirmation step, and a success state that points
> at the profile.
>
> ### The confirmation
>
> A dialog, `max-width: 460px`, `.lit`, centred. **No light drift, no entrance beyond a
> 200ms fade.** This is the moment coins leave.
>
> - Heading at `display-s`: `Redeem Discord VIP?`
> - The arithmetic, as three hairline-separated rows, mono and tabular, right aligned:
>   `COST 5,000 MC`, `BALANCE 12,480 MC`, **`AFTER 7,480 MC`** with the last in gold and
>   the others in `--color-ink-2`.
> - One line at 13px `--color-muted`: **A moderator fulfils this. You will see it move in
>   your profile.**
> - Buttons: `Confirm` primary, `Cancel` ghost. **No default focus on confirm.**
>
> Showing the balance after is the whole reason this dialog exists. A confirmation that
> only repeats the price is a speed bump; one that shows what is left is information.
>
> ### The success state
>
> **Not a toast.** The card itself transitions to the `Already pending` state in place
> over 400ms, and a `role="status"` line appears above the grid for 8 seconds:
>
> **Redeemed. Discord VIP is waiting on a moderator.** `Track it in your profile` →
> `/me`.
>
> The coin bar's balance counts down in the same frame. **Three things move together:**
> the balance, the card, and the status line. If they move at different times the page
> reads as three separate systems.
>
> ### Failure
>
> An inline `--color-danger-line` panel above the grid, never a toast:
> **That did not go through and no coins have left your balance.** Try again, or message a
> moderator in Discord if it keeps happening.
>
> The second half of the first sentence is the important half and it is never dropped.

---

## 5. The closing note

> Beneath the grid, centred, 14px `--color-muted`, capped at `62ch`, 40px of space above:
>
> **Coins cannot be bought. There are no packages and no payment path. Everything here was
> earned by turning up.**
>
> **It renders in every state**, including an empty catalogue and signed out. It is the
> sentence that makes the whole page make sense.
>
> **Empty catalogue:** a plain empty state above the note, no card:
> **Nothing in the shop right now.** New items get announced in Discord.

---

## 6. Header and the fairness eyebrow

> `/giveaways` reuses §1's coin bar exactly. Then:
>
> **Eyebrow**, `label` size, and it is doing real work:
> `ENTRIES COST COINS · DRAWS ARE PROVABLY FAIR`
>
> The second half is the reason anyone trusts this page, and Requirements puts it in the
> eyebrow rather than lower down. It stays above the fold.
>
> **Heading** `Giveaways` at `display-m`.
>
> **A one-line lede** beneath at 15px `--color-ink-2`, capped at `56ch`:
> **Every draw publishes its seed before entries open and reveals it after, so anyone can
> recompute who won.**

---

## 7. The active giveaway card

> Build the active giveaway card. **Two columns on desktop**, one below 768px. Each card
> is `.lit`, `--radius-card`, 24px padding, `--color-light-line` hairline.
>
> **Header row:** the prize at `display-s`, and the closes-in countdown at `num-m` mono
> tabular, right, gold. Under 60 seconds the countdown turns `--color-danger`.
>
> **The prize value**, when there is one, at `num-m` in gold with its currency symbol,
> beneath the title. **This is one of the few places on the site where a currency symbol
> and a coin figure appear on the same card**, so they are separated: the prize value sits
> in the header block and the entry cost sits in the footer block, with a hairline
> between them and their units always printed.
>
> ### The entries block
>
> The middle of the card, and the part a returning viewer reads.
>
> - `YOUR ENTRIES` at `label` size, then **`12 / 25`** at `num-m` mono tabular. The first
>   figure is blue, the slash and the cap are `--color-muted`.
> - **The cap bar** directly beneath: 4px, `--color-line` track, blue fill at
>   `yours / cap`, full width, `--radius-pill`. At cap the fill is full and switches to
>   gold.
> - Right of it, `TOTAL ENTRIES` at `label` size with the figure at `num-s` mono
>   `--color-ink-2`.
>
> **Total entries is never hidden**, including when it makes the odds look bad. A giveaway
> that conceals how many people entered is not one you can check.
>
> ### The footer
>
> Grid `1fr auto`, baseline aligned: `ENTRY COST` with the figure at `num-m` gold and the
> coin mark and `MC` unit, then the enter control (§9).

---

## 8. The seed, and the fairness timeline

> **The seed hash is on the card**, per Requirements, not in a drawer and not on a
> separate page.
>
> A hairline-separated strip across the card's bottom, 11px mono `--color-faint`:
>
> `SERVER SEED HASH · a4f9c2e1…` with a `CopyButton` at 12px.
>
> Beneath it, one line at 11px:
> **Published before entries opened, so the draw cannot be changed afterwards.**
>
> ### The fairness timeline
>
> A four-step rail, once per page rather than once per card, sitting between the lede and
> the first card. This is what turns "provably fair" from a phrase into something a viewer
> can follow.
>
> ```
>   ①  HASH PUBLISHED   ──  ②  ENTRIES OPEN  ──  ③  DRAW  ──  ④  SEED REVEALED
>      before anyone           coins buy          the seed      anyone can
>      could enter             entries            picks it      recompute it
> ```
>
> Four nodes on a 2px `--color-light-line` rail, each with a blue dot, a `label`-size
> title and one line of 12px `--color-muted` beneath. The steps a given giveaway has
> reached are blue; the rest are `--color-line`.
>
> **On a page with several giveaways at different stages the rail is generic**, all four
> nodes in `--color-line-lit`, describing the process rather than any one draw. Per-card
> state lives on the card.
>
> **A `Verify a draw` ghost link** sits at the rail's end, to `/verify`.

---

## 9. The enter control, and its states

> Requirements lists seven states for this page. The enter control is where five of them
> land.
>
> | State | Control | Extra |
> |---|---|---|
> | **Running, can afford** | primary `Enter · 500 MC` | none |
> | **You have entries** | primary `Enter again`, and the entries block shows `12 / 25` | none |
> | **At your cap** | disabled, reads `At your cap` | cap bar full and gold, line beneath: `You've entered the maximum for this one.` |
> | **Not enough coins** | disabled, reads `Not enough coins` | **shortfall in gold + progress bar**, exactly as the shop (§3) |
> | **Signed out** | primary `Sign in to enter` | card fully visible, entries block shows total only |
> | **Drawn** | replaced, see §11 | |
> | **None running** | no cards, see below | |
>
> **The shortfall treatment is identical to the shop's**, deliberately. It is the same
> question in two places and it should not have two answers.
>
> ### Entering
>
> **A confirmation step**, same shape as §4, because coins leave:
> - `Enter this giveaway?`
> - `COST 500 MC`, `BALANCE 12,480 MC`, **`AFTER 11,980 MC`**
> - `YOUR ENTRIES AFTER 13 / 25`
> - One line: **Entries are final and are not refunded if you change your mind.**
> - `Confirm` primary, `Cancel` ghost, **no default focus on confirm.**
>
> That refund line is not optional. Coins are non-refundable once entered and a viewer
> should learn that before, not after.
>
> **On success**, three things move in the same frame: the coin bar's balance counts down,
> the entries figure counts up, and the cap bar fills. A `role="status"` line above the
> grid for 6 seconds: **You're in. 13 entries.**
>
> **Multiple entries at once are not offered.** No quantity stepper, no `Max` button. One
> entry per press is friction, and on a page that spends coins that friction is correct.
>
> ### None running
>
> A plain empty state, no card, above the past table:
> **No giveaways running right now.** They usually open on stream and get announced in
> Discord. Past draws are below, with their seeds.
>
> **The past table still renders beneath it.** An empty giveaways page that shows nothing
> at all wastes the one thing that proves the page works.

---

## 10. Past giveaways

> A mono table, and **a different skeleton to the cards above** so the two never blur.
>
> Columns: `PRIZE`, `DRAWN`, `ENTRIES`, `COST`, `WINNER`, `SEED`. Header row at `label`
> size with a hairline beneath. Rows 56px, hairline separated, newest first, no zebra
> striping.
>
> - Prize at 14px `--color-ink-2`.
> - Drawn date at 13px mono `--color-faint`.
> - Entries and cost at `num-s` mono tabular, right aligned, cost in gold with `MC`.
> - **Winner masked**, same treatment and same reason as the leaderboard
>   (`Leaderboard`, the note on masked usernames): `matt••••ns`.
> - **Seed**: the revealed server seed truncated to 16 characters at 12px mono, with a
>   `CopyButton` and a `Recompute` ghost link that prefills `/verify` for that draw.
>
> ### The row that must be loud
>
> **A past giveaway with no revealed seed renders as a `--color-danger-line` row**, with
> the seed cell reading `NOT PUBLISHED` in `--color-danger` and no copy button.
>
> It is not an empty cell and it is not a `—`. The entire promise of this page is that the
> seed is revealed after the draw so anyone can recompute it. A missing one is a broken
> promise, and a table that renders it as whitespace hides exactly the thing a sceptical
> viewer came to check.
>
> **Table footer** at 12px `--color-faint`:
> **Every draw stays here with its seed. Nothing is removed.**
>
> **Empty:** **No draws yet.** The first one appears here once a giveaway closes.
>
> **The table scrolls inside its own container under 768px**, masked edges, and the page
> body never scrolls sideways.

---

## 11. The drawn state

> When a giveaway has closed but is still on the page, its card enters the drawn state
> rather than disappearing.
>
> - `--color-gold-line` hairline, the countdown replaced by the word **`Drawn`** in gold.
> - The entries block is replaced by the winner: avatar at 36px, **masked username** at
>   16px, and `WINNER` at `label` size above.
> - **If the viewer won**, the card takes a blue hairline, a `YOU WON` pill in blue,
>   and a primary button: `See what happens next` → `/me`. Their own username is **not
>   masked to them**; the mask protects other people on a public page.
> - The seed strip (§8) now shows the **revealed seed** rather than the hash, with a
>   `Recompute this draw` ghost link.
>
> **The card holds on the page for 48 hours after the draw**, then moves to the past
> table. A winner should not have to hunt through an archive on the day they won.

---

## 12. Responsive

**Two breakpoints only: below 768px, and 1024px and up.** Requirements §7.

| Block | ≥1024 | <768 |
|---|---|---|
| Coin bar | `auto 1fr auto`, ledger link right | Stacked, balance and state left, link beneath |
| Category chips | Full row | Scrolls in its own container, masked edges |
| Shop grid | 3 across | 1 across |
| Item card | `min-height: 260px`, 3-line description reserved | Same, description still 3 lines reserved |
| Fairness rail | 4 nodes horizontal | **4 nodes vertical**, rail down the left |
| Giveaway cards | 2 across | 1 across |
| Past table | Full table | Scrolls in its own container |
| Dialogs | 460px centred | Full width minus 20px, bottom sheet |

**Phone specifics.**

- The fairness rail goes vertical rather than shrinking. Four nodes across 335px is
  unreadable and the vertical form is better anyway.
- `min-width: 0` on every card grid child holding a name, a winner or a seed.
- The seed strip truncates further on mobile, to 10 characters, and the copy button
  always copies the full value.
- Every control at least 44px under `(pointer: coarse)`, including the chips.
- Confirmation dialogs become bottom sheets, and **confirm still never has default
  focus**.
- Body padding reserves the tab bar.

---

## 13. The copy block

Every viewer facing line, verbatim.

```
SHARED COIN BAR
out        Sign in to start earning
no kick    Link your Kick account to start earning
offline    Earning paused · stream offline        [see Profile §10 note]
live       Earning 2 MC every 3 minutes · 2× Sub
frozen     Earning is paused on your account
link       Your ledger

SHOP
title      Shop
chips      All · Entries · Discord · Merch · Stream
cost       5,000 MC
short      1,240 MC short
stock      7 left
cooldown   ON COOLDOWN · Available in 4h 12m
buttons    Redeem · Sign in to redeem · Out of stock · Pending
pending    Track it in your profile

confirm    Redeem Discord VIP?
           COST 5,000 MC · BALANCE 12,480 MC · AFTER 7,480 MC
           A moderator fulfils this. You will see it move in your profile.
           Confirm · Cancel

success    Redeemed. Discord VIP is waiting on a moderator.
fail       That did not go through and no coins have left your balance. Try
           again, or message a moderator in Discord if it keeps happening.

empty      Nothing in the shop right now. New items get announced in Discord.
close      Coins cannot be bought. There are no packages and no payment path.
           Everything here was earned by turning up.

GIVEAWAYS
eyebrow    ENTRIES COST COINS · DRAWS ARE PROVABLY FAIR
title      Giveaways
lede       Every draw publishes its seed before entries open and reveals it
           after, so anyone can recompute who won.

rail       HASH PUBLISHED   before anyone could enter
           ENTRIES OPEN     coins buy entries
           DRAW             the seed picks it
           SEED REVEALED    anyone can recompute it
rail link  Verify a draw

card       YOUR ENTRIES · TOTAL ENTRIES · ENTRY COST
seed       SERVER SEED HASH · a4f9c2e1…
seed line  Published before entries opened, so the draw cannot be changed
           afterwards.

buttons    Enter · 500 MC · Enter again · At your cap · Not enough coins ·
           Sign in to enter
cap        You've entered the maximum for this one.

confirm    Enter this giveaway?
           COST 500 MC · BALANCE 12,480 MC · AFTER 11,980 MC
           YOUR ENTRIES AFTER 13 / 25
           Entries are final and are not refunded if you change your mind.
           Confirm · Cancel
success    You're in. 13 entries.

drawn      Drawn · WINNER · YOU WON
won        See what happens next
recompute  Recompute this draw

none       No giveaways running right now. They usually open on stream and get
           announced in Discord. Past draws are below, with their seeds.

PAST TABLE
cols       PRIZE · DRAWN · ENTRIES · COST · WINNER · SEED
missing    NOT PUBLISHED
footer     Every draw stays here with its seed. Nothing is removed.
empty      No draws yet. The first one appears here once a giveaway closes.
link       Recompute
```

**Copy gate:** zero em dashes, zero stock words, run before either page is shown. The `…`
in a truncated hash is an ellipsis and is fine.

**Requirements §8 checks specific to these pages:**
- **Never a currency symbol on a coin figure.** Every cost, shortfall and balance carries
  `MC`. The only currency figure is a giveaway's prize value, and §7 keeps it in a
  different block from the entry cost.
- **Never imply coins can be bought.** The closing note (§5) states it, and there is no
  quantity stepper, no bundle, no `Buy more`.
- **Say what a thing is, not how it feels.** `1,240 MC short`, never `Almost there!`.

---

## 14. States to build

| State | Where | Behaviour |
|---|---|---|
| Loading | Both | Skeleton at final size, **no layout jump**. Card heights reserved |
| **Signed out** | Both | **Catalogue and giveaways fully visible with all costs.** Buttons read `Sign in to…`. Never gate the grid |
| Signed in, no Kick | Coin bar | Gold hairline, `Link your Kick account to start earning` |
| Affordable | Shop card | Primary `Redeem`, hover lifts |
| **Not affordable** | Shop card, giveaway card | **Shortfall in gold + progress bar.** Never a greyed price alone |
| Balance changes while on page | Both | Progress bars transition over 400ms, buttons re-enable |
| Out of stock | Shop card | 55% opacity, pill, **no hover lift** |
| On cooldown | Shop card | Countdown replaces the button, **returns to normal on its own at zero** |
| Already pending | Shop card | Gold hairline, `Pending` pill, link to `/me` |
| Redeem confirmed | Shop | **Balance, card and status line all move in the same frame** |
| Redeem failed | Shop | Inline danger panel, **and the sentence that no coins left** |
| Empty catalogue | Shop | Empty state, **and the closing note still renders** |
| Empty category | Shop | Chip at 45%, not clickable, not removed |
| None running | Giveaways | Empty state, **past table still renders beneath** |
| You have entries | Giveaway card | `12 / 25`, cap bar partial, `Enter again` |
| **At your cap** | Giveaway card | Bar full and gold, disabled, line naming why |
| Entry confirmed | Giveaways | Balance down, entries up, cap bar fills, **same frame** |
| Drawn, you did not win | Giveaway card | Gold hairline, `Drawn`, masked winner, revealed seed |
| **Drawn, you won** | Giveaway card | Blue hairline, `YOU WON`, **your own name unmasked**, link to `/me` |
| Drawn over 48h ago | Giveaways | Card gone, row in the past table |
| **Past draw, no seed** | Past table | **`NOT PUBLISHED` in danger on a danger row.** Never an empty cell |
| Empty past table | Giveaways | Plain empty state naming when the first row appears |
| Long item or winner name | Both | `min-width: 0`, truncates, **page never scrolls sideways** |
| No database | Both | Degrade to the empty states, not to zeros or blank grids |

---

## 15. The self test

1. Screenshots of both pages at **1440×900, 1280×800, 375×812**, signed in and signed
   out.
2. **Signed out must show every price and every entry cost.** Confirm nothing is blurred,
   greyed or gated.
3. **The shortfall, three ways:** just short, very short (bar at the 3% stub), and one
   coin short. Confirm the figure is the shortfall and not the price in all three.
4. **Change the balance while the page is open** and confirm the bars transition and the
   buttons re-enable without a reload.
5. **Let a cooldown reach zero on screen.** The card must return to normal on its own.
6. Redeem: confirm the balance, the card and the status line all move in **the same
   frame**, not in sequence.
7. **Break the redeem endpoint** and confirm the inline panel says no coins left the
   balance.
8. Every one of the six card states rendered side by side. Confirm only the affordable
   and signed-out ones lift on hover.
9. **Confirm every card in a row is the same height** with a one-line and a three-line
   description in the same row.
10. Enter a giveaway to the cap and confirm the bar turns gold and the control names why.
11. **Force a past draw with no seed** and confirm the danger row. This is the row most
    likely to be quietly rendered as whitespace.
12. Winner masking: confirm other people are masked and **the viewer's own win is not**.
13. The fairness rail at 375px: vertical, readable, four nodes.
14. **Search both pages for a currency symbol.** The only one should be a giveaway prize
    value, and it should not share a block with an entry cost.
15. **Search for pressure copy.** No `Almost there`, no `Selling fast`, no timer without a
    real end time, no link from a shortfall to `/games`.
16. Both dialogs at 375px as bottom sheets, with no default focus on confirm.
17. Category chips scrolling in their own container. Body must not scroll sideways.
18. Reduced motion on: bars set instantly, no counting, no lifts. Every state still
    legible.
19. Console clean at both breakpoints.
20. **The fresh eyes pass.** Would someone who has never seen this believe the draw is
    fair, and could they check it themselves without asking?

---

## 16. Build order, and what is blocked

**Requirements marks both pages shell only.** The catalogue and the giveaway cards render;
nothing can be redeemed or entered. So the work splits.

### Buildable today, against the existing shells

```
§1 coin bar             shared, and it is the heading on both pages
§2 category chips
§3 item card            all six states, driven by props, no action needed
§5 closing note
§6 header + lede
§7 giveaway card        display only
§8 seed strip + rail    the fairness story is presentation, not action
§10 past table          including the NOT PUBLISHED danger row
§11 drawn state         display only
§12 responsive
```

That is most of both pages, and all of the design risk. The shortfall, the six card
states, the fairness rail and the danger row are all presentation and none of them waits
on a table.

### Blocked on the shop, redemption and giveaway tables

```
§4 the redeem flow      confirmation, success, failure, and the pending state's data
§9 the enter control    entering, the cap, and the entries figures being real
```

**Build the blocked pieces behind a flag with fixture data**, so the dialogs, the
same-frame balance change and the failure panel are all exercised before the tables
land. The three-things-move-together moment in §4 is the part most likely to be built as
three separate updates, and finding that out with real data is finding it out late.

**§3's six states come before anything else on the shop.** They are the page, and five of
the six are states a first build tends to skip.

**§10's danger row comes before §9's enter control.** A viewer can survive a page where
entering is not wired up yet. A page that quietly hides a missing seed undermines the one
claim these pages make.
