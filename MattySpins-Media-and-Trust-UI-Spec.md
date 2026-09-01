# MattySpins Media and Trust — Complete UI Specification

`/wins`, `/clips`, `/verify`, `/casinos`, `/official`, and the four legal pages.
Companion to `MattySpins-LateNight-UI-Spec.md`, which holds the tokens (§1), the type
scale (§2), the light layer (§3), the motion system (§4) and the primitives (§5). **Read
those five first.** This document supersedes `Late Night` §22, §23, §29 and §30.

Content, data and behaviour come from `MattySpins-UI-Requirements.md` §3. Every rule in
it survives.

---

## The organising principle

Six pages, two opposite jobs, and the design flips completely between them.

```
   SHOW OFF                          PROVE
   ────────                          ─────
   /wins    the loudest page          /verify    the plainest page
   /clips   full bleed, big art       /casinos   a warning above the button
                                      /official  one sentence that stops a theft
                                      /legal     reference material, no light

   light on, numbers huge             light off, mono, no motion
```

**The flip is the point.** A site that looks the same when it is selling as when it is
proving is a site that is always selling. `/wins` should feel like a wall of trophies.
`/verify` should feel like a receipt. Somebody arriving at `/official` because they are
being scammed right now should land somewhere that reads as serious in the first half
second.

**One rule crosses both halves.** Requirements rule 2: every derived figure is computed,
never stored, and labelled. Every multiplier on `/wins` is calculated from the bet and
payout printed beside it, and the page says so. That sentence is what makes the wall
credible rather than decorative.

---

## The three highest-value decisions

**1. Aspect ratio is a data field, not an assumption.** Requirements says it outright for
clips: vertical reels must not be letterboxed into a horizontal box. A grid of 16:9 cards
with a 9:16 reel pillarboxed inside one is the single thing that makes a clips page look
scraped rather than curated. §6 specifies a grid that handles both natively.

**2. Nothing embeds until clicked, and the thumbnail is replaced in place.** No modal, no
navigation, no autoplay, and no third-party iframe loading before someone asks for it.
That is a performance decision, a privacy decision and a design decision at once, and it
applies identically on `/wins` and `/clips`.

**3. `/verify` gets no design.** No display face, no light, no motion, no entrances. It is
the page that proves the site is honest and it should look like evidence. Every other page
on this site is designed to make someone feel something; this one is designed to be
checked. Resisting the urge to style it is the work.

---

## Screen inventory

**Show off**

1. `/wins` header, sort and month chips
2. The record cards
3. The win card
4. `/wins` states and the closing note
5. `/clips` header and count
6. The clip grid, and aspect ratio
7. The clip card, and play in place

**Prove**

8. `/verify`
9. `/casinos`
10. `/official`
11. The legal template, and `/responsible`

**Both**

12. Responsive
13. The copy block
14. States to build
15. The self test
16. Build order

---

## 1. `/wins` header, sort and month chips

> Build the wall of fame header. **The room light is masked off this whole page**, exactly
> as the homepage wins band is, so the multipliers are the only lit things on it.
>
> - Eyebrow, `label` size: `REAL BETS, REAL PAYOUTS, ON STREAM`
> - Heading `Wall of fame` at `display-m`
> - **Sort chips**, right: `By multiplier` · `By win` · `By date`. Three, per Requirements,
>   not the two I had. Active chip blue filled.
> - **Month filter chips**, a second row beneath, **only when more than one month
>   exists**: `All` · `March` · `February` · `January`. When there is one month the row is
>   absent entirely, not rendered with a single chip.
>
> **Two chip rows need to read as two questions, not one long row.** The sort row sits
> with the heading; the month row sits below on its own line with a `label`-size prefix,
> `MONTH`, so nobody has to work out why there are seven chips.
>
> **Both rows scroll in their own containers under 768px** with masked edges.

---

## 2. The record cards

