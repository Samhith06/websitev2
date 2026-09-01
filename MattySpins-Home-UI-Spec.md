# MattySpins Home — Complete UI Specification

The homepage, in full. Companion to `MattySpins-LateNight-UI-Spec.md`, which holds the
tokens (§1), the type scale (§2), the light layer (§3), the motion system (§4) and the
primitives (§5). **Read those five sections first.** Everything here assumes them and
none of it works without them.

Content, data and behaviour come from `MattySpins-UI-Requirements.md` §3 Home. This
document adds the visual system, the layout, the motion and the copy.

**Route:** `app/(site)/page.tsx`. Layout only. Every `await` in that file stays exactly
as it is.

---

## The organising principle

The homepage answers four questions, in this order, and the order is the page:

```
   1. IS HE ON?            the light, the hero            §1 / §2
      ↓
   2. AM I EARNING?        the docked bar                 §1
      ↓
   3. WHAT'S IT WORTH?     the strip, the board           §3 / §4
      ↓
   4. HOW DO I GET IN?     the coin rules, the hold       §5
      ↓
   ─────────────────────────────────────────────────────
   proof: clips, wins, the man himself   §6 / §7 / §8
      ↓
   5. THE ONE THING TO DO  Razed under code MATTY         §9
```

Questions one and two are answered above the fold, without scrolling, in every state.
Everything below the fold exists to earn the scroll to §9.

**The page has one call to action.** Not three. The Kick link, the board link and the
shop link are navigation. Razed under code MATTY is the conversion, it appears once, and
it is the brightest object on the page.

---

## The page skeleton

```
┌──────────────────────────────────────────────────┐
│  NAV  · lit hairline when live                   │  sticky, 64 → 56
├──────────────────────────────────────────────────┤
│                                                  │
│         §1 HERO  ·  the player is the light      │  centred, 1080px
│         headline overlapping its top edge        │
│         earning bar docked to its bottom edge    │
│                                                  │
├──────────────────────────────────────────────────┤
│  §3 STRIP   [ POOL 1.4fr ][ 3 rows 1fr ]         │  asymmetric split
├──────────────────────────────────────────────────┤
│  §4 BOARD   podium 3 unequal + rows 4–6          │  broadcast table
├──────────────────────────────────────────────────┤
│  §5 COINS   vertical numbered sequence           │  drawn line, left
│             + THE HOLD                           │
├══════════════════════════════════════════════════┤
│  §6 CLIPS   full bleed rail, masked ends         │  breaks container
├══════════════════════════════════════════════════┤
│  §7 WINS    full bleed, LIGHT MASKED OFF         │  darkest point
├──────────────────────────────────────────────────┤
│  §8 ABOUT   portrait as a second light source    │  interlocked
├──────────────────────────────────────────────────┤
│  §9 CTA     the only large blue area          │  brightest point
├──────────────────────────────────────────────────┤
│  FOOTER  ·  no light, flat canvas                │
└──────────────────────────────────────────────────┘
```

---

## The four highest-value decisions on this page

**1. The player is the light source, and it is centred.** Text left, video right is the
most common arrangement on the internet for a streamer page, and it puts the single most
important object on the site in the weaker half of the screen. Here the player is the
composition: the headline overlaps its top edge, the earning bar attaches to its bottom
edge, and the room's key gradient originates behind it. If those three things do not
agree, the room has two suns and the page falls apart.

**2. Live and offline are two different compositions, not one with a flag.** The site is
dark more hours than it is lit, so the offline hero is the state most visitors actually
see. It gets its own hierarchy: the countdown is the hero, the headline is the caption
underneath it, and the countdown is the only lit object on the page.

**3. No two adjacent sections share a skeleton.** The current page runs eyebrow, title,
chip row right, grid, four times. The rhythm table below is the fix and it is enforced,
not aspirational. If two neighbours ever end up with the same shape, one of them gets
reshaped, not shipped.

**4. The hold is the premise, performed.** §5.1 is the one designed interaction on the
whole site. The visitor does not read that being in the room pays. They hold a coin for
2.6 seconds and watch twenty ticks land at their own rate. It is the highest effort
component on the page and the page ships without it if it has to, which is why it is
built last.

---

## The section rhythm

Every section's shape, in order, so the repeats are visible at a glance.

| § | Section | Skeleton | Container | Light |
|---|---|---|---|---|
| 1 | Hero, live | Centred stack, player dominant | 1080px | Key, full |
| 2 | Hero, offline | Centred stack, countdown dominant | 1080px | Key at 1/7 |
| 3 | Strip | Asymmetric 2 col, `1.4fr 1fr` | Page | Falloff |
| 4 | Board | Podium 3 unequal + rows | Page | Falloff, per rank |
| 5 | Coins | Vertical sequence, drawn line left | Page, narrow | Falloff |
| 6 | Clips | Horizontal rail, masked ends | **Full bleed** | Falloff |
| 7 | Wins | Asymmetric 3 col, huge numerals | **Full bleed** | **Masked off** |
| 8 | About | Interlocked 2 col, unequal heights | Page | Second source |
| 9 | CTA | Single filled panel, `1.6fr 1fr` | Page | Peak |

No two rows next to each other share a Skeleton value. That is the test.

**Vertical rhythm.** 96px between sections on mobile, 140px on desktop. Full bleed bands
(§6, §7) get 120px and 180px, because a band that runs edge to edge needs more air around
it or it reads as a mistake rather than a decision.

---

## The data map

Every figure on this page, and where it already comes from. **None of this changes.**

