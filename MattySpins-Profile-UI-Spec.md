# MattySpins Profile — Complete UI Specification

`/me`, the Kick verification card, and the shared coin bar. Companion to
`MattySpins-LateNight-UI-Spec.md`, which holds the tokens (§1), the type scale (§2), the
light layer (§3), the motion system (§4) and the primitives (§5). **Read those five
first.** This document supersedes `Late Night` §7 and §26, which were summaries.

Content, data and behaviour come from `MattySpins-UI-Requirements.md` §3 Profile, the
Kick verification card, and §2 Coin bar. Every rule in them survives.

**Routes:** `app/(site)/me/page.tsx`, `components/site/ProfileSidebar.tsx`,
`ProfileMobile.tsx`, `Ledger.tsx`, `Verification.tsx`, `CoinBar.tsx`. **Presentation
only.** The ledger query, the verification polling, the redemption actions and the
deletion flow are untouched.

---

## The organising principle

Every other page is about Matty, the board, or the games. **This one is about the
viewer**, and it is the only page where they see their own name.

So the light centres on **them**: the key gradient shifts from behind the hero player to
behind the header card. It is a small move and it is the page's whole tone.

```
   WHO AM I HERE?     header card, tier, multipliers        §1
   WHAT DO I HAVE?    balance, stat tiles                   §1 §2
   AM I EARNING?      quick settings, the Kick card         §3 §9
   WHERE DID IT GO?   ledger, redemptions, claims           §4 §5 §6
   HOW DO I STOP?     play settings, self-exclusion         §7
   HOW DO I LEAVE?    account deletion                      §8
```

The page runs **top to bottom from celebration to control**. It opens with your balance
and it closes with turning games off and deleting your account, and that order is
deliberate: the exits are never hidden, and they are never the first thing you see
either.

---

## The three highest-value decisions

**1. The Kick verification card is the most important component on this site.**
Requirements says so plainly: it is the first thing anyone does, and it sets their
expectation of whether the whole thing works. Four states, one card, and **the waiting
state polls and updates itself so the viewer never refreshes.** If someone has to press
F5 to find out whether their code worked, the site has told them it is broken. §9 is the
longest section in this document for that reason.

**2. Self-exclusion is reachable on every viewport.** Requirements calls a desktop-only
self-exclusion a responsible-gambling failure rather than a layout bug, and it is right.
So the play settings block is **never** collapsed behind a desktop-only sidebar, never
behind a tab that is hidden on mobile, and never below a lazily loaded boundary. §7 and
§11 both enforce this and the self test checks it at 375px.

**3. The ledger groups watch ticks by session.** Forty rows of `+1 MC` three minutes
apart is not a record, it is noise, and it buries the rows that matter. A session
collapses into one row reading what it actually was, `Watched 2h 14m · 44 ticks`, and
expands on click. This is a disclosure, not a filter: the individual ticks are always
there, one tap away, because it is an accounting record and nothing may be unavailable.

---

## A note on money

**There is no deposit and no withdraw on this site, anywhere, ever.** Requirements states
it as a rule for this page, and it has a design consequence that goes beyond not
building the buttons:

- **No affordance on this page may be shaped like a cash control.** No `+` beside the
  balance. No `Top up`. No currency symbol anywhere near a coin figure. No amount field
  next to the balance panel.
- **Coin figures always carry `MC` and never a currency symbol.** Prize claims are the one
  exception on this page: a prize is real money and carries its currency symbol, and it
  sits in its own section (§4) so the two are never adjacent.
- **The line is stated, not implied.** The header card carries it verbatim: coins are
  earned by watching, cannot be bought, sold, transferred or withdrawn.

A viewer scanning this page should be unable to find anything that looks like a wallet,
because it is not one.

---

## Screen inventory

1. The header card
2. Stat tiles
3. Quick settings
4. Prize claims
5. Coin history
6. Redemptions
7. Play settings, and self-exclusion
8. Account, and deletion
9. **The Kick verification card**
10. The coin bar (shared)
11. Responsive
12. The copy block
13. States to build
14. The self test
15. Build order

---

## 1. The header card

