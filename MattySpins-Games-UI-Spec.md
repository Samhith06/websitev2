# MattySpins Games — Complete UI Specification

The lobby, the shared shell, and all three games. Companion to
`MattySpins-LateNight-UI-Spec.md`, which holds the tokens (§1), the type scale (§2), the
light layer (§3), the motion system (§4) and the primitives (§5). **Read those five
first.** This document supersedes `Late Night` §27 and §28, which were summaries.

Content, data and behaviour come from `MattySpins-UI-Requirements.md` §4 Games. Every
rule in it survives.

**Routes:** `app/(site)/games/page.tsx`, `app/(site)/games/[slug]/page.tsx`, and
`components/games/*`. **Presentation only.** `useGame`, the idempotency key, the seed
flow, `lib/games.ts`, the paytables and `/api/games/play` are untouched.

---

## The organising principle

Every other page on this site is trying to make you feel something. **The games are
trying to be trusted.** They are played with coins that cannot be bought, on a server
that committed to a seed before the round, and the whole section's job is to make that
verifiable rather than merely stated.

```
   ARRIVE ─→ CAN I AFFORD IT? ─→ WHAT ARE THE ODDS? ─→ PLAY ─→ CAN I CHECK IT?
              balance heads         RTP on screen,      local     fairness drawer
              the page              odds labelled       light     → /verify
                                    calculated
```

So the games run **quieter** than the rest of the site, not louder. No display face above
`display-s`. No entrances. No living elements. The only motion in the section is motion
that reports a result, and it stops the moment the result is legible.

A casino site that animates while you decide is trying to hurry you. This one is not
that, and the restraint is the design.

---

## The three highest-value decisions

**1. Keno's four tile states, and it is not close.** Requirements calls this the single
most regression-prone thing in the app, and it is right: if *drawn but not picked* looks
like *untouched*, the ten numbers the round is actually about become invisible and the
board stops meaning anything. §8.2 specifies four states that differ in **luminance,
shape and depth**, so any one of the three carries it alone. Build it first, test it in
greyscale, and never let a redesign flatten it.

**2. The local light, and it never touches the room light.** A game screen gets its own
blue bloom behind the game surface. Results pulse that. **The room light, which means
the stream, is never touched by a game result.** Crossing them would make a Limbo win look
like Matty came online, which is the one piece of information on this site that has to
stay honest.

**3. The blocking reason is the button label.** Requirements spells this out for Keno and
it applies to all three: the play button never says "Play" while disabled. It says
`Pick 1–10 numbers`, or `Not enough coins`, or `Drawing…`. A disabled button with a
generic label makes the player hunt for what is wrong. A button that names it costs
nothing and removes the hunt.

---

## The local light

> Every game screen renders a second light, separate from the room light in
> `Late Night §3`.
>
> - A radial blue gradient behind the game surface, `rgb(43 143 255 / .14)` at source,
>   sized to the surface plus 200px.
> - **It does not drift.** The room breathes; the game surface does not. A slowly moving
>   light behind a board you are reading is a distraction, and this section's whole
>   character is that it holds still while you think.
> - **It reports results, and only results.** §4 has the two pulses.
>
> **The room light is suppressed to 40% on game routes**, so the local light reads as the
> dominant source in the frame. The room is still there, it is just no longer the thing
> lighting what you are looking at.
>
> **Under reduced motion** the local light renders static at its resting value and result
> pulses are replaced by a one frame change of the result text's colour. The result is
> never conveyed by motion alone.

---

## Screen inventory

1. Lobby
2. The game shell
3. The bet rail
4. The result
5. The fairness drawer
6. The opt-in gate, the kill switch, and self-exclusion
7. Sound
8. Keno
9. Dice
10. Limbo
11. Coming soon cards
12. Responsive
13. The copy block
14. States to build
15. The self test
16. Build order
17. **The homepage games section** *(the gap)*

---

## 1. Lobby