| Section | Consumes | Notes |
|---|---|---|
| §1, §2 | `currentStream()` → `stream` | `live`, `viewers`, `channel`, `title`, `startedAt`, `nextStreamAt`, `thumbUrl`, `lastVod*` |
| §1, §2 | `viewerOrSignedOut()` → `viewer` | `signedIn`, `kick`, `frozen`, `multiplier` |
| §2 | `schedule` from `lib/mock` | Day, time, note, platform |
| §3 | `currentPeriod('weekly')` | `pot`, `endsAt`, `tiers` |
| §3 | `earnersNow()`, `paidOutToDate()` | **Both null without a database. Render `—`** |
| §4 | `fetchRazedLeaderboard()` → `toBoardRows()` | With `prizeForRank(tiers, rank)` |
| §4 | `healthFrom(feed)` → `lastSyncAt` | The provenance line. Not decoration |
| §5 | `viewer.multiplier` | The hold uses the viewer's own rate |
| §6 | `publishedClips(12)` | |
| §7 | `publishedBigWins(3)` | Featured + two compact |
| §8 | `aboutCopy`, `portraitUrl`, `schedule`, `socials` | |
| §9 | `razed` | `referralCode`, `offer`, `affiliateUrl` |

**Requirements rule 3 is enforced by `Num`, not by this page.** Any figure that is null
renders `—`. `earnersNow()` in particular must never read `0`, because zero is a claim
that nobody is watching.

---

## 1. Hero — live

> Build the live hero. `min-height: 88vh` on desktop, `auto` on mobile, with the content
> optically centred rather than mathematically centred: the stack sits about 4% above
> true centre, because a centred block always reads slightly low.
>
> **Container:** a single centred column, `max-width: 1080px`.
>
> ### The player
>
> The player is the composition's anchor and the light's origin.
>
> - 16:9, full column width, `--radius-card`, `1px solid var(--color-line-lit)`.
> - **The bloom** is a pseudo element behind it: a radial blue gradient extending
>   roughly 180px past every edge, `rgb(43 143 255 / .28)` at the source, transparent by
>   the outer edge. This is the visible origin of the light layer's key gradient at
>   `50% 18%`. **The two must agree.** If the bloom sits at 50% 18% and the key gradient
>   does not, the room has two suns and every card below is lit from a direction the eye
>   cannot find.
> - Inside: `PlayerFrame` with the Kick embed. It does not animate in. It is already
>   there, lit, before the words arrive. The room existed before the visitor did.
>
> ### The headline overlap
>
> **The headline sits on top of the player's top edge, overlapping by 40px** on desktop
> and 24px on mobile, with `z-index` above it and a scrim beneath.
>
> This overlap is the whole composition. Without it the section is a headline and then a
> video below it, which is every other streamer page. With it, the words are lit by the
> screen they are standing in front of.
>
> **The scrim** is a vertical gradient from `rgb(10 8 23 / .82)` to transparent, sized to
> the headline's box plus 24px, so the worst pixel under any character passes **3.5:1**.
> Measure it, do not eyeball it. The Kick thumbnail is a slot screenshot and slot
> screenshots are bright.
>
> ### The docked bar
>
> **Full width of the player, zero gap, sharing its bottom corners.** It reads as attached
> hardware, not as a card that happens to sit below.
>
> - `background: var(--color-panel)`, top border `--color-line-lit`, bottom corners
>   `--radius-card`, top corners `0`.
> - 64px tall, `padding: 0 20px`, contents baseline aligned.
> - Left: a 36px square lit tile holding the state's mark. Then the label at `label` size
>   in `--color-muted`, and the sentence beneath at 15px.
> - Right: a chevron when the whole bar is a link, absent when it is not.
>
> **Four states, and they must say the same words as the nav coin bar** (`Late Night §7`).
> A viewer who sees two different answers on one page stops trusting both.
>
> | State | Mark | Hairline | Copy | Links to |
> |---|---|---|---|---|
> | Signed out | Discord | `--color-line` → blue on hover | **Sign in to start earning.** It takes about a minute. | sign in |
> | No Kick | Coin | `--color-gold-line` | **Link your Kick account to start earning.** | `/me` |
> | Earning | Coin | `--color-line` | **You're earning `2 MC` every 3 minutes.** Sub multiplier applied. | none |
> | Frozen | Zap | `--color-danger-line` | **Earning is paused on your account.** | `/me` |
>
> In the earning state the rate figure is gold, mono and tabular, and it **counts on each
> tick** rather than snapping. The multiplier suffix only renders when the multiplier is
> above 1. At 1× the sentence ends after "3 minutes".
>
> ### The eyebrow
>
> Above the headline, `label` size, blue, with a 6px pulsing dot on a 3 second cycle:
>
> `● LIVE ON KICK`
>
> Then, **only when `stream.viewers` is not null**, a `--color-line` hairline separator
> and `2,431 WATCHING` in `--color-ink-2` with the figure in mono. Kick's webhook carries
> no viewer count, so when there is no count **the whole element goes** rather than
> rendering a number nobody measured.
>
> ### Copy, verbatim
>
> - H1, `display-xl`, centred, capped at `14ch` **on the h1 itself**:
>   **You're in the room.**
> - Sub, `body-l`, `--color-ink-2`, centred, capped at `46ch` on the paragraph:
>   Talk in chat and you earn Matty Coins every three minutes. Stay all week and you're on
>   the board.
> - Buttons, centred, 12px gap: `Watch live` primary with the Kick mark, opening in a new
>   tab with `rel="noopener noreferrer"`. `See the board` outline, to `/leaderboard`.
> - Below the player and the docked bar, one row at 13px mono, baseline aligned: the
>   stream title left, truncated, and `UPTIME 3:42:11` right, both `--color-muted`.
>
> ### The entrance
>
> Load driven, not scroll driven. There is nothing above this to scroll back to.
>
> ```
> 0ms      player + bloom already painted, no animation
> 120ms    eyebrow fades, dot begins its cycle
> 200ms →  headline words rise 24px into place, reading order, 60ms apart
> 700ms    sub fades, 12px rise
> 900ms    buttons, 120ms apart
> 1040ms   docked bar rises 8px into its dock
> ```
>
> Headline words split with `SplitText`. Transform and opacity only. Under reduced motion
> every element renders in its final state at 0ms and nothing moves.