> Build the header card. **The room's key gradient shifts to sit behind it**, so the
> light on this page originates from the viewer rather than from the player. It is the
> only page where that happens and it should not be announced, only felt.
>
> Full width, `.lit`, `--color-light-line` hairline, `--radius-card`, 32px padding.
>
> **Desktop grid `1fr auto`**, the identity block left and the balance panel right,
> separated by a vertical hairline at 24px inset.
>
> ### Identity, left
>
> - Avatar at 72px, `--radius-pill`, with a 2px `--color-line-lit` ring.
> - Username at `display-m`. **`min-width: 0` on this grid child**, or a long handle
>   pushes the page sideways.
> - Beneath, a row of metadata at 12px mono `--color-faint`, hairline separated with
>   `·`: `MEMBER SINCE MAR 2025`, and `KICK · mattyfan99` when linked.
> - **The tier badge** sits beside the username, baseline aligned: a pill at 11px mono
>   uppercase. `MEMBER` in `--color-line-lit` outline, `SUB` in blue outline, `VIP` in
>   gold outline.
>
> ### The multiplier tags
>
> A row of pills beneath, and **they show what applies and what does not.**
>
> - The **active** multiplier is a filled blue pill: `2× · SUB`.
> - Any other tier the viewer holds renders as a `--color-line` outline pill at 55%
>   opacity: `2.5× · VIP`.
> - Beneath the row, one line at 12px `--color-muted`:
>   **Multipliers never stack. The highest one applies.**
>
> That sentence lives here rather than only in the homepage coin rules, because this is
> where a VIP who also subs looks to find out why they are not on 5×.
>
> ### The balance panel, right
>
> - `BALANCE` at `label` size.
> - The figure at `num-l` in gold with the `MC` unit. **No currency symbol.**
> - Beneath at 13px `--color-muted`, capped at `42ch`, verbatim:
>   **Earned by watching. Cannot be bought, sold, transferred or withdrawn.**
> - A primary button: `Spend them` → `/shop`.
>
> **Nothing else in this panel.** No `+`, no top-up, no amount field. See the note on
> money above.
>
> **The balance counts on a tick** the same way the coin bar does (§10), over 700ms, and
> the coin mark takes one Y-axis rotation. It is the same event in two places and it must
> look the same in both.
>
> ### Not linked to Kick
>
> When there is no Kick link the balance panel gains a `--color-gold-line` hairline and a
> line above the button: **Coins are blocked until you link Kick.** The button becomes
> `Link Kick` and scrolls to §9 rather than going to the shop.
>
> ### Frozen
>
> `--color-danger-line` hairline on the whole card, and a line above the button:
> **Earning is paused on your account.** No further explanation here; the reason belongs
> in whatever notice was sent, not on a profile card.

---

## 2. Stat tiles

> Build four tiles. **Here four equal boxes are correct**, and this is the only place on
> the site where that is true, because these four figures are genuine peers.
>
> Grid of four on desktop, two by two under 768px. Each `.lit`, 96px tall, label at
> `label` size above and figure at `num-m` below, left aligned, baseline consistent
> across all four.
>
> | Tile | Figure | Colour |
> |---|---|---|
> | `LIFETIME EARNED` | mono + `MC` | gold |
> | `EARNED THIS WEEK` | mono + `MC` | gold |
> | `COINS SPENT` | mono + `MC` | `--color-ink-2` |
> | `NET FROM GAMES TODAY` | mono + `MC`, signed | gold above zero, `--color-danger` below |
>
> **Net carries its sign always**, `+240 MC` or `−1,120 MC`, using a proper minus sign
> rather than a hyphen so it aligns in tabular figures.
>
> **Net at exactly zero is `0 MC` in `--color-ink-2`**, not gold and not red. A flat day
> is a real result and colouring it either way is a lie.
>
> **Self-excluded or games off:** the fourth tile renders `—` with a 12px line beneath,
> `Games are off`. It is not removed, because a missing fourth tile makes the row look
> broken.
>
> **No entrance, no counting.** These are reference figures, not a scoreboard.

---

## 3. Quick settings

> Build quick settings as **four rows in one lit panel**, hairline separated, 64px each.
> Grid `36px 1fr auto`: a mark, then the label and state stacked, then the action.
>
> | Row | State | Action |
> |---|---|---|
> | Discord | `Signed in as samhith#0001` | `Sign out`, ghost |
> | Kick | `Verified as mattyfan99` **or** the unlinked line below | `Manage` / `Link`, ghost |
> | Pending redemptions | `2 waiting on a moderator` or `Nothing pending` | `View`, ghost, scrolls to §6 |
> | Games | `On` or `Off until 14 March` or `Off permanently` | `Change`, ghost, scrolls to §7 |
>
> **The unlinked Kick row is the loudest thing in this panel**, and it should be:
> `--color-gold-line` hairline on that row alone, the mark in gold, and the state reading
> verbatim: **Not linked. Coins are blocked.**
>
> Requirements words this as "Not linked, coins are blocked" and the bluntness is the
> point. A soft phrasing here costs someone a week of earning.
>
> **Every row's action is a real control**, keyboard reachable, with a visible focus ring.
> None of these rows is clickable as a whole; the action is the target, so a mistaken tap
> on a row does not sign anyone out.