> Build `/games`. **The balance heads the page**, exactly as the shop does. On a page
> where coins are spent, the balance is the heading.
>
> **The balance panel:** full width, `.lit`, `--color-light-line` hairline. Coin mark at
> 24px, balance at `num-l` in gold with the `MC` unit. Beneath at 13px `--color-muted`:
> the wagered-today and net-today figures, net gold above zero and `--color-danger` below.
> Right: a ghost link, `Your ledger` → `/me`.
>
> **Eyebrow**, `label` size, `--color-muted`:
> `PROVABLY FAIR · PLAYED WITH COINS YOU EARNED WATCHING`
>
> Heading `Games` at `display-m`.
>
> ### The card grid
>
> **Five per row on desktop**, using the existing key art (`Keno.webp`, `Dice.webp`,
> `Limbo.webp`).
>
> - 4:5 portrait, `.lit`, `--radius-card`, art filling the card with `object-fit: cover`.
> - A bottom scrim from `rgb(10 8 23 / .92)` to transparent over the lower 45%.
> - Name at `display-s` over the scrim, bottom left, 16px inset.
> - A blue top edge at 30%, brightening to 100% on hover.
> - **Hover:** lift 6px, art scales to 1.05 inside its clipped bounds, edge brightens.
>   240ms `--ease-out`. No hover under `(pointer: coarse)`.
>
> ### Biggest hits today
>
> A mono table beneath the grid. Columns: player (masked), game, bet, multiplier, payout,
> and a `Verify` ghost link per row.
>
> - Header row at `label` size, hairline beneath.
> - Rows 52px, hairline separated, no zebra striping.
> - **The multiplier column is gold, mono, tabular, right aligned.** Every other figure is
>   `--color-ink-2`.
> - The `Verify` link prefills `/verify` from that round, so it lands ready to run.
>
> **Absent entirely when there are no rounds today.** Not rendered empty. A table with a
> header and no rows says the games are dead.
>
> ### The kill switch
>
> When games are switched off globally, **the entire lobby is replaced** by one centred
> lit panel with a `--color-danger-line` hairline, `max-width: 560px`:
>
> **Games are switched off right now.** Your balance is untouched and every round that was
> in progress settled normally. Coins keep earning while the stream is live.
>
> Nothing else on the page. No grid at 40% opacity, no table, no cards. **A half-disabled
> lobby reads as broken software**, and this state has to read as a decision.

---

## 2. The game shell

> Build the shared shell that Keno, Dice and Limbo sit inside, in
> `components/games/shared.tsx`.
>
> **Layout, desktop:** a two column grid at `292px 1fr`, 24px gap, `max-width: 1080px`.
> - Left: the bet rail (§3), sticky at `top: 88px`.
> - Right, in order: the header row, the history strip, the game surface, then the
>   paytable or result block.
>
> **Layout, mobile:** single column. **The bet rail moves to the bottom and docks**, fixed
> above the tab bar, with the game surface scrolling above it. The play button must be
> reachable with a thumb while the board is visible, which is the whole reason the rail
> moves rather than simply stacking on top.
>
> ### The header row
>
> Grid `1fr auto auto`, baseline aligned, 20px below the nav.
>
> - Left: eyebrow at `label` size naming the game's shape (`10 DRAWN FROM 40`), then the
>   game name at `display-s`.
> - Middle: the balance, coin mark at 15px and the figure at `num-m` gold.
> - Right: **the sound toggle, labelled** (§7).
>
> ### The game surface
>
> `max-width: 720px`, centred in its column, `.lit`, `--radius-card`,
> `--color-line-lit` hairline, with the local light behind it.
>
> **The RTP sits in its bottom left corner**, always, at 12px mono `--color-faint`:
> `RTP 99.00%`. Not in a drawer. Not on hover. Not in the paytable only. The number that
> says how much the house takes is on screen while you bet.
>
> ### The history strip
>
> Above the surface, right aligned, newest **left**. Up to twelve chips.
>
> - Each chip: the multiplier in 12px mono tabular, 26px tall, `--radius-pill`, 10px
>   horizontal padding.
> - **Cleared** (paid more than the stake): `--color-light-bg` fill,
>   `--color-light-line` border, blue text.
> - **Lost**: `--color-panel` fill, `--color-line` border, `--color-muted` text.
> - A new chip slides in from the left over 220ms and pushes the rest right. The
>   thirteenth falls off the end with a fade, never a pop.
>
> **Limbo's history is not optional.** Requirements: Limbo players read streaks, which is
> why the strip earns its place there specifically.
>
> ### Controls lock while a round settles
>
> Every control gets `disabled`, 55% opacity, and `cursor: not-allowed`. The play button's
> label changes to `Drawing…` or `Rolling…` or `Playing…` per game. **A control that looks
> live while the server is deciding is how double bets happen**, and the idempotency key
> in `useGame` is the second line of defence, not the first.

---

## 3. The bet rail