---

## 2. Hero — offline

The state most visitors actually see. It has a different job: say when he is back, and
give them something to do until then.

> Build the offline hero as a genuinely different composition. Not the live hero with
> pieces hidden.
>
> **The room light drops to a seventh of its live strength and stops drifting.**
> Stillness is this state's entire character, and it is what makes the return to live
> land.
>
> ### The countdown is the hero
>
> It sits where the headline sat, centred, and it is **the only lit object on the page**.
>
> - Four cells: days, hours, minutes, seconds. `CountdownBoxes` (`Late Night §33`).
> - Figures at `num-xl`, gold, mono, tabular, with **fixed width digit cells** so the
>   layout does not jitter as 10 becomes 9.
> - Unit labels beneath each cell at `label` size in `--color-muted`.
> - **A gold bloom** on a pseudo element behind the group, `rgb(240 180 41 / .16)`,
>   extending 140px past its edges. This is the offline page's light source.
> - Under a minute the figures turn `--color-danger`. That is the only place danger
>   colour appears outside an error state on this page, and it is earned.
>
> ### Then the headline, as the caption
>
> **`display-l`, beneath the countdown.** This inverts the usual hierarchy and it is
> correct here: the number is the news, the sentence is the caption.
>
> ### Copy, verbatim
>
> - Eyebrow, `label`, `--color-muted`, **no dot, no pulse**: `OFFLINE`
> - Countdown, then H1 at `display-l`, capped at `18ch`:
>   **The room opens Thursday, 8PM.**
>   The day and time come from `stream.nextStreamAt`, formatted in UK time, and the
>   sentence is built around them rather than appended to them.
> - Sub, `body-l`, capped at `46ch`:
>   Coins pause when the stream does. The board, the shop and the giveaways keep running.
> - Buttons: `Watch last stream` primary, `Wall of fame` outline to `/wins`.
>
> ### The last stream, deliberately smaller
>
> The VOD sits below the buttons at **roughly 60% of the live player's width**, off
> centre to the left, **unlit** — no bloom, `--color-line` border, thumbnail at 90%
> brightness. A play affordance at 44px and the title beneath at 13px mono.
>
> It is a record, not an event, and it must not be composed like one. Giving the VOD the
> live player's treatment is the single easiest way to make an offline page look like a
> broken live page.
>
> ### The schedule replaces the docked bar
>
> A lit panel beneath the countdown, **not beneath the VOD**, because it belongs to the
> countdown's story.
>
> Three or four rows, grid `72px 1fr auto`: day at 14px mono, time at 14px mono tabular,
> platform at 12px mono `--color-muted`. **The next slot's row is gold**; the rest are
> `--color-ink-2`. Hairline separated. Footer line at 11px mono `--color-faint`:
> All times UK. Extra streams get announced in Discord.
>
> ### Motion
>
> **The seconds digit is the only thing that moves on an offline homepage above the
> fold.** One 1px rise on change, no crossfade. Everything else is still.
>
> Entrance: countdown fades in at 120ms, headline at 320ms, sub at 520ms, buttons at
> 680ms, schedule at 820ms. No word splitting here. The offline hero is quieter in every
> respect and its entrance should be too.

---

## 3. The strip

> Build the stat strip. **Not four equal boxes.** These four figures are not equally
> interesting and rendering them identically says they are.
>
> **Desktop:** a two column grid at `1.4fr 1fr`, 20px gap.
>
> **Left, alone, on a lit panel with a `--color-gold-line` hairline:** the weekly prize
> pool. Label above at `label` size. Figure at `num-l` in gold with its currency symbol.
> `padding: 28px 32px`. This panel is roughly 200px tall and it is the only thing in it.
> The empty space is the point.
>
> **Right, a stack of three rows**, hairline separated, each `label` left and figure
> right, **baseline aligned**, 56px tall:
>
> | Label | Figure | Source |
> |---|---|---|
> | `BOARD RESETS IN` | `Countdown` inline, `num-m` | `weeklyPeriod.endsAt` |
> | `EARNING RIGHT NOW` | `num-m` ink | `earnersNow()` |
> | `PAID OUT TO DATE` | `num-m` gold | `paidOutToDate()` |
>
> **Mobile:** the pool full width on top, then the three rows stacked beneath it.
>
> **Every figure obeys Requirements rule 3.** Null renders `—`, enforced inside `Num`.
> `EARNING RIGHT NOW` is null without a database and **must not read `0`**. Zero is a
> claim that nobody is watching, and it is a claim we cannot make.
>
> **Living element:** the countdown's seconds. Nothing else in the strip moves.
>
> **Entrance:** the pool figure counts from 0 to its value over 900ms on `--ease-out`
> when the section enters the viewport, once. The three rows fade at 70ms steps. Under
> reduced motion the figure is at its value immediately, no count.

---

## 4. The board preview