---

## 4. Prize claims

> Build the prize claims block. **This is the one place on this page where a currency
> symbol appears**, because a leaderboard prize is real money.
>
> **An open claim** renders as one lit card with a `--color-gold-line` hairline:
> - `YOUR CLAIM` at `label` size.
> - Grid of four, hairline separated: `REFERENCE` (mono, with a `CopyButton`), `PERIOD`,
>   `RANK`, `AMOUNT` (gold, with its currency symbol).
> - A status pill, right: `PENDING CHECK` gold outline, `APPROVED` blue outline,
>   `PAID` filled blue, `NOT UPHELD` `--color-danger` outline.
> - Beneath, one line per status at 13px `--color-muted` saying what happens next. For
>   `NOT UPHELD` it names what to do: message a moderator in Discord.
>
> **Empty state**, plain, no card:
> **No claims open.** When a board freezes and you are on it, you claim your position from
> the leaderboard.
>
> **Paid claims stay listed** beneath the open one, collapsed under a
> `Past claims (3)` disclosure. Nothing about money is ever removed from view.

---

## 5. Coin history

The accounting record, and it should look like one.

> Build the ledger. **No light, no card.** Flat `--color-canvas` with a hairline above,
> a `label` heading, and rows. Every other block on this page is a lit panel; this one is
> a bank statement and the difference should be visible at a glance.
>
> **Row grid `92px 1fr 100px 110px`**, 48px tall, hairline separated:
>
> | Column | Content |
> |---|---|
> | Date | 12px mono `--color-faint`, `12 Mar` |
> | Reason | 14px `--color-ink-2` |
> | Delta | `num-s` mono tabular, right, **signed**. Gold `+`, `--color-ink-2` `−` |
> | Balance | `num-s` mono tabular, right, `--color-muted` |
>
> **The running balance column is the reason this is trustworthy** and it is never
> dropped for width. On mobile it stays and the reason column truncates instead.
>
> ### Grouped watch sessions
>
> **Watch ticks are grouped by session, not listed as forty three-minute rows.**
>
> A session renders as one row:
> - Reason: `Watched 2h 14m` then, at 12px `--color-faint`, `44 ticks · 2× sub`
> - Delta: the session total, `+98 MC`
> - A chevron at the row's right, rotating 90° when open.
>
> **On click it expands in place**, revealing the individual ticks as 36px sub-rows,
> indented 92px, at 12px mono, with their own timestamps and deltas. The parent row's
> balance column shows the balance **after** the session; the sub-rows show the running
> balance through it, so the two always reconcile.
>
> **It is a disclosure, not a filter.** Every tick is present in the DOM's expanded state
> and none is discarded. This is an accounting record and nothing in it may be
> unavailable.
>
> Expansion uses the measure-set-transition-release pattern over 280ms, with **no scroll
> jump**. `aria-expanded` on the row, `role="button"`, Space and Enter both toggle it.
>
> ### Everything else is one row each
>
> The hour bonus, shop spends, game bets, game payouts, prize credits, adjustments. Each
> names itself plainly: `Full hour bonus`, `Redeemed: Discord VIP`, `Keno · lost`,
> `Keno · won 4.25×`, `Moderator adjustment`.
>
> **A moderator adjustment always carries its note** as a 12px `--color-muted` line under
> the reason. A balance change with no stated cause is the fastest way to lose someone's
> trust in the whole ledger.
>
> ### Paging and empty
>
> Thirty rows, then a ghost `Show older` that appends rather than navigating. Empty:
> **Nothing here yet.** Your first coins land three minutes after you talk in Matty's Kick
> chat.

---

## 6. Redemptions

> Build the redemptions list. One row per redemption, `.lit` panel, hairline separated,
> 64px, grid `44px 1fr auto auto`.
>
> - The item's thumbnail or the coin mark at 32px.
> - Item name at 15px, with the date beneath at 12px mono `--color-faint`.
> - Cost at `num-s` gold with `MC`, right aligned.
> - Status pill: `PENDING` gold outline, `APPROVED` blue outline, `FULFILLED` filled
>   blue, `REFUNDED` `--color-line-lit` outline, `DECLINED` `--color-danger` outline.
>
> **A moderator note, when there is one, renders as a full-width sub-row** beneath at 13px
> `--color-ink-2` on `--color-panel-2`, prefixed `Moderator:`. It is never a tooltip and
> never truncated. A declined redemption with a hidden reason generates a support message
> every time.
>
> **Refunded rows show the refund in the ledger too**, and the row links to it:
> `See in your history`, ghost, scrolling to and briefly highlighting that ledger row.
>
> **Empty state:**
> **Nothing redeemed yet.** The shop is where coins go.