> Two cards, and they are the page's headline.
>
> **`BIGGEST MULTIPLIER EVER`** and **`BIGGEST WIN EVER`**. Side by side on desktop,
> stacked below 768px, `.lit` with a `--color-gold-line` hairline and a gold bloom behind
> each figure.
>
> - Label at `label` size in gold.
> - The figure at `num-xl`, gold, mono, tabular. The multiplier card shows `2,431×`; the
>   win card shows the payout with its coin or currency unit as stored.
> - Beneath: the slot name at `display-s`, then the date and source at 12px mono
>   `--color-faint`.
> - The clip thumbnail as a background at 20% with a scrim, so the numerals stay at 4.5:1.
> - The whole card is a link to that win's clip, and it lifts 4px on hover.
>
> **These are records, so they never change with the sort or the month filter.** A viewer
> filtering to February still sees the all-time records above, and the cards say
> `EVER` so that is unambiguous. Filtering the records to match the grid would make the
> word a lie.
>
> **Absent entirely when there are no wins.** Requirements: record cards absent, not
> rendered with dashes. Two empty trophy cards are worse than none.

---

## 3. The win card

> Build the win card. **Sized by its multiplier's rank in the current sort**, so a 2,431×
> is physically larger on the page than a 40×. The wall ranks itself visually before
> anyone reads a number.
>
> Three size tiers across a three column grid: the top three wins in the current sort span
> two columns, the next six span one at full height, the rest span one at reduced height.
> **Recomputed on every sort change**, so `By date` produces a different shape to
> `By multiplier` and the page visibly reorganises around the question asked.
>
> **Contents:**
> - The thumbnail filling the card, `object-fit: cover`, with a bottom scrim.
> - **A play control** at 44px, centred, `--color-line-lit` ring over a blurred disc,
>   brightening to blue on hover.
> - **The multiplier overlaid**, top left, gold, mono, tabular, at a size scaled to the
>   card's tier: `num-xl` for tier one, `num-l` for tier two, `num-m` for tier three.
> - Bottom block over the scrim: the title at 15px Manrope 600 clamped to two lines, then
>   a mono row at 12px `--color-faint`: `SOURCE · BET · WIN · DATE`, hairline separated
>   with `·`.
> - **Bet and win are both printed**, always, beside the multiplier. They are what make
>   the multiplier checkable (§4).
>
> **Play in place**, same rule as clips (§7): clicking the play control replaces the
> thumbnail with the embed inside the same card bounds. No modal, no navigation. Only one
> card plays at a time; starting a second stops the first. **No autoplay, ever.**

---

## 4. `/wins` states and the closing note

> **The closing note**, beneath the grid, centred, 14px `--color-muted`, capped at `66ch`:
>
> **Every multiplier here is calculated from the bet and the payout printed beside it.**
> Nothing is typed in by hand.
>
> Requirements rule 2 in one sentence, and it is why this page is a record rather than a
> highlight reel. **It renders in every state**, including empty.
>
> **Empty:** record cards absent, grid absent, and a plain empty state:
> **No wins on the wall yet.** Clips get added after the stream, and the biggest ones land
> here.
>
> **A single win:** the grid renders one card at tier one, full width. The record cards
> both point at that same win, which is correct and needs no special casing.
>
> **One month only:** the month chip row is absent entirely.

---

## 5. `/clips` header and count

> - **The count first**, at `label` size in `--color-muted`: `48 CLIPS PUBLISHED`.
>   Requirements puts a count of published clips ahead of the heading, and it is a good
>   instinct: it says at a glance whether this page is worth scrolling.
> - Heading `Clips` at `display-m`.
> - **Source chips:** `All` · `Kick` · `YouTube` · `Instagram` · `X`. Each carries its own
>   count at 11px mono at 60% opacity inside the chip. A source with nothing renders at
>   45% opacity and is not clickable, rather than being removed.
>
> The room light stays on for this page, unlike `/wins`. Clips are the site's colour and
> the page should feel lit.

---

## 6. The clip grid, and aspect ratio

**Requirements: aspect ratio is a data field, so vertical reels are not letterboxed into a
horizontal box.** This is the decision that makes or breaks the page.