> Build the weekly board preview as a broadcast table.
>
> **Header:** `SectionHeading` with the Razed Z mark in the eyebrow,
> `WAGERED ON RAZED UNDER CODE MATTY`. Title `This week's board` at `display-m`. Right
> slot: period chips, `Weekly` active, `Monthly` linking to `/leaderboard?period=monthly`.
>
> ### The podium reuses the signature
>
> Three cards, **unequal**, rank one centre and taller. Grid `1fr 1.15fr 1fr` with rank
> one at 100% height and ranks two and three at 88%, bottom aligned.
>
> **Each catches a different amount of light**, and this is the section's whole idea:
>
> | Rank | Gradient | Hairline | Numeral |
> |---|---|---|---|
> | 1 | Full `.lit` at 100% | `--color-gold-line` | `--color-gold` |
> | 2 | `.lit` at 60% | `--color-silver` at 40% | `--color-silver` |
> | 3 | `.lit` at 25% | `--color-bronze` at 40% | `--color-bronze` |
>
> The light literally falls off down the podium, which means **the ranking reads before a
> single number does.** That is the signature earning its keep in a second place.
>
> **Each card:** rank numeral at `num-l` in the metal, avatar at 44px, username at 16px
> Manrope 600 truncated at `18ch`, wagered at `num-m` gold with its unit, prize beneath at
> 13px mono gold.
>
> **Mobile:** the podium becomes three full width rows in rank order, keeping the
> gradient falloff. Three cards at 110px wide is not a podium, it is a receipt.
>
> ### Ranks four to six
>
> `BoardRows`, full width, hairline separated, 64px tall, grid
> `48px 44px 1fr auto auto` (`Late Night §32`). No zebra striping: it fights the light and
> makes the board look like a spreadsheet.
>
> ### The footer line, and it is not decoration
>
> `Updated 4 minutes ago · all times UTC` at 12px mono `--color-faint`, left. Right, a
> ghost link `View the full board` with a trailing arrow that slides 3px on hover.
>
> Requirements rule 4: provenance travels with money. **This line is the page's
> credibility** and it is never dropped for layout reasons.
>
> ### Two states that must not look alike
>
> **Empty**, when the feed answered and returned nobody:
> **No board to show yet.** Positions come straight from Razed for accounts registered
> under the code MATTY. Nothing appears here until that feed returns players.
>
> **Unreachable**, when the feed did not answer: a `--color-danger-line` hairlined panel
> stating the feed did not respond, showing the last successful sync time, with a retry.
>
> **Rendering an unreachable feed as an empty board is the worst failure this page can
> have**, because it silently tells every viewer they are not on the leaderboard.
>
> ### Entrance
>
> The three podium cards rise 20px in **rank order**, one, two, three, 90ms apart, so the
> winner arrives first. Rows fade at 50ms steps beneath. The footer line fades last.

---

## 5. The coin rules

This section carries the premise, so it gets the site's one designed interaction.

> Build the coin rules as a **vertical numbered sequence**, not three cards in a row.
> Container narrowed to `860px`, because a vertical sequence in a 1200px container has
> nowhere to sit.
>
> **The drawn line.** A hand authored SVG path runs down the left of the sequence,
> connecting each rule's node to the next. It draws itself on scroll via
> `stroke-dashoffset` mapped to the section's scroll progress, and **holds once complete**
> rather than reversing. 2px, `--color-light-line`, with the three nodes as 9px filled
> blue dots that light as the line reaches them.
>
> **Each rule** is a grid at `56px 1fr`:
> - Left column: the mono index (`01`, `02`, `03`) at 13px in `--color-faint`, sitting at
>   the line's node.
> - Right column: the figure at `num-l` in gold with its unit at 15px `--color-muted` on
>   the same baseline, then the body at `body` in `--color-ink-2` capped at `58ch` **on
>   the paragraph**.
> - 48px between rules.
>
> **Rule three is the only one on a lit panel**, with a `--color-light-line` hairline and
> 24px padding, because the sub multiplier is the one that costs money and it should look
> like it.
>
> ### Copy, verbatim
>
> **01** · `1 MC` · every 3 minutes
> Say anything in chat and you start earning. One message keeps you earning for the next
> fifteen minutes, and the bot drops a claim word every twenty so quiet people never have
> to spam.
>
> **02** · `+10 MC` · for a full hour
> Twenty ticks in a row with no gap pays a bonus on top. Miss one and the run resets. It
> pays for being here, not for leaving a tab open.
>
> **03** · `2×` · everything, for subs
> Any sub tier doubles every coin you earn. VIPs earn 2.5×. Multipliers never stack, so
> the highest single one applies and a VIP who also subs earns 2.5×, not 5×.
>
> **Closing line**, 14px `--color-muted`, capped at `62ch`, 40px below the sequence:
> Coins cannot be bought. There are no packages, no top ups and no payment path. They are
> earned by turning up and nothing else. They have no cash value and cannot be
> transferred.

### 5.1 The hold

The one designed interactive moment on the site. The visitor does not read that being in
the room pays. They perform it.