---

## 7. Play settings, and self-exclusion

**Requirements: self-exclusion must be reachable on every viewport. It was desktop-only
once, and that is a responsible-gambling failure, not a layout bug.** Everything in this
section is written to make that impossible to reintroduce.

> Build play settings as one lit panel with four blocks, hairline separated.
>
> **It is never inside a sidebar, never behind a tab, and never below a lazily loaded
> boundary.** It is a block in the main column at every width. That is the constraint and
> it outranks any layout preference.
>
> ### Today so far
>
> Three figures in a row, hairline separated, label above and figure below at `num-s`:
> `PLAYED` (round count), `WAGERED` (`MC`), `NET` (`MC`, signed, gold above zero and
> `--color-danger` below).
>
> It sits first in the block on purpose. Before offering to change anything, the panel
> says what today has actually been.
>
> ### Session reminder
>
> `REMIND ME EVERY` at `label` size, then a segmented control: `30 min` · `1 hour` ·
> `2 hours` · `Off`. Beneath at 13px `--color-muted`:
> **A quiet note on screen telling you how long you have been playing and what today is
> at. It never interrupts a round.**
>
> ### What you will see
>
> Three toggles, one row each, with the label left and the switch right: `Rounds played`,
> `Total wagered`, `Net for the day`. Each toggle **exposes its pressed state**
> (`aria-pressed`) and carries a real label, per Requirements §7.
>
> ### Turning games off
>
> **The self-exclusion control.** Four options as a vertical list of radio rows, not a
> dropdown, because a dropdown hides three of the four.
>
> | Option | Treatment |
> |---|---|
> | `For a day` | `--color-line-lit` outline |
> | `For a week` | `--color-line-lit` outline |
> | `For a month` | `--color-line-lit` outline |
> | **`Permanently`** | `--color-danger-line` outline, and it is visually separated by a hairline and 16px of space |
>
> Beneath the three timed options, one line at 13px `--color-muted`:
> **Games come back on by themselves when the time is up. Your coins, the board, the shop
> and the giveaways all keep working the whole time.**
>
> **Permanently requires a typed confirmation**, not a checkbox and not a second click.
> A dialog with the consequence stated in full and a field that must contain the word
> `PERMANENTLY`:
>
> **This cannot be undone by you or by a moderator.** Games leave the site for your
> account for good. Your coins, the board, the shop and the giveaways keep working. Type
> PERMANENTLY to confirm.
>
> No default focus on the confirm button. The confirm button stays disabled until the
> field matches exactly.
>
> **Once games are off**, this block's heading gains a gold state line:
> `Games are off until 14 March` or `Games are off permanently`, and the four options are
> replaced by a single `Turn games back on` button for the timed cases and by nothing at
> all for the permanent one.
>
> A ghost link sits at the block's foot in every state:
> `Read the responsible gambling page` → `/responsible`.

---

## 8. Account, and deletion

> Build the account block. Two things live here: the Kick verification card (§9) and
> deletion.
>
> ### Deletion
>
> A lit panel with a `--color-danger-line` hairline, at the very bottom of the page.
>
> Heading at `display-s`: **Delete your account**
>
> **The consequences render as two columns, not as a paragraph.** A paragraph buries half
> of this and the half it buries is the half people are surprised by.
>
> | `WHAT GOES, PERMANENTLY AND IMMEDIATELY` | `WHAT STAYS` |
> |---|---|
> | Your Discord link | Your ledger rows, anonymised, because they are the accounting record |
> | Your Kick link | Giveaways you have already won |
> | Your coin balance | Claims already paid |
>
> Left column headed in `--color-danger`, right column in `--color-muted`, hairline
> between them, stacked under 768px with the danger column first.
>
> Beneath both, one line at 13px:
> **Coins have no cash value. Deleting forfeits your balance and nothing is paid out for
> it.**
>
> A `--color-danger` outline button: `Delete my account`. It opens a dialog that repeats
> the two columns and requires the word `DELETE` typed. **No default focus on confirm.**
>
> **The two columns appear in both the panel and the dialog.** Someone who scrolled past
> the panel and clicked the button still sees the whole picture before the last step.