> Build the shared bet rail. Same component in all three games; only the middle block
> differs.
>
> `.lit` panel, `--radius-card`, 16px padding, 20px between blocks.
>
> ### Bet amount
>
> - Label at `label` size: `BET`
> - A mono input at 16px with the coin mark as a permanent prefix, right aligned figure,
>   `--color-line-lit` border, 44px tall.
> - Beneath it, two buttons side by side at 50% each: `½` and `2×`. Ghost style, mono,
>   36px tall. They halve and double, clamped to `LIMITS`.
> - Beneath those, one line at 11px mono `--color-faint`:
>   `MIN 1 · MAX 5,000 · MAX WIN 100,000`
>
> **Over the maximum**, the input border goes `--color-danger-line` and the line beneath
> reads the cap. It does not silently clamp while the player is typing, because a field
> that rewrites your number as you type is worse than one that tells you it is wrong.
>
> ### The game block
>
> Keno's risk grid and number picker (§8.1), Dice's target and direction (§9), Limbo's
> target multiplier (§10).
>
> ### The derived figures
>
> Every game shows at least one derived figure: win chance, payout on target, max win.
>
> **Requirements rule 2: derived figures are computed, never stored, and labelled.** Each
> one renders as a row, label left at `label` size, figure right at `num-s` mono, with the
> word `CALCULATED` at 9px mono `--color-faint` beneath the label. **They take no input
> and they are never editable.** If a figure can be derived from two others on screen, it
> is derived, and then the three can never disagree.
>
> ### The play button
>
> Full width, primary, `lg`, 48px tall, at the bottom of the rail.
>
> **The label states the blocking reason.** It never says `Play` while it cannot be
> pressed.
>
> | Condition | Label | State |
> |---|---|---|
> | Ready | `Place bet` | primary, enabled |
> | Loading the session | `Loading` | disabled |
> | Signed out | `Sign in to play` | primary, links to sign in |
> | Bet above balance | `Not enough coins` | disabled |
> | Keno, no picks | `Pick 1–10 numbers` | disabled |
> | Dice, invalid target | `Set a target` | disabled |
> | Limbo, target below 1.01× | `Target must be above 1.01×` | disabled |
> | Round in flight | `Drawing…` / `Rolling…` / `Playing…` | disabled |
>
> ### Errors
>
> A network or server error renders **beneath the button**, not as a toast, at 13px in
> `--color-danger` on a `--color-danger-bg` panel:
> **Could not reach the server. Nothing has been staked.**
>
> That second sentence is the important one and it is never dropped. A failed request on a
> gambling site with no statement about the stake is the most alarming thing this app can
> render.

---

## 4. The result

> Build the result treatment. It is shared, and it is the only motion in the section.
>
> ### Win
>
> 1. `0 → 400ms` the local light pulses to 1.6× its resting strength and back, one time,
>    `--ease-out`.
> 2. `120ms` the payout counts up in gold at `num-l` over 600ms.
> 3. `120ms` the multiplier lands beside it at `num-m` in blue with a 2px scale pop.
> 4. The history chip slides in.
>
> ### Loss
>
> 1. `0 → 300ms` the local light dips 30% and eases back.
> 2. The result reads **`0.00×`** at `num-l` in `--color-muted`, and the payout row reads
>    `0 MC`.
> 3. The history chip slides in, unlit.
>
> **Requirements rule 5: losing is stated plainly.** `0.00×` is printed, not omitted. The
> paytable's zero tiers stay visible. Nothing is softened, nothing is animated away, and
> there is no consolation copy. A site that hides its losses is not one you can trust with
> its wins.
>
> ### Both
>
> **Nothing loops after the result settles.** The pulse fires once and stops. Motion
> happens when data changes and then it is over.
>
> **Reduced motion:** no pulse, no count. The figures render at their values and the
> result's colour is the only signal, which is why the `0.00×` text is always printed.

---

## 5. The fairness drawer

The reason this section exists. It is not a footnote.

> Build the fairness drawer. **A right side panel at 400px on desktop, a bottom sheet on
> mobile.** Opened by a ghost link beneath the game surface with a small shield mark:
> `Provably fair`.
>
> **No display face inside it.** Mono and body only, hairline separated blocks, flat
> `--color-panel`. Same reasoning as `/verify` in `Late Night §29`: the thing that proves
> the site is honest should look like evidence, not like marketing.
>
> ### Contents, in order
>
> 1. **The sentence, first, not last**, at 14px `--color-ink-2`, capped at `44ch`:
>    The hash below commits us to a seed we cannot change afterwards. Rotate it and we
>    reveal the old one, so every round you played on it can be recomputed by anyone.
>
> 2. **Three rows**, each label at `label` size above a mono value at 13px with a
>    `CopyButton`:
>    - `SERVER SEED HASH` — truncated to 20 characters with an ellipsis, full value copied
>    - `CLIENT SEED`
>    - `NONCE` — tabular
>
> 3. **`Rotate seed`**, outline button, full width. Beneath it at 12px `--color-muted`:
>    Rotating reveals your current server seed and starts a new one at nonce 0.
>
> 4. **After a rotation**, a `--color-gold-line` panel appears above the three rows
>    holding the revealed previous seed and its hash, both copyable, headed
>    `REVEALED · PREVIOUS SEED`. It persists for the session. This is the payoff of the
>    whole mechanism and it must not vanish after three seconds.
>
> 5. **`Verify a round`**, ghost link with a trailing arrow, prefilling `/verify` from the
>    current round.
>
> ### Opening and closing
>
> Desktop: slides in from the right over 280ms `--ease-out`, with a scrim over the page at
> `rgb(10 8 23 / .5)`. Mobile: slides up, snapping to 80% height.
>
> **Focus is trapped while it is open**, `Escape` closes it, and focus returns to the
> trigger. It is a dialog and it behaves like one.