> Build a **column-based masonry grid**, not a fixed row grid. Three CSS columns on
> desktop, two at 768px, one below, with cards flowing down each column.
>
> **Each card renders at its stored aspect ratio.** A 16:9 Kick clip is short and wide; a
> 9:16 Instagram reel is tall and narrow; a 1:1 is square. The card's media box uses
> `aspect-ratio` from the data field with **no crop, no letterbox and no pillarbox.**
>
> ```
>   ┌────────┐ ┌────────┐ ┌────────┐
>   │  16:9  │ │        │ │  16:9  │
>   └────────┘ │  9:16  │ └────────┘
>   ┌────────┐ │        │ ┌────────┐
>   │        │ │        │ │  1:1   │
>   │  9:16  │ └────────┘ │        │
>   │        │ ┌────────┐ └────────┘
>   └────────┘ │  16:9  │ ┌────────┐
>              └────────┘ │  16:9  │
> ```
>
> **Why columns and not a row grid.** A row grid forces every card in a row to one height,
> which is exactly the letterboxing Requirements forbids. CSS columns let each card be its
> own height and the ragged bottom is fine; this is a wall, not a table.
>
> **The trade, stated so it is a decision and not a surprise:** CSS columns order cards
> down each column rather than across rows, so visual order is not DOM order. Since clips
> have no ranking, that is acceptable here. **It would not be acceptable on `/wins`**,
> where the sort has meaning, which is why §3 uses a row grid with spans instead.
>
> **Missing aspect ratio in the data** falls back to 16:9 and the card gets no crop. Never
> guess from the thumbnail's own dimensions; a platform's placeholder image is not the
> clip's shape.

---

## 7. The clip card, and play in place

> - The media box at its own aspect ratio, `--radius-card`, `.lit`, blue top edge at
>   30% brightening on hover.
> - **A play control** at 44px, centred, same treatment as the win card.
> - **Duration pill** bottom right in 11px mono over a scrim.
> - **Platform mark** top left.
> - Beneath the media: title at 14px Manrope 600 clamped to two lines, then 12px mono
>   `--color-faint`: source and relative date.
>
> ### Play in place
>
> **Nothing embeds until clicked.** No iframe, no third-party script, no network request to
> the platform, until someone presses play. On press:
>
> 1. The thumbnail is **replaced in place** by the embed, inside the same card bounds and
>    at the same aspect ratio, so the grid does not reflow. This is the whole reason the
>    aspect ratio has to be a data field rather than measured after load.
> 2. **Only one card plays at a time.** Starting a second stops and restores the first.
> 3. A `Close` control appears top right of the playing card, restoring the thumbnail.
> 4. **No autoplay anywhere, ever**, including the first press if a viewer arrives from a
>    deep link.
>
> **Keyboard:** the play control is a real button, focusable, with Space and Enter both
> working, and focus moves into the embed on activation.
>
> ### States
>
> - **Empty overall:** **No clips yet.** They get added after the stream.
> - **Empty for the selected source**, and Requirements asks for the offer:
>   **No clips from YouTube yet.** with a ghost button, `Show all clips`, which clears the
>   filter. An empty state that leaves someone stuck on a filter is a dead end.

---

## 8. `/verify`

**The plainest page on the site, deliberately.** No display face. No light. No motion. No
entrances. No living elements.

> Build `/verify` on flat `--color-canvas` with the room light masked off entirely. Mono
> and body text only, hairline separated blocks, `max-width: 720px`, centred.
>
> Every other page on this site is designed to make someone feel something. This one is
> designed to be checked, and the restraint is the design. **If it starts looking
> designed, it has stopped looking honest.**
>
> - Eyebrow, `label`: `PROVABLY FAIR`
> - Heading `Verify a round` at `display-s`. **The only display face on the page.**
> - One line at 15px `--color-ink-2`, capped at `62ch`:
>   **This works signed out, and it works on somebody else's round.** Paste the values from
>   any round and recompute it yourself.
>
> ### The form
>
> Full width mono inputs, 48px tall, `--color-line-lit` borders, labels above at `label`
> size, stacked one per row with 16px between.
>
> `GAME` (select: Keno, Dice, Limbo) · `SERVER SEED` · `CLIENT SEED` · `NONCE`, then the
> **game-specific inputs**, which change with the select: Keno gets risk and pick count,
> Dice gets target and direction, Limbo gets nothing further.
>
> **The game-specific block changes in place**, with no layout jump: reserve its height at
> the tallest variant so switching game does not move the button.
>
> **Prefilled from the query string**, so a `Verify` link from a game, a lobby row or a
> past giveaway lands here ready to run. When it arrives prefilled, a `label`-size line
> above the form reads: `PREFILLED FROM A ROUND · CHANGE ANYTHING AND RUN IT AGAIN`.
>
> Primary button, full width: `Recompute`.
>
> ### The result
>
> One block beneath, hairline top, and **its verdict is the only coloured thing on the
> page**:
>
> - The recomputed outcome, laid out per game: Keno's drawn numbers as a plain mono list,
>   Dice's rolled figure, Limbo's multiplier. `num-l`, mono, tabular.
> - Beside it, the verdict at `display-s`: **`MATCHES`** in blue, or
>   **`DOES NOT MATCH`** in `--color-danger`.
> - Beneath, the submitted values echoed back at 12px mono `--color-faint`, so the reader
>   can see exactly what was computed.
>
> **`DOES NOT MATCH` is not an error state to apologise for.** It renders plainly, with one
> line beneath: **Check the values are from the same round. If they are, message a
> moderator in Discord with this page's link.** No red panel, no alarm, no attempt to
> explain it away.
>
> ### The four-step explanation
>
> A numbered mono list beneath the result, per Requirements:
>
> 1. `CHECK THE COMMITMENT` — hash the server seed and compare it to the hash published
>    before the round.
> 2. `BUILD THE BYTE STREAM` — HMAC the client seed and nonce with the server seed.
> 3. `TURN BYTES INTO NUMBERS` — take the bytes in fours and map them into range.
> 4. `APPLY THE GAME` — draw, roll or climb, using the game's own rules.
>
> **Each step shows its actual intermediate value for the round being verified**, at 12px
> mono, truncated with a copy button where long. Not a generic description of the
> algorithm. A step that says what it does but not what it produced cannot be followed.
>
> **Before any round is submitted** the four steps still render, with their value slots
> reading `—` in `--color-faint`. The method is public whether or not you have a round to
> check.