---

## 9. The Kick verification card

**The most important component on this site.** Requirements: it is the first thing anyone
does, and it sets their expectation of whether the whole thing works.

> Build it as **one card with four states**, `.lit`, `--radius-card`, 32px padding,
> `max-width: 620px`, sitting at the top of the account block (§8).
>
> **The card is the same box in all four states.** It does not change size, move, or swap
> for a different component. State changes happen inside it, so the page never jumps
> under someone who is mid-task.
>
> ### State 1 — Unlinked
>
> `--color-gold-line` hairline. This is the state that costs someone money, so it is the
> loudest of the four.
>
> Heading at `display-s`: **Link your Kick account**
>
> **Three lines, each with a mark at 16px**, at 15px `--color-ink-2`:
> 1. Coins are earned for being in Matty's Kick chat, so the site needs to know which
>    Kick account is yours.
> 2. It is one short code, typed in chat once. No password, nothing to install.
> 3. One Kick account per site account, both ways.
>
> Primary button, `lg`: `Generate my code`
>
> ### State 2 — Waiting
>
> `--color-light-line` hairline. **The code is the whole card.**
>
> - **The code at `num-xl`**, mono, uppercase, with `letter-spacing: .12em` so it is
>   readable across a room and transcribable by someone reading it off a second monitor.
>   Centred. A blue bloom behind it.
> - A `CopyButton` beneath, outline, reading `Copy code`.
> - **A live countdown** at `num-m` mono tabular beneath that, label above:
>   `EXPIRES IN`. Under 60 seconds it turns `--color-danger`.
> - The instruction at 16px, centred, capped at `44ch`:
>   **Type this in Matty's Kick chat.** Nothing else needed.
> - **The line that stops people refreshing**, at 13px `--color-muted` with a small
>   pulsing blue dot: **This page updates on its own when the bot sees it.**
> - **When Matty is offline**, one extra line in gold at 13px:
>   `Matty is offline right now, so the chat may be quiet. The code still works.`
>   *(Confirm this matches the bot's actual behaviour before shipping. If the bot does not
>   read offline chat, the line has to say so instead, and the card should say when he is
>   back.)*
>
> **The polling rule, and it is the point of the whole card.** Requirements: the waiting
> state polls and updates itself when the bot confirms, and the viewer must never have to
> refresh.
>
> - Poll on an interval, and **stop polling when the tab is hidden**, resuming on
>   `visibilitychange`. A hidden tab polling for ten minutes is wasted requests.
> - **On confirmation the card transitions to state 4 in place**, over 400ms: the code
>   fades, the check draws itself, the username fades in. No reload, no navigation, no
>   toast.
> - `aria-live="polite"` on the card's status region, so a screen reader user is told it
>   linked without having to go looking.
> - **If a poll fails**, the card does not change state and does not show an error. It
>   retries. A network blip must never look like a rejected code.
>
> ### State 3 — Expired
>
> **This is not an error state.** Requirements says so explicitly, and the design has to
> honour it: **no danger colour anywhere in this state.**
>
> `--color-line` hairline, the card at normal opacity.
>
> - The old code at `num-l`, `--color-faint`, **struck through**.
> - At 15px `--color-ink-2`, capped at `44ch`:
>   **Codes last ten minutes so they cannot be passed around.** Generating a new one takes
>   a second.
> - Primary button: `Generate a new code`
>
> Nothing here apologises and nothing here is red. Someone whose code expired did nothing
> wrong, and a red card tells them they did.
>
> ### State 4 — Linked
>
> `--color-line` hairline, quiet.
>
> - A blue check mark at 20px, then `Linked to mattyfan99` at `display-s`.
> - Beneath at 12px mono `--color-faint`: `VERIFIED 12 MARCH 2026`.
> - A ghost link: `Unlink`, which opens a confirm dialog naming the consequence:
>   **Unlinking stops your coins earning.** You can link again at any time, to this Kick
>   account or a different one.
>
> ### Motion
>
> The only animated thing in this card is the state 2 dot and the state 2 → 4 transition.
> **The code itself never animates.** A number someone is transcribing must hold still.

---

## 10. The coin bar

Requirements defines the coin bar in §2 Global chrome as a strip shown above coin-spending
pages. `Late Night §7` puts it in the nav as well, because the question it answers is one
a viewer has on every page. **Both exist and they say the same words.**