---

## 6. The opt-in gate, the kill switch, and self-exclusion

Three different states that all mean "you cannot play right now" and must never look
alike.

> **The opt-in gate** replaces the game surface entirely, centred, `.lit`, `max-width:
> 520px`. **Never a modal over a playable board**, because a board visible behind a gate
> reads as something to get past.
>
> Heading at `display-s`: **Turn games on**
> Body at 15px: You need to be 18 or over. Matty Coins have no cash value, cannot be
> bought and cannot be withdrawn. Games are played for fun with coins you earned watching.
> One primary button: `Turn games on`. One ghost link: `Read the responsible gambling
> page` → `/responsible`.
>
> **The kill switch** is global and lives on the lobby (§1). On a game route it renders
> the same danger panel in place of the surface, and the bet rail is removed rather than
> disabled.
>
> **Self-exclusion is different, and it is the one that matters most.**
> Requirements: the Games link is removed from the navigation **entirely**, not disabled,
> not greyed. It disappears. So:
> - `Late Night §6` nav: the Games link is absent for a self-excluded viewer.
> - **The mobile tab bar never contains Games**, which is convenient, because it means the
>   self-exclusion rule cannot be broken there by accident.
> - `/games` and `/games/[slug]` render a single centred panel, no surface, no rail:
>   **You've self-excluded from games.** Your coins, the board, the shop and the giveaways
>   all still work. If you want this lifted, the responsible gambling page explains how.
> - **The homepage games section (§17) is absent entirely for a self-excluded viewer.**
>   Same rule, same reason, and it is easy to forget on a page that is not `/games`.

---

## 7. Sound

> Build the sound toggle as a **labelled control**, never a bare icon.
>
> Requirements says this explicitly and the reason is stated there: an unlabelled speaker
> is how people miss that sound exists at all.
>
> A ghost button, 36px tall, holding the speaker mark at 15px and the word `SOUND` at
> `label` size, with the state as a third element: `ON` in blue or `OFF` in
> `--color-muted`.
>
> Reads and writes through the existing `readSoundPreference` / `writeSoundPreference`,
> and the preference is read **after mount** so the server render and the first paint
> agree.
>
> **Sound is off by default** and stays off until the player turns it on. A gambling page
> that makes noise on arrival is the fastest way to lose someone.

---

## 8. Keno

`/games/keno` · `components/games/Keno.tsx`

> Build Keno. Layout: the 292px bet rail left, the eight-across board right, the history
> strip above it, the paytable as a flat row of cells beneath.
>
> **Header eyebrow:** `10 DRAWN FROM 40`.

### 8.1 The bet rail, Keno block

> Between the bet amount and the play button, in this order:
>
> **Risk**, a 2×2 grid of four segmented buttons: `Classic`, `Low`, `Medium`, `High`. The
> active one is a blue filled box with `--color-light-ink` text; the rest are ghost.
> 40px tall each, 6px gap.
>
> **Changing risk changes the paytable and the RTP**, and both must repaint in the same
> frame as the button state. A risk button that highlights before the table under it
> changes reads as lag.
>
> **The number picker:**
> - A range slider, 1 to 10, `--color-line-lit` track with a blue filled portion and a
>   16px blue thumb. Label above: `HOW MANY NUMBERS`.
> - A `Pick` button beside it, outline, 40px.
> - Beneath: a readout at 13px mono, `7 / 10 SELECTED`, and a `Clear picks` ghost link at
>   12px, right aligned.
>
> **The picker's behaviour is the part that gets broken.** Requirements is explicit:
> - **The slider keeps numbers already chosen** and adds or drops only the difference.
>   Dragging from 3 to 6 adds three random unpicked numbers and **must not discard the
>   three deliberate picks**.
> - Dragging from 6 down to 3 drops the three most recently added, not three at random,
>   and never a number the player picked by tapping the board.
> - **The `Pick` button re-rolls the whole set.** That is its entire difference from the
>   slider and it is why both exist.
>
> **Derived figures** beneath, labelled `CALCULATED`:
> `MAX WIN` (bet × the top multiplier for the current risk and pick count) and `RTP`.

### 8.2 The board, and the four tile states