---

## 9. `/casinos`

> Build `/casinos`. **The warning card sits above the sign-up button, never below it.**
> That is the whole layout decision on this page.
>
> - Eyebrow: `WHERE THE BOARD'S FIGURES COME FROM`
> - Heading `Razed` at `display-m`
>
> ### The offer card
>
> One `.lit` panel, `--color-light-line` hairline, 32px padding.
> - The offer at `display-s`, its detail beneath at 15px `--color-ink-2` capped at `54ch`.
> - **The referral code** at `display-s` in mono, `--color-light-hot`, in a
>   `--color-light-bg` box with a `CopyButton` beside it. It is the one place display and
>   mono share a size on this page and it should look like a token.
>
> ### The three steps
>
> A numbered sequence reusing the homepage coin rules' connecting line (`Home §5`), so the
> two pages visibly share a device:
>
> 1. **Sign up with the code.** It has to be entered at sign-up. It cannot be added
>    afterwards.
> 2. **Wager as you normally would.** Nothing to link, nothing to claim, nothing to install.
> 3. **Appear on the board.** Positions update from Razed's own figures.
>
> ### The warning card, above the button
>
> `--color-danger-line` hairline on `--color-danger-bg`, 24px padding.
>
> Heading at `display-s`: **Play with money you can lose**
> Body at 15px, capped at `56ch`: Gambling costs most people money over time. Never stake
> what you need. If it has stopped being fun, the responsible gambling page has the tools
> to stop, including self-exclusion at Razed itself.
> A ghost link: `Read the responsible gambling page` → `/responsible`.
>
> **Then** the primary button: `Sign up with code MATTY`, external, `rel="noopener
> noreferrer"`.
>
> ### The affiliate disclosure
>
> Beneath the button, 13px `--color-muted`, capped at `62ch`, **at full 4.5:1 contrast**:
>
> **Matty earns a commission when you sign up with this code and wager.** That commission
> is what funds the prize pool. It costs you nothing extra and it does not change your
> odds.
>
> A disclosure styled to be skipped is not a disclosure. It is set at body contrast, not
> at `--color-faint`.

---

## 10. `/official`

Somebody arriving here is often being scammed right now. The page has half a second to
read as serious.