> **Two renders, one source of truth for the copy.**
>
> **Compact**, in the nav, on every page (`Late Night §7`).
> **Full**, a strip at the top of `/shop` and `/giveaways`, and the balance panel in §1
> here.
>
> **Four states, verbatim, per Requirements §2:**
>
> | State | Copy |
> |---|---|
> | Signed out | **Sign in to start earning** |
> | Signed in, no Kick link | **Link your Kick account to start earning** |
> | Linked, stream offline | **Earning paused — stream offline** |
> | Linked, live | **Earning 2 MC every 3 minutes** |
>
> *(The third line is Requirements' own wording and it is the one em dash permitted in
> shipped copy on this site. If the copy gate is to stay absolute, change it to
> `Earning paused · stream offline` and update Requirements to match. Flagging rather than
> silently rewriting a line another document specifies.)*
>
> **Every state also shows the multiplier and its reason** where one applies:
> `2× · Sub`, `2.5× · VIP`. Requirements asks for the reason, not just the number.
>
> **The balance is always shown**, in every state including offline. A viewer's coins are
> theirs whether or not the room is open, and hiding the figure when the stream ends reads
> as the site taking something away.
>
> **The frozen state** is not in Requirements' list but exists in the data:
> **Earning is paused on your account**, danger hairline, linking to `/me`.

---

## 11. Responsive

**Two breakpoints only: below 768px, and 1024px and up.** Requirements §7.

| Block | ≥1024 | <768 |
|---|---|---|
| §1 header | `1fr auto`, balance right | Stacked, balance panel full width beneath |
| §2 tiles | 4 across | 2 × 2 |
| §3 quick settings | 4 rows, action right | 4 rows, action right, state wraps beneath label |
| §4 claims | Grid of 4 fields | Stacked rows, label left figure right |
| §5 ledger | `92px 1fr 100px 110px` | `72px 1fr 96px`, **balance column stays**, reason truncates |
| §6 redemptions | Row grid | Stacked, status pill under the name |
| **§7 play settings** | **Main column block** | **Main column block** |
| §8 deletion | Two columns | Stacked, danger column first |
| §9 Kick card | 620px centred | Full width, code drops to `num-l` |

**The rule that outranks the table.** §7 play settings, including the self-exclusion
control, is **a block in the main column at every width**. It is never moved into
`ProfileSidebar.tsx`, never put behind a tab, and never rendered conditionally on a
breakpoint. If a future layout wants a sidebar on desktop, play settings does not go in
it.

`ProfileMobile.tsx` and `ProfileSidebar.tsx` exist today. **If either one renders play
settings and the other does not, that is the exact failure Requirements names.** The
safest fix is one shared block rendered once in the main column by both.

**Phone specifics.**

- `min-width: 0` on the username and on every ledger reason cell.
- The ledger never scrolls the page sideways; it truncates the reason column instead.
- The verification code at `num-l` still fits 375px at `.12em` tracking. Check it.
- Every control at least 44px under `(pointer: coarse)`, including the ledger's expand
  rows and the toggles.
- Body padding reserves the tab bar.

---

## 12. The copy block

Every viewer facing line, verbatim.