**The single most regression-prone thing in the app.** If *drawn but not picked* looks
like *untouched*, the ten numbers the round is actually about become invisible.

> Build the board: 40 tiles, **eight across on desktop, five on mobile**, square, 8px
> gaps, `--radius-ctrl`.
>
> Four states. **Each differs in luminance, in shape, and in depth**, so any one of the
> three carries it alone.
>
> | State | Fill | Border | Number | Shape cue | Depth |
> |---|---|---|---|---|---|
> | **Idle** | `--color-panel` | 1px `--color-line` | 18px mono `--color-ink-2` | none | flat |
> | **Picked** | `--color-light-bg` | 2px `--color-light-line` | 18px mono blue | **filled notch, top left** | flat |
> | **Drawn, missed** | `--color-canvas` | 1px `--color-line` | 18px mono `--color-muted` | **diagonal strike** | **sunken**, inset shadow |
> | **Hit** | `--color-light` | 2px `--color-light-hot` | 18px mono `--color-light-ink` | **notch + outer ring** | **raised**, outer glow |
>
> **Drawn-but-missed is darker than idle, and it sinks below the board's plane.** That is
> the fix for the failure mode named above. The board's surface stays where it is and the
> drawn tiles drop out of it, so the ten numbers the round is about are the only ten that
> have moved.
>
> **The greyscale test.** Idle is flat mid grey with no mark. Picked is outlined with a
> notch. Missed is the darkest tile with a strike. Hit is the brightest with a notch and a
> ring. **Four luminances, four shapes.** Check it in greyscale before shipping, and if
> you cannot read the board, the notch and the strike are too small. That is almost always
> what has gone wrong.
>
> **Tapping a tile toggles a pick**, capped at 10, and the readout updates. Tapping is
> disabled while a round is in flight and while the reveal is running.

### 8.3 The reveal

> Build the draw reveal. Ten numbers land in sequence.
>
> - **90ms apart, 1.1s total.** Any longer and it becomes the thing people complain about
>   by the fifth round.
> - A **miss** lands quietly: the tile sinks over 140ms with its strike drawing.
> - A **hit** lands loudly: the tile scales from 0.86 to 1 with an overshoot on
>   `cubic-bezier(.3, 1.5, .5, 1)` over 260ms, its glow blooms, and the paytable cell for
>   the new hit count highlights.
> - **The paytable's highlighted cell moves as hits land**, so the player watches their
>   own multiplier climb through the tiers in real time. This is the best three seconds
>   Keno produces and it is free, because the table is already on screen.
> - **Tapping anywhere during the reveal completes it instantly**, all tiles in their
>   final states. Someone on round forty does not want the ceremony and should not have to
>   wait for it.
>
> **Sound**, when on: one soft tick per miss, a brighter tone per hit, rising in pitch
> with the hit count. Never on the misses alone, and never at the same volume as the hits.
>
> **Reduced motion:** all forty tiles render their final state at once, no sequence. The
> paytable highlights its final cell directly.

### 8.4 The paytable

> A flat row of cells beneath the board, one per hit count from 0 to the pick count.
>
> Each cell: the hit count at 12px mono `--color-muted` above, the multiplier at 15px mono
> below. **The round's actual hit count is highlighted**: blue border, `--color-light-bg`
> fill, multiplier in blue.
>
> **Every tier is shown, including the ones that pay nothing.** A `0.00×` cell is rendered
> exactly like the others, in `--color-muted`, never omitted and never collapsed. This is
> Requirements rule 5 and it is the whole reason this table is trustworthy.
>
> Beneath the row, one line at 11px mono `--color-faint`:
> `RTP 99.00% · every tier is shown, including the ones that pay nothing`
>
> **The table scrolls horizontally on mobile** inside its own container, with the same
> masked edges as the clip rail. It never wraps to two rows, because a paytable that wraps
> stops reading as a scale.

---

## 9. Dice

`/games/dice` · `components/games/Dice.tsx`