> Build `/official`. **No light drift, no living elements.** The page is still and plain.
>
> - Eyebrow in `--color-danger`: `IMPERSONATION IS COMMON. CHECK HERE FIRST.`
> - Heading `Official accounts` at `display-m`
> - One line at 15px, capped at `58ch`: These are every account Matty actually uses.
>   Anything not on this list is not him, however convincing it looks.
>
> ### The list
>
> A plain list, one row each, 64px, hairline separated, grid `36px 1fr auto`:
> platform mark, handle in 15px mono, then a **verified state carried by a glyph**, a
> blue check at 18px with the word `OFFICIAL` at 11px mono beside it.
>
> Requirements §7: colour is never the only signal. The check glyph and the word both
> render, so this survives greyscale and a screen reader.
>
> Each row links out with `rel="noopener noreferrer"`.
>
> ### The sentence that stops a theft
>
> A `--color-danger-line` card beneath the list, and **its sentence is set at
> `display-s`**, because it is the only sentence on this site whose job is to stop someone
> being robbed:
>
> **He will never DM you first asking for money or a seed phrase.**
>
> Beneath at 15px: Not for a giveaway, not for a prize, not for a "verification". If an
> account claiming to be him messages you first, it is not him. Report it and move on.
>
> This card is above the fold on a phone. Check it at 375px.

---

## 11. The legal template, and `/responsible`

> Build one shared long-form template for `/terms`, `/privacy`, `/giveaway-rules` and
> `/responsible`.
>
> **No light, no motion, no entrances.** Flat `--color-canvas`, `max-width: 760px`,
> centred.
>
> - Heading at `display-m`.
> - **Last updated** at 12px mono `--color-faint` directly beneath: `LAST UPDATED 12 MARCH
>   2026`.
> - Body at `body-l` in `--color-ink-2`, paragraphs capped at `68ch` **on the paragraph**,
>   with generous spacing: 20px between paragraphs, 40px above an `h2` at `display-s`.
> - `h2`s get a hairline above them, so a long document has visible structure when
>   scanned.
> - Lists are indented with a blue marker at 30% opacity.
>
> ### The draft banner
>
> While the legal review flag is false, a `--color-gold-line` banner sits above the
> heading, full width, plain words:
>
> **This document is a draft and has not been through legal review.** It describes how the
> site is intended to work. Treat it as information, not as final terms.
>
> It is never dismissible and never collapsed.
>
> ### `/responsible`, which is not just another legal page
>
> **The tools go above the body copy, not at the bottom of it.** Someone who opens this
> page needs the helpline and the self-exclusion links in the first screen, not after two
> thousand words of policy.
>
> A `.lit` panel directly under the heading, before any body text, with three blocks
> hairline separated:
>
> 1. **`IF YOU NEED TO TALK`** — the helpline name and number at `display-s`, plus its
>    hours and a link. *(Confirm the current, correct helpline for the site's main
>    audience before shipping. Do not ship a placeholder.)*
> 2. **`STOP PLAYING HERE`** — one line explaining that games can be turned off for a day,
>    a week, a month or permanently, and a primary button, `Turn games off` → `/me`,
>    scrolling to the play settings block (`Profile §7`).
> 3. **`STOP PLAYING AT RAZED`** — Razed's own self-exclusion and deposit-limit links,
>    with one line: These are set at Razed, not here, and turning games off on this site
>    does not affect them.
>
> That last clarification matters. Someone who self-excludes here and assumes it covers
> the casino has been misled by omission.

---

## 12. Responsive

**Two breakpoints only: below 768px, and 1024px and up.** Requirements §7.

| Page | ≥1024 | <768 |
|---|---|---|
| `/wins` records | 2 across | Stacked |
| `/wins` grid | 3 col, tiered spans | 1 col, all cards full width, tiers become size of the multiplier only |
| `/wins` chips | Sort right of heading, month row beneath | Both rows scroll in their own containers |
| `/clips` grid | **3 CSS columns** | **1 column**, cards at their own ratios |
| `/verify` | 720px centred | Full width, game-specific block still height-reserved |
| `/casinos` | Single column, 640px | Same, button full width |
| `/official` | Single column | **Danger card above the fold**, checked at 375px |
| Legal | 760px | Full width minus 20px, `68ch` cap still on the paragraph |

**Phone specifics.**

- **`/wins` tiers collapse to one column**, and the size hierarchy survives through the
  multiplier's font size rather than the card's span. A single column of identically sized
  cards loses the ranking, which is the page's whole idea.
- **`/clips` at one column keeps each card's own aspect ratio.** A 9:16 reel at 335px wide
  is 595px tall and that is correct. Do not cap it.
- The embed replaces the thumbnail at the same ratio, so **the page never reflows on
  play**. Test this with a 9:16 card mid-column.
- `min-width: 0` on every card grid child holding a title or a handle.
- Every play control and every chip at least 44px under `(pointer: coarse)`.
- The `/official` danger card must be visible without scrolling at 375×667.