> Build `components/system/HoldToEarn.tsx` (client). It sits at the head of the sequence,
> above rule 01, centred, with the drawn line beginning beneath it.
>
> ### Resting state
>
> - The coin mark at 140px, centred, with a 4px `--color-line` ring around it drawn as an
>   SVG circle with `stroke-dasharray` set to its full circumference.
> - Above, at `label` size in `--color-muted`: `HOLD THE COIN. SEE WHAT AN HOUR IS WORTH.`
> - Beside it, a mono figure at `num-l` in `--color-muted` reading `0 MC`.
>
> ### Semantics, and they are not optional
>
> The element is a **`<button>`**, so Space and Enter hold it exactly as a pointer does.
> `aria-label="Hold to preview an hour of earning"`. The figure sits in an `aria-live`
> polite region that announces only the final value, not every tick, or a screen reader
> reads twenty numbers in three seconds.
>
> Handle `pointerdown` / `pointerup` / `pointercancel` / `pointerleave` and
> `keydown` / `keyup` on Space and Enter. **`pointerleave` counts as a release**, or a
> visitor who drags off the coin leaves it stuck at 60%.
>
> ### On hold
>
> - **Progress climbs 0 → 1 over 2600ms, linearly.** It represents time passing and
>   easing it would lie about that. This is the one place on the site where linear is
>   correct.
> - The ring fills as `stroke-dashoffset`, blue, tracking progress exactly.
> - **The figure ticks in twenty discrete steps, not smoothly.** Each step is the
>   viewer's own rate from `viewer.multiplier`:
>
>   | Viewer | Step | Twenty ticks |
>   |---|---|---|
>   | Signed out or 1× | `1 MC` | `20 MC` |
>   | Sub, 2× | `2 MC` | `40 MC` |
>   | VIP, 2.5× | `2.5 MC` | `50 MC` |
>
>   Each step lands with a 2px scale pop on the coin, 90ms, `--ease-out`. **Twenty
>   distinct events in under three seconds is what makes it feel like accrual rather than
>   a progress bar.** A smooth counter here would be a loading spinner with better
>   typography.
> - **The room light brightens by about 15% for the duration** and eases back on release.
>   The signature responds to the visitor, once, in one place on the whole site.
>
> ### On release before completion
>
> Progress eases back to 0 over 500ms on `--ease-out` and the figure counts down with it.
> **It never snaps to zero.** Releasing early has to feel like losing something, because
> in the actual game it is.
>
> ### On completion
>
> 1. `0ms` the ring flashes to `--color-light-hot` and back over 240ms.
> 2. `200ms` after the twentieth tick, the `+10 MC` hour bonus lands **as a separate
>    event**, in gold, with its own pop. It is a different reward and it must not be
>    absorbed into the count.
> 3. `400ms` the three rules light in sequence, 120ms apart: each gains its hairline and
>    its figure resolves from `--color-muted` to gold.
> 4. `800ms` the closing line fades in beneath at 15px:
>    **That's 30 MC for an hour. Seven days of that and you're on the board.**
>    **The figure in that sentence is the viewer's own number**, computed from their
>    multiplier: 30 at 1×, 50 at 2×, 60 at 2.5×. Not the example.
> 5. Signed out only, the line gains a trailing ghost link: `Sign in and start`
>
> ### Reduced motion
>
> **No hold required.** The whole component renders in its completed state on entry: ring
> full, figure at target, bonus landed, rules lit, closing line present. Flipping reduced
> motion on **mid hold completes it immediately** rather than abandoning it at 40%.
>
> ### Repeat
>
> After completion the coin stays completed. Pressing again replays the ticks from zero
> once, then settles back to complete. It never resets to the empty state, because the
> section below it is now lit and un lighting it would be nonsense.

---

## 6. The clip rail

> Build clips as **the only full bleed horizontal element on the page.** It breaks the
> container to both edges of the viewport.
>
> **Header stays in the container:** title `Clips` at `display-m`, source chips right —
> All, Kick, YouTube, Instagram, X — each linking to `/clips` with its filter.
>
> **The rail** runs edge to edge below: `overflow-x: auto`, `scroll-snap-type: x
> mandatory`, 20px gaps, first and last card padded to the container's inset so the row
> starts aligned with the header.
>
> **Cards:** 320px wide, 16:9 thumbnail, `.lit`, blue top edge at 30% that brightens
> to 100% on hover. Duration pill bottom right in 11px mono over a scrim. Platform mark
> top left. Title at 14px Manrope 600 clamped to two lines. Beneath, 12px mono
> `--color-faint`: source and relative time.
>
> **Both ends fade.** A 120px `mask-image` on each edge of the rail so cards dissolve
> rather than being cut. **This is what makes it read as continuing past the screen
> instead of ending at it**, and it is the difference between a rail and a row.
>
> **Hover:** lift 4px, thumbnail scales to 1.04 inside its clipped bounds, blue edge
> brightens. 240ms `--ease-out`. Under `(pointer: coarse)` there is no hover and the tap
> target is the whole card.
>
> **Keyboard:** the rail is focusable, left and right arrows move between cards, and the
> focused card scrolls into view. A horizontal rail that only works with a mouse is
> broken, and this one is 12 cards long.
>
> **Living element:** none. This section is busy enough already.
>
> **Absent entirely when `clips.length === 0`.** No empty state on the homepage; the
> section simply is not there. An empty rail says the stream produces nothing.

---

## 7. The wins band

The darkest point of the page, which is what sets up §9 being the brightest.

> Build the wins band as full bleed, and **mask the room light off it.** Its background is
> flat `--color-canvas` with the fixed gradient suppressed, so scrolling into it feels
> like walking away from the screen.
>
> **The multipliers are the only lit things in it.**
>
> **Layout:** an asymmetric three column grid, 20px gaps.
> - The featured win spans **two columns and the full height**.
> - Two compact wins stack in the third column.
>
> **Featured card:**
> - Multiplier at `num-xl` (`clamp(72px, 12vw, 180px)`), gold, mono, tabular, with a gold
>   bloom behind it. At the top of the range that is 180px of number, and it should be.
> - Slot name at `display-s` beneath.
> - Stake and payout at `num-s` in `--color-muted`, baseline aligned on one row.
> - The clip thumbnail as a background at 22% opacity behind the whole card, with a
>   left to right scrim so the numerals stay at 4.5:1.
>
> **Compact cards:** multiplier at `num-m`, slot name at 15px, stake and payout at 12px
> mono.
>
> **Every card carries provenance:** date and platform at 12px mono `--color-faint`, with
> the clip thumbnail as the evidence. Requirements rule 4 again. **This whole section is
> claims unless it is sourced.**
>
> **Header:** eyebrow `REAL BETS, REAL PAYOUTS, ON STREAM`, title `Biggest wins` at
> `display-m`, sort chips right — By multiplier, By win, All time. Button beneath the
> grid: `See the wall of fame`, outline, to `/wins`.
>
> **Entrance:** the featured multiplier **counts from 0 over 1100ms on `--ease-out`**, so
> it decelerates into its final value the way a slot's own counter does. This is the one
> place on the site where a number's animation is allowed to be theatrical. The two
> compact cards fade at 90ms steps after it lands.
>
> **Absent entirely when `bigWins.length === 0`.**