> Build Dice. The simplest of the three, and the one where the derived figures do all the
> work.
>
> **Header eyebrow:** `ROLL UNDER OR OVER`.
>
> ### The rail, Dice block
>
> **Direction**, a two button segmented control: `Roll under` / `Roll over`. 40px tall,
> full width, the active one blue filled.
>
> **Target**, a range slider from 2 to 98 with a mono number input beside it at 64px wide.
> The slider's track is **split at the target**: the winning side is blue at 40%
> opacity, the losing side is `--color-line`. **The track is the odds**, drawn, and it
> changes as the thumb moves, so the trade is visible before any number is read.
>
> **Derived figures**, both labelled `CALCULATED`:
> - `WIN CHANCE` — `49.50%`, mono, tabular
> - `PAYOUT ON TARGET` — `2.0000×`, mono, tabular, gold
>
> They recompute on every slider frame. Requirements rule 2: they are derived from the
> target and the house edge, they take no input, and they are never editable.
>
> ### The surface
>
> A horizontal track across the surface, 0 to 100, with the target marked by a 2px blue
> line and a mono label above it. The winning range is tinted blue at 8%.
>
> **The result** is a marker that lands on the rolled number:
> - A 3px vertical blue bar with the rolled figure at `num-l` above it, mono, tabular.
> - It **slides in from the track's left edge over 420ms** on `--ease-out`, decelerating
>   into place. It does not fade in, because a dice roll that appears rather than arriving
>   loses the only drama the game has.
> - **Win:** the figure is gold, the bar is blue, the local light pulses.
> - **Loss:** the figure is `--color-muted`, the bar is `--color-line`, the light dips, and
>   `0.00×` prints beneath.
>
> The previous roll's marker stays on the track at 25% opacity until the next one lands,
> so consecutive rolls read as a sequence rather than as separate events.
>
> **Reduced motion:** the marker renders in place with no slide.

---

## 10. Limbo

`/games/limbo` · `components/games/Limbo.tsx`

> Build Limbo. One number, and it is the whole game.
>
> **Header eyebrow:** `SET A TARGET, SEE HOW HIGH IT GOES`.
>
> ### The rail, Limbo block
>
> **Target multiplier**, a mono input at 16px with a `×` as a permanent suffix, 44px tall.
> Below it, four quick-set ghost buttons in a row: `1.5×` `2×` `5×` `10×`.
>
> **Derived figure**, labelled `CALCULATED`: `WIN CHANCE`, mono, tabular.
>
> **Below 1.01× the play button reads `Target must be above 1.01×`** and the input border
> goes `--color-danger-line`.
>
> ### The surface
>
> **The result number is the entire surface.** `num-xl`, mono, tabular, centred, and
> nothing else in the frame except the target printed small above it at 13px mono
> `--color-muted`: `TARGET 2.00×`.
>
> **The count.** Requirements: it counts up and stops in under a second.
> - **760ms**, `--ease-out`, from `1.00×` to the result.
> - **It decelerates hard.** The last 20% of the number takes half the duration, so it
>   visibly slows as it approaches its ceiling, which is exactly what the game is about.
> - **It must not overshoot and settle back.** Limbo's number is a ceiling; a number that
>   goes past it and returns is a lie about the round.
> - **Crossing the target changes its colour mid count**, from `--color-ink` to gold, at
>   the exact frame it passes. On a losing round it never changes and stops in
>   `--color-muted`.
>
> That colour change is the game's one moment and it costs one comparison inside the count
> loop.
>
> **Win:** the local light pulses as the number lands, payout counts beneath.
> **Loss:** the light dips, and the number holds in `--color-muted` with the target line
> above it turning `--color-danger` for 600ms then back.
>
> ### The history strip earns its place here
>
> Requirements: Limbo players read streaks. So the strip carries **twenty** chips here
> rather than twelve, and each chip's fill is a function of how far it cleared: barely
> cleared is `--color-light-bg`, a big multiple is a stronger blue. A run of near
> misses looks different from a run of blowouts, which is what a streak reader is actually
> looking for.
>
> ### Auto-play
>
> **Deliberately absent, with a visible explanation.** A line beneath the play button at
> 12px `--color-muted`:
> **No auto-play here, on purpose.** Rounds that keep firing while nobody is watching are
> the ones people regret.
>
> Requirements asks for the explanation to be visible. It is not a tooltip and it is not
> in the FAQ. It sits under the button that would have had the feature.

---

## 11. Coming soon cards

> Blackjack and baccarat are lobby cards only.
>
> - **45% opacity**, no hover, no lift, `pointer-events: none` on the card body.
> - A `SOON` pill top right: `--color-line` border, 10px mono `--color-faint`.
> - Rendered as a `<div>` with `aria-disabled="true"`, **not** as a link.
>
> **They stay in the grid.** A five-card row with three cards in it looks broken, and the
> two placeholders are also the cheapest possible statement that more is coming.

---

## 12. Responsive

| Width | Shell | Board | Rail | Paytable |
|---|---|---|---|---|
| **≥1024** | `292px 1fr` | Keno 8 across | Sticky left, `top: 88px` | Flat row |
| **768–1023** | `260px 1fr` | Keno 8 across | Sticky left | Flat row, scrolls |
| **<768** | Single column | **Keno 5 across** | **Docked bottom**, fixed above the tab bar | Scrolls, masked edges |

**Phone specifics.**

- **The rail docks, it does not stack.** The play button has to be reachable with a thumb
  while the board is visible. A rail stacked above a 40-tile board puts the button off
  screen at the moment it is needed.