---

## 13. The copy block

```
/WINS
eyebrow    REAL BETS, REAL PAYOUTS, ON STREAM
title      Wall of fame
sort       By multiplier · By win · By date
month      MONTH · All · March · February · January
records    BIGGEST MULTIPLIER EVER · BIGGEST WIN EVER
card meta  SOURCE · BET · WIN · DATE
close      Every multiplier here is calculated from the bet and the payout
           printed beside it. Nothing is typed in by hand.
empty      No wins on the wall yet. Clips get added after the stream, and the
           biggest ones land here.

/CLIPS
count      48 CLIPS PUBLISHED
title      Clips
chips      All · Kick · YouTube · Instagram · X
empty      No clips yet. They get added after the stream.
filtered   No clips from YouTube yet.        [button: Show all clips]
close btn  Close

/VERIFY
eyebrow    PROVABLY FAIR
title      Verify a round
lede       This works signed out, and it works on somebody else's round. Paste
           the values from any round and recompute it yourself.
fields     GAME · SERVER SEED · CLIENT SEED · NONCE
prefill    PREFILLED FROM A ROUND · CHANGE ANYTHING AND RUN IT AGAIN
button     Recompute
verdict    MATCHES / DOES NOT MATCH
mismatch   Check the values are from the same round. If they are, message a
           moderator in Discord with this page's link.
steps      1 CHECK THE COMMITMENT   hash the server seed and compare it to the
                                    hash published before the round
           2 BUILD THE BYTE STREAM  HMAC the client seed and nonce with the
                                    server seed
           3 TURN BYTES INTO NUMBERS take the bytes in fours and map them into
                                    range
           4 APPLY THE GAME         draw, roll or climb, using the game's own
                                    rules

/CASINOS
eyebrow    WHERE THE BOARD'S FIGURES COME FROM
title      Razed
step 1     Sign up with the code. It has to be entered at sign-up. It cannot be
           added afterwards.
step 2     Wager as you normally would. Nothing to link, nothing to claim,
           nothing to install.
step 3     Appear on the board. Positions update from Razed's own figures.
warn t     Play with money you can lose
warn b     Gambling costs most people money over time. Never stake what you
           need. If it has stopped being fun, the responsible gambling page has
           the tools to stop, including self-exclusion at Razed itself.
button     Sign up with code MATTY
disclose   Matty earns a commission when you sign up with this code and wager.
           That commission is what funds the prize pool. It costs you nothing
           extra and it does not change your odds.

/OFFICIAL
eyebrow    IMPERSONATION IS COMMON. CHECK HERE FIRST.
title      Official accounts
lede       These are every account Matty actually uses. Anything not on this
           list is not him, however convincing it looks.
badge      OFFICIAL
warning    He will never DM you first asking for money or a seed phrase.
warn b     Not for a giveaway, not for a prize, not for a "verification". If an
           account claiming to be him messages you first, it is not him. Report
           it and move on.

LEGAL
meta       LAST UPDATED 12 MARCH 2026
draft      This document is a draft and has not been through legal review. It
           describes how the site is intended to work. Treat it as information,
           not as final terms.

/RESPONSIBLE
block 1    IF YOU NEED TO TALK                    [CONFIRM THE HELPLINE]
block 2    STOP PLAYING HERE
           Games can be turned off for a day, a week, a month or permanently.
           [button: Turn games off]
block 3    STOP PLAYING AT RAZED
           These are set at Razed, not here, and turning games off on this site
           does not affect them.
```

**Copy gate:** zero em dashes, zero stock words, run before any of these pages ship.

**One item needs confirming, not guessing:** the helpline on `/responsible`. It must be
the current, correct service for the site's main audience, checked before shipping, and it
must never go out as a placeholder. A wrong number on that block is worse than no block.

---

## 14. States to build