---

## 8. About Matty

> Build the about section with the portrait treated as **a second light source**, not as
> an image in a column.
>
> **Layout, desktop.** The portrait sits left at roughly 40% width. The text sits right,
> and **starts above the portrait's top edge and ends below its bottom edge**, so the two
> interlock rather than sitting in matched grid cells.
>
> Implementation: a `grid-template-columns: 40% 1fr` with the text column given
> `margin-block: -48px` against the portrait's row, or a 12 column grid with the portrait
> at columns 1–5 rows 2–5 and the text at 6–12 rows 1–6. Either works. **The asymmetry is
> the requirement**, because the section immediately above is a rigid three column grid
> and this one must not be.
>
> **The portrait:** `--radius-card`, `object-fit: cover`, capped at its own natural width
> of 472px so it is never upscaled, with a blue bloom behind it at **60% of the hero
> player's strength**. Strong enough to read as a light source, quiet enough not to
> compete with the hero.
>
> **Text:** `About` label, `About Matty` at `display-m`, then `aboutCopy` at `body-l` in
> `--color-ink-2` with a `54ch` cap on the paragraphs. **Any em dashes in the existing
> copy are rewritten before it ships** (see the copy gate below).
>
> **Two quiet lit panels beneath**, side by side, each with a hairline header:
>
> - **Stream schedule.** Day left at 14px mono, time right at 14px mono gold tabular, one
>   row each, 6px vertical padding. Footer at 11px mono `--color-faint` above a hairline:
>   All times UK. Extra streams get announced in Discord.
> - **Where to find him.** Platform mark at 15px, handle in 12.5px mono, one row each,
>   hovering to blue. Footer link, ghost, 11px mono:
>   `Check an account is really his` → `/official`.
>
> **Living element:** the portrait's bloom breathes on a **7 second** cycle at ±8%
> opacity, `-3s` delay so it is mid cycle at first paint. Slow enough that it reads as a
> room rather than a pulse.
>
> **Mobile:** portrait full width on top, text beneath, panels stacked. The interlock is a
> desktop idea and does not survive one column, so do not fake it.

---

## 9. The one call to action

Every section above earns the scroll to this one.

> Build the Razed section as **the only place on the page where blue fills a large
> area.** Everything else has been quiet so that this reads as loud.
>
> **A full width panel**, `--radius-card`, 40px padding on desktop and 24px on mobile:
> - Fill: a linear gradient at 100deg from `--color-light-bg` to
>   `color-mix(in oklab, var(--color-light-bg) 70%, var(--color-light) 30%)`.
> - Border: `1px solid var(--color-light-line)`.
> - The room light peaks on it, so this panel gets the strongest `.lit` gradient on the
>   page.
>
> **Layout:** `grid-template-columns: 1.6fr 1fr`, baseline aligned. Copy left, mark and
> button right. Stacked on mobile with the button full width.
>
> ### Copy, verbatim
>
> - Title at `display-m`: **Play on Razed under code MATTY**
>   The code is set in **mono at the same size** as the display text around it. It is the
>   one place on the page where display and mono share a line, and it should look
>   deliberate rather than accidental: give the mono run a `--color-light-hot` colour so
>   the eye reads it as a token, not as a typo.
> - Body at `body`, `--color-ink-2`, capped at `50ch`:
>   Sign up under the code and every dollar you wager counts towards the weekly board
>   automatically. There is nothing to link and nothing to claim until the period closes.
> - Right: `RazedWordmark`, then the button.
> - Button: `Claim the bonus`, **primary, `lg`**, external, with
>   `rel="noopener noreferrer"`.
>
> **The button is the brightest object on the entire page.** Nothing above it competes. If
> anything does, the thing above it is wrong, not this.
>
> **Living element:** a slow blue sweep across the panel's top hairline, 6 seconds,
> `-2s` delay. It is the only thing on the page that draws the eye downward at rest, and
> at this position that is exactly what it should do.

---

## 10. Responsive

Three breakpoints, and each one is a decision rather than a reflow.

| Width | Hero | Strip | Board | Coins | Clips | Wins | About | CTA |
|---|---|---|---|---|---|---|---|---|
| **≥1024** | Centred, player 1080px, headline overlap 40px | `1.4fr 1fr` | Podium 3 unequal + rows | Sequence, line left | Rail, 320px cards | 3 col asymmetric | Interlocked | `1.6fr 1fr` |
| **768–1023** | Same, player 100%, overlap 32px | `1.4fr 1fr` | Podium 3 equal heights + rows | Sequence | Rail | 2 col, featured full width | Stacked | Stacked |
| **<768** | Stacked, overlap 24px, `min-height: auto` | Pool on top, 3 rows below | **3 podium rows**, no cards | Sequence, line at 32px | Rail, 280px cards | 1 col | Stacked | Stacked, button full width |

**Phone specifics, and these are the ones that get missed.**

- **No light drift.** The light layer renders static under 720px. The tab bar carries the
  live tell instead (`Late Night §8`).
- **No `background-attachment: fixed`.** Every `.lit` surface drops the falloff gradient
  for a static 1px top hairline in a horizontal blue gradient. It has a real scroll
  cost on mobile and the falloff was never visible at that size anyway.