```
HEADER CARD
label      BALANCE
line       Earned by watching. Cannot be bought, sold, transferred or
           withdrawn.
button     Spend them
mult       Multipliers never stack. The highest one applies.
no kick    Coins are blocked until you link Kick.   [button: Link Kick]
frozen     Earning is paused on your account.
badges     MEMBER · SUB · VIP
meta       MEMBER SINCE MAR 2025 · KICK · mattyfan99

STAT TILES
           LIFETIME EARNED · EARNED THIS WEEK · COINS SPENT ·
           NET FROM GAMES TODAY
games off  Games are off

QUICK SETTINGS
discord    Signed in as samhith#0001            [Sign out]
kick ok    Verified as mattyfan99               [Manage]
kick no    Not linked. Coins are blocked.       [Link]
redeem     2 waiting on a moderator / Nothing pending   [View]
games      On / Off until 14 March / Off permanently    [Change]

PRIZE CLAIMS
label      YOUR CLAIM
fields     REFERENCE · PERIOD · RANK · AMOUNT
status     PENDING CHECK · APPROVED · PAID · NOT UPHELD
empty      No claims open. When a board freezes and you are on it, you claim
           your position from the leaderboard.
past       Past claims (3)

COIN HISTORY
session    Watched 2h 14m
           44 ticks · 2× sub
reasons    Full hour bonus · Redeemed: Discord VIP · Keno · lost ·
           Keno · won 4.25× · Moderator adjustment
more       Show older
empty      Nothing here yet. Your first coins land three minutes after you talk
           in Matty's Kick chat.

REDEMPTIONS
status     PENDING · APPROVED · FULFILLED · REFUNDED · DECLINED
note       Moderator:
link       See in your history
empty      Nothing redeemed yet. The shop is where coins go.

PLAY SETTINGS
today      PLAYED · WAGERED · NET
remind     REMIND ME EVERY · 30 min · 1 hour · 2 hours · Off
           A quiet note on screen telling you how long you have been playing
           and what today is at. It never interrupts a round.
show       Rounds played · Total wagered · Net for the day
off        For a day · For a week · For a month · Permanently
timed      Games come back on by themselves when the time is up. Your coins,
           the board, the shop and the giveaways all keep working the whole
           time.
perm       This cannot be undone by you or by a moderator. Games leave the site
           for your account for good. Your coins, the board, the shop and the
           giveaways keep working. Type PERMANENTLY to confirm.
state      Games are off until 14 March / Games are off permanently
back on    Turn games back on
link       Read the responsible gambling page

DELETION
title      Delete your account
col 1      WHAT GOES, PERMANENTLY AND IMMEDIATELY
           Your Discord link
           Your Kick link
           Your coin balance
col 2      WHAT STAYS
           Your ledger rows, anonymised, because they are the accounting record
           Giveaways you have already won
           Claims already paid
line       Coins have no cash value. Deleting forfeits your balance and nothing
           is paid out for it.
button     Delete my account          [dialog: type DELETE]

KICK CARD
1 title    Link your Kick account
1 point 1  Coins are earned for being in Matty's Kick chat, so the site needs
           to know which Kick account is yours.
1 point 2  It is one short code, typed in chat once. No password, nothing to
           install.
1 point 3  One Kick account per site account, both ways.
1 button   Generate my code

2 label    EXPIRES IN
2 instr    Type this in Matty's Kick chat. Nothing else needed.
2 poll     This page updates on its own when the bot sees it.
2 offline  Matty is offline right now, so the chat may be quiet. The code still
           works.                                          [CONFIRM BEHAVIOUR]
2 copy     Copy code

3 line     Codes last ten minutes so they cannot be passed around. Generating a
           new one takes a second.
3 button   Generate a new code

4 title    Linked to mattyfan99
4 meta     VERIFIED 12 MARCH 2026
4 unlink   Unlinking stops your coins earning. You can link again at any time,
           to this Kick account or a different one.

COIN BAR
out        Sign in to start earning
no kick    Link your Kick account to start earning
offline    Earning paused — stream offline          [see §10 note]
live       Earning 2 MC every 3 minutes
frozen     Earning is paused on your account
```