- The docked rail collapses to two rows: the bet amount with `½` and `2×`, and the play
  button. The risk grid, the picker and the derived figures move **above** the board into
  a collapsible block headed with the current selection, so the round's settings are one
  tap away and never in the way.
- Every control at least 44px under `(pointer: coarse)`.
- `touch-action: manipulation` on the board tiles so a fast double tap does not zoom.
- The fairness drawer is a bottom sheet at 80% height.
- Body padding reserves both the docked rail and the tab bar.

---

## 13. The copy block

Every viewer facing line, verbatim.

```
LOBBY
eyebrow    PROVABLY FAIR · PLAYED WITH COINS YOU EARNED WATCHING
title      Games
balance    Your ledger
table      Biggest hits today
kill       Games are switched off right now.
           Your balance is untouched and every round that was in progress
           settled normally. Coins keep earning while the stream is live.

SHELL
rtp        RTP 99.00%
sound      SOUND · ON / OFF
fair       Provably fair
error      Could not reach the server. Nothing has been staked.

BUTTON LABELS
           Place bet · Loading · Sign in to play · Not enough coins ·
           Pick 1–10 numbers · Set a target · Target must be above 1.01× ·
           Drawing… · Rolling… · Playing…

FAIRNESS DRAWER
lede       The hash below commits us to a seed we cannot change afterwards.
           Rotate it and we reveal the old one, so every round you played on it
           can be recomputed by anyone.
rows       SERVER SEED HASH · CLIENT SEED · NONCE
rotate     Rotate seed
           Rotating reveals your current server seed and starts a new one at
           nonce 0.
revealed   REVEALED · PREVIOUS SEED
verify     Verify a round

OPT-IN GATE
title      Turn games on
body       You need to be 18 or over. Matty Coins have no cash value, cannot be
           bought and cannot be withdrawn. Games are played for fun with coins
           you earned watching.
buttons    Turn games on · Read the responsible gambling page

SELF-EXCLUDED
           You've self-excluded from games.
           Your coins, the board, the shop and the giveaways all still work. If
           you want this lifted, the responsible gambling page explains how.

KENO
eyebrow    10 DRAWN FROM 40
rail       BET · HOW MANY NUMBERS · Pick · Clear picks · 7 / 10 SELECTED
risks      Classic · Low · Medium · High
limits     MIN 1 · MAX 5,000 · MAX WIN 100,000
paytable   RTP 99.00% · every tier is shown, including the ones that pay nothing

DICE
eyebrow    ROLL UNDER OR OVER
rail       Roll under · Roll over · TARGET
derived    WIN CHANCE · PAYOUT ON TARGET

LIMBO
eyebrow    SET A TARGET, SEE HOW HIGH IT GOES
rail       TARGET · 1.5× · 2× · 5× · 10×
derived    WIN CHANCE
autoplay   No auto-play here, on purpose. Rounds that keep firing while nobody
           is watching are the ones people regret.
```

**Copy gate:** zero em dashes, zero stock words, run before this section is shown to
anyone. The `…` in `Drawing…` is an ellipsis and is fine.

---

## 14. States to build

| State | Where | Behaviour |
|---|---|---|
| Signed out | Lobby, all games | Board, odds, paytable and RTP all render fully. Button reads `Sign in to play`. **Never hide the game behind auth** |
| Session loading | All games | Button reads `Loading`, rail disabled, board renders idle |
| Bet above balance | Rail | Button reads `Not enough coins`, disabled. Balance figure does **not** turn red |
| Bet above the cap | Rail | Input border danger, limits line names the cap. **Never silently clamp while typing** |
| Round in flight | All games | Every control disabled at 55%, button names the action in progress |
| Round settled, win | All games | Local light pulses once, payout counts, chip slides in |
| Round settled, loss | All games | Light dips, `0.00×` printed, chip slides in unlit |
| Network error | Rail | Danger panel under the button, **and the sentence about the stake** |
| Keno, drawn but not picked | Board | **Sunken, darker than idle, struck through.** The regression to watch |
| Keno, slider dragged up | Rail | Existing picks kept, difference added |
| Keno, slider dragged down | Rail | Most recent additions dropped, tapped picks kept |
| Keno, reveal interrupted | Board | Tap completes it instantly, all final states |
| Keno, zero hits | Paytable | The `0.00×` cell highlights. Never a blank table |
| Dice, consecutive rolls | Surface | Previous marker holds at 25% until the next lands |
| Limbo, crossing the target | Surface | Number changes colour **at the frame it passes**, never after |
| Limbo, losing round | Surface | Number holds in muted, target line flashes danger for 600ms |
| Seed rotated | Drawer | Revealed panel appears and **persists for the session** |
| Games opted out | Game route | Gate replaces the surface. **Never a modal over a live board** |
| Kill switch on | Lobby, game routes | Whole lobby replaced by one panel. Rail removed, not disabled |
| **Self-excluded** | Nav, tab bar, lobby, games, **home** | Games link **absent**. Routes render the self-excluded panel. **The homepage games section is absent too** |
| No rounds today | Lobby | Table absent entirely, not rendered empty |
| Coming soon game | Lobby | 45% opacity, `SOON` pill, not a link |
| Sound never touched | Shell | Off. Labelled, so it is discoverable |
| Reduced motion | All games | No pulses, no counts, no reveal sequence. Every result still legible from text and colour |