- **The bloom shrinks to 90px** past the player's edges, or it eats the whole viewport.
- **Every control is at least 44px tall** under `(pointer: coarse)`, added with
  `min-height` and `display: inline-flex` **with its alignment re declared**. A bare
  `inline-flex` left aligns button labels and shrinks full width rows to their text.
- **The hold works on touch.** `touch-action: none` on the coin so holding it does not
  scroll the page, and `pointercancel` treated as a release.
- **The rail's mask stays.** It is more important on a phone, not less, because the cut
  edge is closer to the thumb.
- **Body padding reserves the tab bar's height** so §9's button is never under it.

**Landscape phone** (`(orientation: landscape) and (pointer: coarse) and (max-height:
560px)`): the hero drops to `min-height: auto` and the headline drops one step to
`display-l`. A phone held sideways passes every width check and has no vertical room.

---

## 11. The copy block

Every viewer facing line on this page, in one place. **All of it ships verbatim.** Build
passes wire these in and never paraphrase them.

**§1 Hero, live**

```
eyebrow    LIVE ON KICK
           2,431 WATCHING              (only when the count exists)
h1         You're in the room.
sub        Talk in chat and you earn Matty Coins every three minutes. Stay all
           week and you're on the board.
buttons    Watch live · See the board
bar/out    Sign in to start earning. It takes about a minute.
bar/kick   Link your Kick account to start earning.
bar/earn   You're earning 2 MC every 3 minutes. Sub multiplier applied.
bar/froze  Earning is paused on your account.
```

**§2 Hero, offline**

```
eyebrow    OFFLINE
h1         The room opens Thursday, 8PM.
sub        Coins pause when the stream does. The board, the shop and the
           giveaways keep running.
buttons    Watch last stream · Wall of fame
schedule   All times UK. Extra streams get announced in Discord.
```

**§3 Strip**

```
labels     WEEKLY PRIZE POOL · BOARD RESETS IN · EARNING RIGHT NOW ·
           PAID OUT TO DATE
```

**§4 Board**

```
eyebrow    WAGERED ON RAZED UNDER CODE MATTY
title      This week's board
chips      Weekly · Monthly
footer     Updated 4 minutes ago · all times UTC
link       View the full board
empty      No board to show yet.
           Positions come straight from Razed for accounts registered under the
           code MATTY. Nothing appears here until that feed returns players.
```

**§5 Coins**

```
hold       HOLD THE COIN. SEE WHAT AN HOUR IS WORTH.
done       That's 30 MC for an hour. Seven days of that and you're on the board.
done/out   Sign in and start

01  1 MC · every 3 minutes
    Say anything in chat and you start earning. One message keeps you earning
    for the next fifteen minutes, and the bot drops a claim word every twenty
    so quiet people never have to spam.

02  +10 MC · for a full hour
    Twenty ticks in a row with no gap pays a bonus on top. Miss one and the run
    resets. It pays for being here, not for leaving a tab open.

03  2× · everything, for subs
    Any sub tier doubles every coin you earn. VIPs earn 2.5×. Multipliers never
    stack, so the highest single one applies and a VIP who also subs earns
    2.5×, not 5×.

close      Coins cannot be bought. There are no packages, no top ups and no
           payment path. They are earned by turning up and nothing else. They
           have no cash value and cannot be transferred.
```

**§6 Clips**

```
title      Clips
chips      All · Kick · YouTube · Instagram · X
```

**§7 Wins**

```
eyebrow    REAL BETS, REAL PAYOUTS, ON STREAM
title      Biggest wins
chips      By multiplier · By win · All time
button     See the wall of fame
```

**§8 About**

```
label      About
title      About Matty
panel 1    Stream schedule
           All times UK. Extra streams get announced in Discord.
panel 2    Where to find him
           Check an account is really his
```

**§9 CTA**

```
title      Play on Razed under code MATTY
body       Sign up under the code and every dollar you wager counts towards the
           weekly board automatically. There is nothing to link and nothing to
           claim until the period closes.
button     Claim the bonus
```

### The copy gate

Before this page is shown to anyone:

1. **Grep `page.tsx` and every component it touches for em dashes.** Zero. The `—` that
   `Num` renders for an unknown figure is the one permitted use and it lives in one
   component. **`aboutCopy` in `lib/mock.ts` currently contains them and must be
   rewritten.**
2. **Grep for:** leverage, seamless, empower, unlock, robust, actionable, data driven,
   solutions. Rewrite every hit and re grep until zero.
3. **Sweep for the quieter tells:** "it's not just X, it's Y", false ranges, vague
   attributions, generic big finish conclusions, and testament, landscape, delve, elevate.

**Carve out.** The deliberate devices above are craft and they stay: the repeated word
"room", the staccato of "no packages, no top ups and no payment path", and the plain
refusal in the closing coin line. A tell is what drifted in uninvited. A device is what
this document chose on purpose.

---

## 12. States to build