**Copy gate:** zero em dashes, zero stock words, run before this page is shown to anyone.
**One exception is flagged, not silently fixed:** the coin bar's offline line is
Requirements' own wording and contains an em dash. §10 proposes `Earning paused · stream
offline` and asks you to decide, rather than one document quietly overruling another.

**Requirements §8 checks specific to this page:**
- **Never a currency symbol on a coin figure.** Every `MC` figure on this page is
  symbol-free. Prize claims (§4) are the only currency figures and they live alone.
- **Never imply coins can be bought, sold, transferred or withdrawn.** No cash-shaped
  affordance anywhere (see the note on money).
- **Say what a thing is, not how it feels.** `Not linked. Coins are blocked.`, never
  `Almost there!`.

---

## 13. States to build

| State | Where | Behaviour |
|---|---|---|
| Loading | Whole page | Skeleton at final size, **no layout jump**. The header card's box is reserved |
| Signed out | Route | Redirects to sign in. `/me` has no signed-out render |
| **No Kick link** | Header, quick settings, §9 | Gold hairline in three places, `Coins are blocked`, card in state 1. **Prominent, per Requirements §6** |
| Frozen | Header, coin bar | Danger hairline, `Earning is paused on your account` |
| Net exactly zero | Tile 4 | `0 MC` in `--color-ink-2`. Neither gold nor red |
| Games off, timed | Tile 4, §3, §7 | Tile reads `—` with `Games are off`. §7 shows the date and `Turn games back on` |
| Games off, permanent | Tile 4, §3, §7 | Same, and §7 offers **no** way back on |
| Self-excluded | Nav, tab bar, §7 | Games link **absent** from the nav. §7 still fully reachable at every width |
| No claims | §4 | Plain empty state naming how a claim starts |
| Claim not upheld | §4 | Danger outline pill and a line naming what to do |
| Empty ledger | §5 | Empty state naming when the first coins land |
| Watch session collapsed | §5 | One row, `44 ticks`, session total, chevron |
| Watch session expanded | §5 | Sub-rows in place, **no scroll jump**, balances reconcile |
| Moderator adjustment | §5 | The note renders as a line under the reason. **Never hidden** |
| Declined redemption | §6 | Moderator note as a full-width sub-row. **Never a tooltip** |
| Refunded redemption | §6 | Links to the matching ledger row |
| **Kick, unlinked** | §9 | State 1, gold, three points, `Generate my code` |
| **Kick, waiting** | §9 | State 2, code at `num-xl`, live countdown, **polls and self-updates** |
| **Kick, waiting, tab hidden** | §9 | Polling stops, resumes on `visibilitychange` |
| **Kick, poll fails** | §9 | **No state change, no error.** Retries silently |
| **Kick, confirmed** | §9 | Transitions to state 4 **in place**, 400ms, no reload, `aria-live` announces |
| **Kick, expired** | §9 | State 3. **No danger colour anywhere.** Not an error |
| Kick, stream offline | §9 state 2 | Extra gold line. **Behaviour to be confirmed** |
| Kick, linked | §9 | State 4, check, username, date, `Unlink` |
| Deletion dialog | §8 | Repeats both columns, requires typed `DELETE`, no default focus |
| No database | Whole page | Degrades to empty blocks with their empty states, not to zeros |

---

## 14. The self test

1. Screenshots at **1440×900, 1280×800, 375×812**, linked and unlinked.
2. **The self-exclusion test, and it is the one that matters.** At **375px**, from a cold
   load, reach the `Permanently` option using only the phone. If it takes a horizontal
   scroll, a hidden tab, or a desktop layout, the page has the failure Requirements names.
   Repeat at 768px and 1024px.
3. **Check `ProfileMobile.tsx` and `ProfileSidebar.tsx` render the same play settings
   block.** If only one does, fix it by rendering one shared block, not by duplicating.
4. **The Kick card, all four states forced**, plus the two that are hard to force: hide
   the tab mid-wait and confirm polling stops and resumes; break the poll endpoint and
   confirm the card does **not** change state and does **not** show an error.
5. **Confirm the code never has to be refreshed.** Link from a second device and watch
   the first transition on its own.
6. **Confirm the expired state has no red in it.** Screenshot it and check.
7. The code at 375px: readable, copyable, and not wrapping.
8. Expand and collapse a watch session: **no scroll jump**, and the sub-row balances
   reconcile with the parent's.
9. Every status pill in §4 and §6 rendered, including `NOT UPHELD` and `DECLINED` with
   their notes.
10. **Search the page for a currency symbol.** The only ones should be in §4.
11. **Search the page for anything wallet-shaped**: a `+`, a `Top up`, an amount field
    near the balance. There should be none.
12. Deletion: both columns present in the panel **and** in the dialog, typed confirm
    required, no default focus.
13. `min-width: 0` proved with an absurd username and an absurd redemption item name at
    375px. The body must not scroll sideways.
14. Reduced motion on, then flipped mid session. The Kick card's polling and its state 2
    → 4 transition must still work with motion off; the transition becomes a cut.
15. Screen reader pass on the Kick card: confirm the link event is announced.
16. Console clean at both breakpoints.
17. **The fresh eyes pass.** Would someone who just signed up know what to do next within
    three seconds of landing here?

---

## 15. Build order

```
§9 the Kick card          the most important component on the site
§1 header card            everything above the fold, and the light shift
§3 quick settings         the second place the unlinked state has to shout
§10 coin bar              shared, and it says the same words as §1 and §3
§2 stat tiles             cheap
§7 play settings          the responsible-gambling block, before the nice-to-haves
§5 coin history           the grouped session is the hardest piece here
§6 redemptions
§4 prize claims
§8 account and deletion
```

**§9 comes first, before the page around it.** It is the first thing a new user does and
the polling behaviour is the part most likely to be got wrong. Building it inside a
finished page means discovering the polling problem last.

**§3 comes third, immediately after the header card**, because the unlinked state has to
be loud in three separate places and those three have to agree. Building them apart is
how they end up saying three different things.

**§7 comes before §5, §6 and §4** even though it is further down the page. Self-exclusion
is not a feature that waits for the ledger to be pretty, and putting it after the
nice-to-haves is how it ends up desktop-only again.

**§5's grouped watch session is the hardest single piece on this page.** Budget for the
expand-in-place with no scroll jump and for the balances reconciling; both are easy to
get almost right.