---

## 15. The self test

1. Screenshots of the lobby and all three games at **1440×900, 1280×800, 375×812**.
2. **The Keno greyscale test.** Screenshot the board mid round with all four tile states
   present, desaturate it, and confirm all four are still distinguishable. **If this fails
   nothing else matters.**
3. **The picker test.** Pick three numbers by tapping. Drag the slider 3 → 6. Confirm all
   three survive. Drag 6 → 3. Confirm the three tapped ones survive.
4. Every play button label forced: loading, signed out, no picks, not enough coins, over
   the cap, in flight.
5. **Double-tap the play button** and confirm one round opens, not two.
6. The reveal interrupted by a tap at tiles 2, 5 and 9.
7. Every zero tier visible in every paytable at every risk and pick count.
8. **The RTP on screen in all three games**, without opening anything.
9. The fairness drawer: focus trapped, `Escape` closes, focus returns, rotation reveals
   and the revealed panel persists.
10. `Verify a round` prefills `/verify` correctly from a real round.
11. **The network error path**, by blocking `/api/games/play`. Confirm the sentence about
    the stake renders.
12. Opt-in gate, kill switch and self-excluded states all forced, and confirmed to look
    like three different things.
13. **Self-exclusion checked in four places:** nav, tab bar, `/games`, and the homepage.
14. Reduced motion on, then flipped mid round.
15. Console clean. Sound off by default.
16. **The fresh eyes pass.** Would a first-time visitor believe this is fair? Can they
    find out for themselves in one click?

---

## 16. Build order

```
§2 shell + §3 rail       everything sits inside them
§4 result                shared by all three
§8.2 Keno tile states    the highest risk thing in the section
§8.1 + §8.3 + §8.4       Keno complete
§10 Limbo                one number, and it proves the count
§9 Dice                  the simplest, and it reuses everything above
§5 fairness drawer       the section's reason for existing
§6 gates                 three states that must not look alike
§1 lobby                 last, because it is a grid of links to finished things
§7 sound                 folded in as the shell is built
```

**Keno's tile states come before Keno's controls.** The board is the thing that breaks,
and building the rail first means discovering the state problem after the layout is
committed.

**The lobby is last.** It is a card grid and a table pointing at games, and building it
before the games exist means building it twice.

---

## 17. The homepage games section — the gap

**This does not exist yet and it is a real hole.** `MattySpins-UI-Requirements.md` §3 Home
lists nine sections and none of them is games, so `MattySpins-Home-UI-Spec.md` correctly
has no games section. But the funnel has a break in it: the homepage spends a whole
section (§5) teaching a visitor how to earn coins, and then never tells them there is
somewhere to spend them beyond a nav link.

> **Proposed: a games strip on the homepage**, sitting **directly after §5 coin rules**
> and before §6 clips. That position is the funnel: you just learned how coins are earned,
> so the next thing is what they are for.
>
> **Deliberately a strip, not a section.** Three cards in a row, the lobby's key art at
> half the lobby's scale, one heading and one ghost link. It must not compete with §9,
> which is the page's single call to action.
>
> - Eyebrow: `PROVABLY FAIR · PLAYED WITH COINS YOU EARNED`
> - Title at `display-s`, **not** `display-m`, so it sits below the sections around it.
> - Three cards at 4:5, `.lit`, name over a scrim. Same hover as the lobby.
> - One ghost link: `All games` → `/games`.
> - **No balance panel here.** The coin bar in the nav already carries it and repeating it
>   makes the strip look like a page.
>
> **Skeleton check:** §5 is a vertical sequence and §6 is a full bleed rail, so a
> three-card row between them does not repeat either neighbour. The rhythm table in the
> home spec holds.
>
> **Absent entirely for a self-excluded viewer**, same rule as the nav link (§6). This is
> the easiest place in the app to break that rule, because it is not a games route.

**This section is a proposal, not a decision.** It changes the homepage, which is signed
off, and it sits near the page's one call to action. It goes into
`MattySpins-Home-UI-Spec.md` as §5.5 on your yes.