| State | Section | Behaviour |
|---|---|---|
| Live | §1 | Full composition, light at full, drift on, nav hairline lit |
| Offline | §2 | Different composition, light at 1/7, no drift, countdown is the only lit object |
| **Goes live while the page is open** | Whole page | Light transitions cold to blue over 1200ms, nav lights, docked bar gains its rate line, hero swaps composition. **The best moment this site can produce. It never snaps** |
| Ends while the page is open | Whole page | The reverse, same duration |
| `stream.viewers === null` | §1 eyebrow | **The whole element goes.** Never `—`, never `0` |
| `stream.startedAt === null` | §1 | The uptime element goes; the title still renders |
| Signed out | §1/§2 bar, §5.1 | Bar links to sign in. The hold uses a 1× rate and gains its sign in link |
| No Kick linked | §1/§2 bar | Gold hairline, one instruction, links to `/me` |
| Frozen | §1/§2 bar | Danger hairline, links to `/me` |
| Multiplier is 1× | §1 bar | Sentence ends after "3 minutes". No suffix |
| No weekly period | §3, §4 | Strip figures `—`. Board renders its empty state |
| No database | §3 | `EARNING RIGHT NOW` and `PAID OUT TO DATE` render `—`. **Never `0`** |
| Feed returned nobody | §4 | Empty state, plain words |
| **Feed unreachable** | §4 | Distinct danger state, last sync time, retry. **Never an empty board** |
| Fewer than 3 board rows | §4 | Podium renders only the ranks that exist. Never placeholder cards |
| `clips.length === 0` | §6 | **Section absent entirely** |
| `bigWins.length === 0` | §7 | **Section absent entirely** |
| Only 1 big win | §7 | Featured spans all three columns. Never one card and two holes |
| Portrait fails to load | §8 | Layout holds at the reserved aspect ratio, bloom remains, alt text shows |
| Kick embed fails | §1 | Poster remains, docked bar unaffected, page stays complete |
| Reduced motion at load | Whole page | No drift, no entrances, no counts, hold pre completed, all final states |
| **Reduced motion flipped mid session** | Whole page | Both directions. On: line pins drawn, counters jump, hold completes, drives stop. Off: pins removed, drives re armed |
| Hidden tab | Whole page | Every animation paused via `body.paused` |

---

## 13. The entrance choreography

One timeline for the whole page, so nothing collides.

**Above the fold, load driven:**

```
0ms      player, bloom and light already painted
120ms    eyebrow
200ms    headline words rise, 60ms apart, reading order
700ms    sub
900ms    buttons, 120ms apart
1040ms   docked bar
```

**Below the fold, scroll driven**, each section firing once at
`threshold: .15, rootMargin: "0px 0px -12% 0px"`:

```
§3   pool counts 900ms  ·  rows fade 70ms steps
§4   podium rises in rank order, 90ms apart  ·  rows 50ms  ·  footer last
§5   line draws on scroll progress  ·  rules fade 80ms steps
§6   header fades  ·  cards 60ms steps, first four only
§7   featured multiplier counts 1100ms  ·  compacts 90ms after it lands
§8   portrait fades  ·  text 80ms steps  ·  panels 100ms apart
§9   panel fades  ·  title, body, button 90ms apart
```

**Two rules that silently half work if you get them wrong** (`Late Night §4`):

1. Start and end states are prefixed with the container class (`.rv [data-r]`,
   `.rv.in [data-r]`) or a later rule cancels them without any error.
2. **Retire the stagger.** The `.rv.in.done [data-r]` rule that zeroes `transition-delay`
   must match or beat the specificity of the `nth-child` delays it retires, since
   `:nth-child` counts as a class. If it does not, every hover on the second and third
   card lags by the stagger **forever**. Prove it by hovering them after the entrance
   ends.

---

## 14. The self test

Run all of it before showing anyone.

1. Screenshots at **1440×900, 1280×800, 375×812, 375×667**, in both live and offline.
2. **Force both hero states by hand** and trigger the transition between them. It is the
   best moment on the site and it is also the one nobody tests.
3. Every button and link exercised, including the external ones.
4. **Every entrance proved to actually play.** Cascade order kills them silently.
5. **Stagger retirement proved** by hovering the second and third clip card after the
   entrance finishes.
6. **The hold, six ways:** pointer, touch, Space, Enter, dragged off mid hold
   (`pointerleave`), and reduced motion flipped on mid hold.
7. Reduced motion on at load, then **flipped on and off while the page is open.**
8. The page forced sideways: the full bleed sections, the rail, and 320px width.
9. Console clean at desktop and phone.
10. Letter tails (g, y, p) at 100% zoom in the headline, the section titles and the
    clipped clip titles.
11. **Worst frame legibility on the headline overlap.** The Kick thumbnail is a slot
    screenshot. Measure the worst pixel under the text with the scrim on: **3.5:1 or
    better**, computed, not eyeballed.
12. **Greyscale pass.** Is it still obvious what is money, what is clickable and whether
    the stream is on?
13. **Every empty and null state forced**, including no database, unreachable feed, zero
    clips, zero wins, one win, and `viewers === null`.
14. **The fresh eyes pass, last.** Look at it as a first time visitor with zero context.
    Does anything float unexplained? Is any parallel element unequal, a rule without its
    figure, a card styled differently from its siblings? Does it read as made for this one
    site, or does any stretch read as filler?

---

## 15. Build order

```
§1 light + hero, live      the composition everything else is lit by
§2 hero, offline           the state most visitors see
§3 strip                   cheap, and it proves the falloff works
§4 board                   the podium is the signature's second use
§6 clip rail               full bleed, proves the container break
§7 wins band               full bleed, proves the light mask
§8 about                   the interlock
§9 CTA                     the payoff
§5 coin rules              the sequence and the drawn line
§5.1 the hold              last
```

**The hero comes first and deserves the most time on the whole page.** If the room does
not feel like a room there, no later section rescues it.

**§3 comes third on purpose.** It is the cheapest section on the page and it is the first
place the light's falloff is visible on an ordinary surface. If the strip's two panels do
not read as being lit from different distances, §3 of `Late Night` is wrong and it is
much better to find that out on a stat panel than on a podium.

**§5 comes second to last and §5.1 comes last.** The coin sequence is the highest effort
layout and the hold is the highest effort component. The page is fully shippable without
either, and **neither is allowed to block getting a real homepage in front of real eyes.**
If the hold slips a week, ship the page with a static coin and the three rules already lit.