| State | Where | Behaviour |
|---|---|---|
| Loading | All | Skeleton at final size. Clip cards reserve their **stored** aspect ratio |
| `/wins` empty | Wins | **Record cards absent entirely**, grid absent, empty state, **closing note still renders** |
| `/wins` single win | Wins | One tier-one card. Both record cards point at it. No special casing |
| `/wins` one month | Wins | **Month chip row absent entirely**, not a single chip |
| `/wins` sort changed | Wins | Grid re-tiers. **Record cards do not change** |
| `/wins` month filtered | Wins | Grid filters. **Record cards still say EVER and do not filter** |
| Clip missing aspect ratio | Clips | Falls back to 16:9, **no crop**. Never measured from the thumbnail |
| Clip playing | Clips, Wins | Embed replaces thumbnail **in place, same ratio, no reflow** |
| Second clip pressed | Clips, Wins | First stops and restores. **Only one plays at a time** |
| Clips empty overall | Clips | Plain empty state |
| Clips empty for source | Clips | Empty state **plus a button clearing the filter**. Never a dead end |
| `/verify` no round yet | Verify | Form empty, **four steps still render** with `—` value slots |
| `/verify` prefilled | Verify | Values in, prefill line above the form |
| `/verify` game changed | Verify | Game-specific block swaps **with no layout jump** |
| `/verify` MATCHES | Verify | Blue verdict. The only colour on the page |
| **`/verify` DOES NOT MATCH** | Verify | Danger verdict, **plainly**, one line on what to do. No alarm panel |
| Legal in draft | Legal | Gold banner above the heading, not dismissible |
| `/responsible` | Responsible | **Tools panel above the body copy**, all three blocks |
| No database | All | Degrade to empty states, never to zeros or blank grids |

---

## 15. The self test

1. Screenshots of all six pages at **1440×900, 1280×800, 375×812**.
2. **The aspect ratio test.** Load `/clips` with a 16:9, a 9:16 and a 1:1 in the same
   column. Confirm none is letterboxed, pillarboxed or cropped.
3. **Press play on a 9:16 card mid-column** and confirm the grid does not reflow.
4. Press play on a second card and confirm the first stops and restores.
5. **Confirm nothing loads from a third-party platform until play is pressed.** Check the
   network panel on a cold load of `/clips`.
6. `/wins` at each of the three sorts: confirm the grid re-tiers and **the record cards do
   not change**.
7. `/wins` with one month, with one win, and empty. Confirm the record cards are absent in
   the empty case and the closing note still renders.
8. `/wins` at 375px: confirm the size hierarchy survives through the multiplier's size.
9. `/verify` with a real round from each of the three games, and with one deliberately
   wrong value. Confirm `DOES NOT MATCH` renders plainly with no alarm styling.
10. `/verify` switching game three times: **no layout jump**, button does not move.
11. **`/verify` with no colour except the verdict.** Screenshot and check.
12. `/casinos`: confirm the warning card is **above** the sign-up button at every width,
    and the disclosure is at 4.5:1 rather than faint.
13. **`/official` at 375×667: the danger card must be visible without scrolling.**
14. `/official` in greyscale: the check glyph and `OFFICIAL` still carry it.
15. Legal pages with the draft flag both true and false.
16. `/responsible`: the tools panel is above the body copy, and the `Turn games off` button
    lands on the play settings block.
17. `min-width: 0` proved with an absurd clip title and an absurd handle at 375px.
18. Reduced motion on: no lifts, no transitions, every page still complete.
19. Console clean at both breakpoints.
20. **The fresh eyes pass.** Does `/wins` feel like a wall of trophies and `/verify` feel
    like a receipt? If they feel like the same site's two pages, the flip in the
    organising principle has not happened.

---

## 16. Build order

```
§6 the clip grid          the aspect-ratio decision, and the page's whole risk
§7 the clip card          play in place, shared with /wins
§5 /clips header
§3 the win card           reuses §7's play-in-place
§1 §2 §4 /wins            records, chips, tiers, closing note
§10 /official             short, and it is the one page someone needs urgently
§9 /casinos               the warning-above-the-button layout
§11 legal template        one template, four pages
§11 /responsible          the tools panel, once the template exists
§8 /verify                last, because it needs almost nothing from the system
```

**The clip grid comes first because it is the only real design risk in this document.**
Everything else here is layout and copy; the mixed-ratio masonry is the piece that will be
built wrong first if it is built late.

**`/official` comes before `/casinos` and the legal pages** even though it is the smallest.
It is the page someone opens while being scammed, and there is no version of this project
where it waits for a marketing page to be finished.

**`/verify` is last on purpose.** It uses no light, no display face, no motion and almost
no component from the system, so it has no dependencies and nothing depends on it. It is
also the page most likely to be quietly over-designed if it is built early, alongside the
rest of the system, rather than at the end on its own terms.
