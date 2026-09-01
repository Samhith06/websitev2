# MattySpins — Complete UI Specification

**Late Night.** The visual system, screen by screen.

Companion to `MattySpins-UI-Requirements.md`, which stays authoritative for what is on
each page, where every figure comes from, and every state that must exist. That document
says content, structure, behaviour. This one says how it looks and how it moves, and it
never contradicts it.

`MattySpins-UI-Spec.md` is the old visual system and is **retired** by this document.
`MattySpins-Design-Package.md` is the one page summary of this document and stays as the
short version.

Built to the standards in `10k-websites-skill/`. That skill builds a static one page
site with no framework, which this app is not, so its architecture rules are dropped and
its design bar, motion standard, text choreography, copy laws, quality floor and self
test checklist are kept. Deliberate deviation, stated out loud.

**Nothing in this document touches** `app/api/`, `lib/` (except one new hook), `db/`,
`auth.ts`, `middleware.ts`, `scripts/`, any `actions.ts`, any data shape or any route
path. This is a UI layer replacement.

---

**The organising principle:** every other site in this category has a live badge. This
one has **a lit room**. Whether Matty is streaming is not a green dot in the corner, it
is the lighting of the entire page, felt before it is read. Every element on the site is
either lit by that source or waiting for it to come back on.

```
        OFFLINE                              LIVE
        ───────                              ────
        the room is dark                     the room is lit
        one gold countdown glowing           blue light drifting on a 90s cycle
        coins paused                         coins ticking, earning bar attached to you
        board, shop, giveaways still run     board, shop, giveaways still run

   ARRIVE ─→ IS HE ON? ─→ AM I EARNING? ─→ WHERE AM I? ─→ WHAT'S IT WORTH?
              the light      the coin bar      the board       the shop
              §3             §7                §14, §20        §23
```

**What makes this different from a product dashboard.** A dashboard's job is to be
readable and get out of the way. This site's job is to make a viewer feel like they are
already in the room before they have signed in. The current build is the former and the
brief is the latter, and that gap is the whole project.

---

## The three highest-value UI decisions

**1. The light is the live state.** One fixed radial source behind the entire page,
wired to `stream.live`. It is the signature element and the whole boldness budget is
spent on it. Build it first. If it is not right, nothing downstream is worth building,
because every surface on the site is lit by it. §3.

**2. Two colours, and never on one element.** Blue is the light: live, action, the
one call to action. Gold is money: pools, payouts, multipliers, coin figures. Gold never
appears on anything clickable, so gold on this site always means a number and never
means a button. That single rule removes almost every colour decision downstream. §1.

**3. The earning bar belongs on every page, not just home.** The one question a returning
viewer has is "am I earning right now". Right now that answer lives in the homepage hero
and nowhere else, so a viewer on the shop page has to navigate home to find out. It
becomes a persistent element attached to the global chrome. §7.

A fourth, which is not a component but is enforced on every page: **no two adjacent
sections share a layout skeleton.** The current homepage runs eyebrow, title, chip row
right, grid, four times in a row. A visitor should never feel the same template stamped
twice.

---

## A note on colour, and on greyscale

The palette is two chromatic colours on a blue-black ground. Blue and gold are far
apart in hue and reasonably far apart in luminance, so this is not the red and green
problem, but **colour is still never the only signal.**

- **Money always carries a unit.** `€2,400`, `12,480 MC`, `2,431×`. Set in JetBrains
  Mono with tabular figures, always. A gold figure with no unit is a bug.
- **Action always carries a shape.** Buttons are filled or outlined boxes. Links carry a
  trailing arrow. No text is blue unless it is interactive or it is the word LIVE.
- **Live carries the word.** The light says it first, the word `LIVE ON KICK` says it
  second, and the pulse says it third. Three signals, one of which survives greyscale,
  one of which survives a monochrome monitor, and one of which survives a screen reader.
- **Rank carries a numeral.** Podium metals are decoration on top of a rank number that
  is always printed.

**Test every page in greyscale before shipping it.** If you cannot tell what is money,
what is clickable and whether the stream is on, it is not done.

---

## Screen inventory

**Foundations**

1. Tokens
2. Type
3. The light layer
4. The motion system
5. Primitives

**Global chrome**

6. Top navigation
7. The coin bar
8. Mobile tab bar
9. Footer
10. Age gate

**Home**

11. Hero, live
12. Hero, offline
13. The stat strip
14. Board preview
15. Coin rules, and the interactive moment
16. The clip rail
17. The wins band
18. About Matty
19. The one call to action

**Pages**

20. Leaderboard
21. Claim a prize
22. Wall of fame
23. Clips
24. Shop
25. Giveaways
26. Profile
27. Games lobby
28. Game screen, shared
29. Verify a round
30. Casinos, Official, Legal

**Components**

31. Surface and card
32. Rank row and podium
33. Countdown
34. Empty and loading states
35. The number

**Admin** *(wave three, reduced system)*

36. Admin shell and tables

---

## 1. Tokens

> Replace the `@theme` block in `app/globals.css` entirely. Tailwind v4, so these become
> utility classes automatically.

```css
@theme {
  /* The room. Violet tinted dark, never #000, because a pure black canvas
     cannot be lit and the whole system depends on light falling across it. */
  --color-canvas:      #070B14;
  --color-panel:       #0D1422;
  --color-panel-2:     #171C25;
  --color-line:        #1B2740;   /* decorative hairlines only */
  --color-line-lit:    #2B3A56;   /* every interactive border, passes 3:1 */

  /* Ink, warmed toward the light, never #fff */
  --color-ink:         #F2EEFF;
  --color-ink-2:       #B9B2D6;
  --color-muted:       #8A83A8;
  --color-faint:       #667089;

  /* The light. Live, action, the one CTA, focus. Nothing else. */
  --color-light:       #2B8FFF;
  --color-light-hot:   #4DA3FF;
  --color-light-ink:   #04121F;
  --color-light-bg:    #0C1B33;
  --color-light-line:  #1E3A63;

  /* Money. Never on anything clickable. */
  --color-gold:        #FFB93B;
  --color-gold-bg:     #241A05;
  --color-gold-line:   #4A3A12;

  --color-silver:      #C0C6DA;
  --color-bronze:      #CB8C00;

  /* Failure, kept quiet. It is never the point of a screen. */
  --color-danger:      #FFB4AB;
  --color-danger-bg:   #2A0F0C;
  --color-danger-line: #5A211A;

  /* Another brand's mark, borrowed honestly */
  --color-discord:     #5865F2;

  --radius-card:  14px;
  --radius-ctrl:  10px;
  --radius-pill:  999px;

  --ease-out:  cubic-bezier(.16, 1, .3, 1);
  --ease-soft: cubic-bezier(.4, 0, .2, 1);
  --dur-fast:  180ms;
  --dur:       320ms;
  --dur-slow:  620ms;
}
```

**What leaves, and why it matters.** `--color-brand` blue is deleted from the codebase,
not deprecated. `--color-online` green is deleted: live is the light now, and keeping a
green dot alongside it would give the page two competing answers to its most important
question. Every `text-brand`, `border-brand`, `bg-brand` and `text-online` in
`components/` is a compile error after this change, which is the intended way to find
them all.

**Radii.** The current 3px is the single loudest tell that a machine chose the design.
Cards go to 14px, controls to 10px. Lit surfaces need edges the light can travel around,
and a 3px corner has none.

---

## 2. Type

> Replace the three Google font imports in `app/layout.tsx`.

| Role | Face | Weights | Why |
|---|---|---|---|
| Display | **Unbounded** | 700, 800 | Wide, geometric, nocturnal, and nobody's default. |
| Body | **Manrope** | 400, 500, 600, 700 | Quiet, warm, gets out of the way. Not Inter, not Roboto. |
| Numbers and labels | **JetBrains Mono** | 400, 500, 700 | Stays. Requirements rule 1 is correct and survives. |

Anton and Barlow are retired.

**The scale.** Display is used at real size or not at all. Nothing between 24px and the
hero gets Unbounded, because a wide display face at 18px reads as a mistake.

```
display-xl   clamp(44px, 7vw, 96px)   Unbounded 800  lh .92  tracking -.03em
display-l    clamp(34px, 4.5vw, 60px) Unbounded 800  lh .96  tracking -.025em
display-m    clamp(26px, 3vw, 40px)   Unbounded 700  lh 1.02 tracking -.02em
display-s    24px                     Unbounded 700  lh 1.15

body-l       18px / 1.6               Manrope 400
body         16px / 1.6               Manrope 400
body-s       14px / 1.55              Manrope 400

label        11px  mono 500  uppercase  tracking .16em
num-s        13px  mono 500  tabular
num-m        26px  mono 700  tabular
num-l        40px  mono 700  tabular
num-xl       clamp(72px, 12vw, 180px)  mono 700  tabular  lh .85
```

Body goes from 15px to 16px. 15px is an admin panel, 16px is a website.

**Sizing rule that has bitten real builds:** cap text blocks in `ch` on the text element
itself, never on a container. A `ch` resolves against the font the element inherits, so a
container capped at `52ch` in body font will break a display headline inside it to three
lines. Containers get `px` or `min()`.

---

## 3. The light layer

The signature element. Build this before anything else on the page.

> Build `components/system/LightLayer.tsx`, a client component rendered once in
> `app/(site)/layout.tsx`, directly inside `<body>` and before `<main>`. It takes one
> prop, `live: boolean`, from the same `currentStream()` call the hero already makes.
>
> **Structure.** A `position: fixed; inset: 0; pointer-events: none; z-index: 0` element
> with `aria-hidden="true"`. All page content sits at `z-index: 1` on the same stacking
> context. It never scrolls, so the page moves through the light rather than the light
> moving with the page. That is the entire reason the site reads as one room instead of
> stacked sections.
>
> **Two gradients, one element each.**
> - *Key.* A radial gradient centred at `50% 18%`, sized `min(1400px, 120vw)`, sitting
>   behind where the hero player lands. This is the monitor.
> - *Fill.* A second, weaker radial at `88% 72%`, sized `min(900px, 80vw)`, giving the
>   lower page somewhere for the light to fall off to. Without it the bottom half of the
>   page goes flat and the whole effect reads as a hero glow.
>
> **Live.**
> - Key: `rgba(43, 143, 255, .22)` at centre, fully transparent by 70%.
> - Fill: `rgba(43, 143, 255, .08)`.
> - The key drifts: `transform: translate3d()` within ±3% on both axes, 90 seconds,
>   `ease-in-out`, `alternate`, `infinite`, with a `-24s` negative delay so it is mid
>   cycle at first paint. Transform only, never `background-position`.
>
> **Offline.**
> - Key: `rgba(120, 150, 200, .07)`. Cool, blue, and dim. The room without a screen on.
> - Fill: `rgba(120, 150, 200, .04)`.
> - **No drift.** Stillness is the offline state's whole character.
> - The countdown component gets its own local gold bloom instead (§33), which makes it
>   the only lit object on the page.
>
> **The transition between them is 1200ms on `--ease-soft`.** If a viewer is on the page
> when Matty goes live, the room lighting up around them is the best moment this site
> can produce. Do not let it snap.
>
> **Grain.** A third fixed layer over both: an inline SVG `feTurbulence` data URI at 3%
> opacity, `background-repeat: repeat`, static, no animation. It exists so the flat dark
> does not band on a cheap monitor, which it will.
>
> **Reduced motion.** The drift stops and the layer renders at its final state. It never
> disappears. It is the design, not decoration.

**How surfaces catch it.** Cards are never flat fills. Each carries a top edge highlight
whose brightness depends on where the card actually sits relative to the source:

```css
.lit {
  background-color: var(--color-panel);
  background-image: radial-gradient(120% 90% at 50% -20%,
                    rgb(43 143 255 / .07), transparent 60%);
  background-attachment: fixed;   /* anchors to the viewport, not the card */
}
```

`background-attachment: fixed` is the whole trick. It anchors the gradient's coordinate
space to the viewport, so a card near the top of the screen is lit and one near the
bottom is barely touched, for free, with no JavaScript. It has a real scroll cost on
mobile, so it is disabled under 720px where the cards get a plain top hairline instead.

---

## 4. The motion system

> Build the motion system as three shared pieces, then use nothing else. Every animation
> on the site goes through one of them.
>
> **`components/system/Reveal.tsx`** (client). Wraps an IntersectionObserver at
> `threshold: .15`, `rootMargin: "0px 0px -12% 0px"`, fires once, adds `.in` to its
> child. Children marked `data-r` receive a `transition-delay` from an `nth-child` rule,
> 70ms steps, capped at eight.
>
> Two rules that have to be right or the whole system silently half works:
> - Start and end states are prefixed with the container class (`.rv [data-r]`,
>   `.rv.in [data-r]`) so a later rule cannot cancel them.
> - **Retire the stagger.** After the entrance finishes, a `.rv.in.done [data-r]` rule
>   zeroes `transition-delay`. That rule must match or beat the specificity of the
>   `nth-child` delays it retires, or every hover on the later cards lags by the stagger
>   forever. Prove it by hovering the second and third card after the entrance ends.
>
> **`components/system/SplitText.tsx`** (client). Splits a headline into `.w` word spans
> containing `.c` character spans, once, at mount, using a seeded generator so the
> "random" offsets are identical on every load:
>
> ```js
> function rng(seed){ let s = seed >>> 0;
>   return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296 }
> ```
>
> Wrap a visually hidden span holding the full sentence for screen readers, and mark the
> visual copy `aria-hidden="true"`. Each span gets `--th` (threshold), `--jx`, `--jy`,
> `--jr` from the generator at split time. Entrances read those and animate `transform`
> and `opacity` only.
>
> **`lib/useReducedMotion.ts`.** Returns the current value and updates **live, in both
> directions**, on the media query's `change` event. On a flip in, drawn lines pin to
> finished, counters jump to target, the hold in §15 completes, drives stop. On a flip
> back out, the pins are removed and the drives re arm. Re arming the hero while leaving
> the rest of the page pinned is the half fix that looks done and is not.

**The rules, everywhere, no exceptions.**

- **Nothing snaps.** Every appearance, hover and state change uses `--ease-out` or
  `--ease-soft`. Even the page eases in.
- **Transform and opacity only.** For a glow pulse, put the shadow on a pseudo element at
  full strength and animate its opacity.
- **One living element per section**, at whisper level, four seconds or slower, with a
  negative delay so it is mid cycle at first paint.
- **Pause what is off screen** with an observed class, and pause everything on a hidden
  tab. `animation-play-state` is not inherited, so the only pattern that cannot miss is
  `body.paused *, body.paused *::before, body.paused *::after { animation-play-state:
  paused !important }`, toggled on `visibilitychange`.
- **Never put a dynamic inline style on an element that also has a `forwards`
  animation.** The animation's final value wins permanently. Entrance on the parent,
  dynamic style on the child.
- **`overflow-x: clip` on both `html` and `body`**, with `hidden` declared first as a
  fallback. `hidden` alone still lets one anchor link leave the page shifted sideways.
- **Masked text needs descender room.** Any `overflow: hidden` reveal gets em based
  padding, or g, y and p lose their tails.

---

## 5. Primitives

> Rewrite the four files in `components/ui/`. Same exports, same call signatures
> wherever possible, so page files change layout and not wiring.
>
> **`typography.tsx`** — `Display` (sizes xl / l / m / s), `SectionHeading` (eyebrow,
> title, optional right slot), `Label`, `Num` (tones ink / gold / light / muted; always
> mono, always tabular).
>
> `Num` gains one required behaviour: it renders `—` for `null`, never `0`. That is
> Requirements rule 3 and it moves from a helper the page has to remember into the
> component itself, where it cannot be forgotten.
>
> **`surfaces.tsx`** — `Card` (tones default / light / gold / danger, all `.lit`),
> `Stat`, `EmptyState`, and `Hairlines` retired. Hairlines is the grid that produced the
> four identical boxes; the layouts that replace it are specified per section.
>
> **`controls.tsx`** — `Button` and `ButtonLink` (variants primary / outline / ghost,
> sizes sm / md / lg), `Chip`, `ChipRow`.
>
> Primary is a filled blue box with `--color-light-ink` text. Outline is a
> `--color-light-line` border that fills to `--color-light-bg` on hover. Ghost is text
> with a trailing arrow that slides 3px on hover. Under `(pointer: coarse)` every control
> gets `min-height: 44px` with `display: inline-flex` and its alignment re declared,
> because a bare `inline-flex` left aligns the label and shrinks full width rows.
>
> **`marks.tsx`** — `CoinMark`, `PlatformMark`, `RazedWordmark`, `RazedZ`. Unchanged in
> API, restyled to the palette. The coin mark becomes the favicon as inline SVG.

---

## 6. Top navigation

> Build the top nav. Sticky, 64px, `backdrop-filter: blur(16px)` over
> `rgb(10 8 23 / .72)`, with a bottom hairline that is `--color-line` at rest.
>
> **The nav reads the room.** When Matty is live, the bottom hairline becomes a 1px
> blue gradient, brightest under the logo and falling off to both edges, and the
> wordmark carries a soft blue glow. When he is offline both go quiet. It is the
> smallest possible restatement of the signature and it means the answer to "is he on"
> is visible from any page, at any scroll position, without a badge.
>
> **Left:** the coin mark at 28px, then `MATTYSPINS` in Unbounded 700 at 18px with
> `-.02em` tracking.
>
> **Centre:** the links, 14px Manrope 500 in `--color-ink-2`. Per Requirements §2 the
> primary set is **Giveaways · Leaderboard · Shop · Community · Games**, in that order.
> The active link is `--color-ink` with a 2px blue underline that slides between items
> over 260ms on `--ease-out`.
>
> **The live badge, as a literal element.** Requirements asks for one and the lit hairline
> does not replace it: a pill beside the links reading `Live now` in blue with a
> pulsing dot, or `Offline` in `--color-muted` with a still dot. The hairline is the felt
> signal and the badge is the read one, and a screen reader gets only the badge. It
> reflects real stream state and is **never hardcoded**.
>
> **Self-exclusion removes the Games link entirely.** Not disabled, not greyed. Absent.
> That is the rule in Requirements §2 and it is the one nav rule that must never be
> softened for layout reasons. See `Games §6`.
>
> **Right:** the coin bar (§7), then either `Sign in with Discord` as an outline button,
> or the avatar with a dropdown holding Profile, Admin (admins only) and Sign out. **Admin
> is never rendered for non-admins**, not even disabled.
>
> **On scroll past 120px** the bar tightens to 56px and the blur strengthens. One
> transition, 240ms, and it never happens twice.

---

## 7. The coin bar

**Superseded by `MattySpins-Profile-UI-Spec.md` §10.** The summary below stands; that
document is the build input.

The single most valuable element on the site and currently the most buried. It answers
the returning viewer's only question.

> Build the coin bar as a persistent element in the top nav, present on every page.
>
> **Four states, and they are genuinely different, not one component with a flag.**
>
> 1. **Signed out.** An outline button reading `Sign in to earn`. Nothing else, no coin
>    figure, no placeholder zero.
> 2. **Signed in, no Kick linked.** A gold bordered pill, coin mark at 15px, then
>    `Link Kick to earn`, linking to `/me`. Gold because it is about money the viewer is
>    not yet making, not because it is a warning.
> 3. **Earning.** Coin mark, the balance in `num-s` gold with the `MC` unit, then a
>    blue pulse dot and `2 MC / 3min` in `--color-muted` at 12px. The dot pulses on a
>    3 second cycle, and it is the only pulsing thing in the chrome.
> 4. **Frozen.** Same shape, danger bordered, reading `Earning paused`, linking to `/me`.
>
> **The balance counts, it does not snap.** When a tick lands, the figure counts up over
> 700ms and the coin mark takes one 360° rotation on the Y axis. That rotation is the
> only place on the site where a mark animates, which is what makes it read as an event.
>
> **When the stream is offline**, state 3 is replaced by the balance with no rate line
> and no pulse, and a muted `Paused` label. Never hide the balance. A viewer's coins are
> theirs whether or not the room is open.
>
> **Under 768px** the bar collapses to the coin mark and the balance only, and the rate
> line moves to the mobile tab bar.

---

## 8. Mobile tab bar

> Build the mobile tab bar. Fixed bottom, four items, shown under 768px only, over the
> same blurred canvas as the nav with a top hairline.
>
> **Four items: Home · Board · Shop · Me**, per Requirements §2, roughly 62px tall. Icons
> at 20px from lucide, label at 10px mono uppercase beneath. The active item is
> `--color-ink` with the icon in blue and a 2px blue bar across the top of the cell.
>
> **Games is deliberately not here.** Requirements sets the tab bar at four items, and the
> omission has a second benefit: self-exclusion removes the Games link from the nav, and a
> tab bar that never carried it cannot break that rule by accident.
>
> **The live tell, again.** When Matty is live, a thin blue line runs the full width
> of the bar's top edge with a slow left to right shimmer on a 4 second cycle. Phones get
> the static hero and no light drift, so this is where the room's state lives on a phone.
>
> Every cell is at least 48px tall. The bar reserves its own height with a body padding
> rule so it never covers the last element of a page.

---

## 9. Footer

> Build the footer. It is the only place on the site with no light on it: the gradient is
> removed and the background is flat `--color-canvas` with a top hairline. Leaving the
> lit environment is how the page ends.
>
> Four columns on desktop, stacked on mobile: the mark and one line of what this is, the
> site links, the legal links, and the socials as `PlatformMark` rows.
>
> Beneath, a full width band at 12px in `--color-faint`: the 18+ line, the responsible
> gambling line linking to `/responsible`, and the affiliate disclosure. This band is
> never styled to be ignored. It is set at proper contrast, 4.5:1, because a legal line
> nobody can read is not a legal line.
>
> No fictional brand disclosure. MattySpins is real.

---

## 10. Age gate

> Build the age gate as a full frame takeover on first visit, before anything else
> paints.
>
> **The room, with the light off.** Flat `--color-canvas`, the coin mark at 64px centred,
> and nothing else lit.
>
> `ARE YOU 18 OR OVER?` in `display-m`. Beneath at 16px: "This site is for people over
> 18. Gambling carries risk. Never stake more than you can afford to lose."
>
> Two buttons: `I'm 18 or over` as primary, and `Leave` as ghost, which navigates away
> rather than doing nothing.
>
> **On accept, the light comes up.** The gate fades over 400ms and the light layer
> transitions from zero to its current state over 900ms. The first thing a new visitor
> ever sees on this site is the room being lit for them. It costs one animation and it
> sets the whole register.
>
> Under reduced motion the gate cuts and the light appears at its final value.

---

## 11. Hero, live

Not a two column split. That layout, text left and player right, is the most common
arrangement on the internet for a streamer page and it puts the single most important
object on the site in the weaker half of the screen.

> Build the live hero. The player is the centre of the composition, because it is the
> light source and the reason the visitor came.
>
> **Layout.** A centred column, `max-width: 1080px`. The player sits in the middle at
> 16:9, recessed into the page: `--color-line-lit` 1px border, `--radius-card`, and an
> outer blue bloom on a pseudo element behind it that is the visual origin of the
> light layer's key gradient. The two must agree, or the room has two suns.
>
> **The headline overlaps the player's top edge** by roughly 40px, sitting on the bloom,
> with a scrim beneath it so the worst pixel under the text still passes 3.5:1. This
> overlap is the composition. It is what stops the section reading as a stacked hero and
> a video below it.
>
> **The earning bar docks to the player's bottom edge**, full width of the player, no
> gap, sharing its bottom corners. It reads as attached hardware, not as a card that
> happens to sit below.
>
> **Copy, verbatim.**
> - Eyebrow, `label` size, blue, with a pulsing dot: `LIVE ON KICK`. Then, **only when
>   Kick actually returns a number**, a hairline separator and `2,431 WATCHING`. When
>   there is no count the whole element goes rather than showing a number nobody
>   measured.
> - H1, `display-xl`: **You're in the room.**
> - Sub, `body-l`, `--color-ink-2`, capped at `46ch` on the paragraph itself: Talk in
>   chat and you earn Matty Coins every three minutes. Stay all week and you're on the
>   board.
> - Buttons: `Watch live` primary, with the Kick mark, opening in a new tab. `See the
>   board` outline.
> - Beneath the player, a single line at 13px mono: the stream title left, `UPTIME
>   3:42:11` right, both in `--color-muted`, aligned on the baseline.
>
> **The docked bar, four states**, matching §7's states exactly so a viewer never sees
> two different answers on one page:
> - Signed out: **Sign in to start earning.** It takes about a minute. Whole bar is a
>   link, arrow on the right, blue hairline on hover.
> - No Kick: **Link your Kick account to start earning.** Gold bordered.
> - Earning: **You're earning 2 MC every 3 minutes.** Sub multiplier applied. The rate
>   figure is gold and mono, and it counts on each tick.
> - Frozen: **Earning is paused on your account.** Danger bordered, links to `/me`.
>
> **The entrance.** Three arrivals, one beat, driven by a load ramp rather than scroll,
> and each word split by `SplitText`:
> 1. `0 → 700ms` the headline's words rise 24px into place in reading order, 60ms apart.
> 2. `500 → 900ms` the sub fades.
> 3. `800 → 1200ms` the buttons, then the docked bar, 120ms apart.
>
> The player itself does not animate in. It is already there, lit, before the words
> arrive. The room existed before the visitor did.

---

## 12. Hero, offline

The site is offline more hours than it is live, so this is the state most visitors
actually see, and it has a different job: say when he is back, and give them something to
do until then.

> Build the offline hero as a genuinely different composition, not the live hero with
> pieces hidden.
>
> **The countdown is the hero.** It sits where the headline sat, centred, at `num-xl`,
> gold, mono, tabular, with its own local gold bloom on a pseudo element behind it. With
> the room light dropped to a seventh of its live strength, this is the only lit object
> on the page, and that is the entire design of this state.
>
> **Layout.** Countdown centred and dominant. Beneath it the headline at `display-l`,
> which is the reverse of the usual hierarchy and correct here: the number is the news,
> the sentence is the caption.
>
> **Copy, verbatim.**
> - Eyebrow, `label`, `--color-muted`, no dot, no pulse: `OFFLINE`
> - Countdown boxes, then H1 at `display-l`: **The room opens Thursday, 8PM.**
> - Sub, `body-l`, capped at `46ch`: Coins pause when the stream does. The board, the
>   shop and the giveaways keep running.
> - Buttons: `Watch last stream` primary, `Wall of fame` outline.
>
> **The last stream sits below, smaller.** The VOD thumbnail at roughly 60% of the live
> player's width, off centre, unlit, with a play affordance and its title. It is a
> record, not an event, and it should not be composed like one.
>
> **The docked bar is replaced by the week's schedule**, three or four rows of day, time
> and platform, mono, tabular, with the next slot in gold and the rest in
> `--color-ink-2`. It sits under the countdown, not under the VOD, because it belongs to
> the countdown's story.
>
> **The one living element:** the countdown's seconds digit. Nothing else on an offline
> page moves. Stillness is the state's character and it makes the return to live land.

---

## 13. The stat strip

> Build the stat strip. **Not four equal boxes.** The four figures are not equally
> interesting and rendering them identically says they are.
>
> **Layout, desktop:** a two column split at `1.4fr 1fr`. Left is the weekly prize pool
> alone, `num-l` in gold with its label above in `label` size, on a `.lit` panel with a
> gold hairline. Right is a stack of three compact rows, each label left and figure
> right, aligned on the baseline, separated by hairlines: Board resets in, Earning right
> now, Paid out to date.
>
> **Layout, mobile:** the pool full width on top, the three rows stacked beneath.
>
> **Every figure obeys Requirements rule 3.** A figure we do not have renders as `—` and
> never as `0`. `Num` enforces this (§5). `Earning right now` in particular is null
> without a database and must not read zero, because zero is a claim that nobody is
> watching.
>
> **The living element:** the countdown's seconds. Nothing else in the strip moves.
>
> **Entrance:** the pool figure counts up from 0 to its value over 900ms on `--ease-out`
> when it enters the viewport, once. The three rows fade in at 70ms steps. Under reduced
> motion the figure is at its value immediately.

---

## 14. Board preview

> Build the weekly board preview. A broadcast table, and a different skeleton to the
> strip above and the sequence below.
>
> **Header:** eyebrow with the Razed Z mark, `WAGERED ON RAZED UNDER CODE MATTY`. Title
> `This week's board` at `display-m`. Right slot: the period chips, Weekly active and
> Monthly linking through.
>
> **The podium reuses the signature.** Three cards, unequal, rank one centre and taller.
> Each catches a different amount of light: rank one gets the full `.lit` gradient plus a
> gold hairline, rank two gets a reduced gradient with a `--color-silver` hairline, rank
> three gets almost none with `--color-bronze`. The light literally falls off down the
> podium, which means the ranking reads before a single number does.
>
> **Each podium card:** rank numeral at `num-l` in the metal colour, avatar at 44px,
> username at 16px Manrope 600 truncated at `18ch`, wagered at `num-m` in gold with its
> unit, prize beneath at 13px mono gold.
>
> **Ranks four to six** run below as rows (§32), full width, hairline separated.
>
> **Footer line, and it is not decoration.** `Updated 4 minutes ago · all times UTC` at
> 12px mono in `--color-faint`, left. Right, a ghost link, `View the full board` with a
> trailing arrow. Requirements rule 4 says provenance travels with money, and this line
> is the page's credibility.
>
> **Empty state**, and it must not look like a loading state: **No board to show yet.**
> Positions come straight from Razed for accounts registered under the code MATTY.
> Nothing appears here until that feed returns players.
>
> **Entrance:** the three podium cards rise in rank order, one, two, three, 90ms apart,
> so the winner arrives first.

---

## 15. Coin rules, and the interactive moment

This section carries the premise, so it gets the site's one designed interactive moment.

> Build the coin rules as a **vertical numbered sequence**, not three cards in a row. A
> hand drawn SVG line runs down the left of the sequence connecting each rule to the
> next, drawing itself on scroll via `stroke-dashoffset` and holding when complete.
>
> **Each rule:** a mono index (`01`, `02`, `03`) in `--color-faint` at the line's node,
> the figure at `num-l` in gold with its unit at 15px in `--color-muted` on the baseline
> beside it, and the body at `body` in `--color-ink-2` capped at `58ch` on the paragraph.
>
> Rule three, the sub multiplier, is the only one on a `.lit` panel with a blue
> hairline, because it is the one that costs money and it should look like it.
>
> **Copy, verbatim.**
> - `1 MC` / every 3 minutes / Say anything in chat and you start earning. One message
>   keeps you earning for the next fifteen minutes, and the bot drops a claim word every
>   twenty so quiet people never have to spam.
> - `+10 MC` / for a full hour / Twenty ticks in a row with no gap pays a bonus on top.
>   Miss one and the run resets. It pays for being here, not for leaving a tab open.
> - `2×` / everything, for subs / Any sub tier doubles every coin you earn. VIPs earn
>   2.5×. Multipliers never stack, so the highest single one applies and a VIP who also
>   subs earns 2.5×, not 5×.
> - Closing line beneath, 14px `--color-muted`, capped at `62ch`: Coins cannot be bought.
>   There are no packages, no top ups and no payment path. They are earned by turning up
>   and nothing else. They have no cash value and cannot be transferred.

### 15.1 The interactive moment

> Build the hold to earn coin. It sits at the head of the sequence, above rule one, and
> it is the one designed interaction on the whole site. The visitor does not read that
> being here pays. They perform it.
>
> **Resting state.** The coin mark at 140px, centred, with a 4px `--color-line` ring
> around it. Above it, `label` size: `HOLD THE COIN. SEE WHAT AN HOUR IS WORTH.` Beside
> it, a mono figure at `num-l` reading `0 MC`.
>
> **The element is a `<button>`,** so Space and Enter hold it exactly as a pointer does,
> and it carries `aria-label="Hold to preview an hour of earning"` with an `aria-live`
> polite region on the figure.
>
> **On hold.**
> - Progress climbs 0 to 1 over **2600ms, linearly**, because it represents time passing
>   and easing it would lie about that.
> - The ring fills as an SVG `stroke-dashoffset`, blue.
> - The figure ticks in **twenty discrete steps**, not smoothly. Each step is the
>   viewer's own rate, so a signed out visitor sees `1 MC` steps to `20 MC`, a sub sees
>   `2 MC` steps to `40 MC`, a VIP sees `2.5 MC` steps to `50 MC`. Every step lands with
>   a 2px scale pop on the coin. Twenty distinct events in under three seconds is what
>   makes it feel like accrual rather than a progress bar.
> - The room light brightens by about 15% for the duration and eases back on release. The
>   signature responds to the visitor, once, in one place.
>
> **On release before completion**, progress eases back to 0 over 500ms on `--ease-out`
> and the figure counts down with it. **It never snaps to zero.** Releasing early has to
> feel like losing something, because in the actual game it is.
>
> **On completion:**
> 1. The ring flashes and the `+10 MC` hour bonus lands on the figure as a separate
>    event, 200ms after the twentieth tick, in gold.
> 2. The three rules light up in sequence, 120ms apart, each gaining its hairline and its
>    figure resolving from `--color-muted` to gold.
> 3. A closing line fades in beneath at 15px: **That's 30 MC for an hour. Seven days of
>    that and you're on the board.** The figure in that sentence is the viewer's own
>    number, computed from their multiplier, not the example.
>
> **Signed out**, the closing line gains a trailing ghost link, `Sign in and start` .
>
> **Reduced motion:** no hold required. The whole thing renders in its completed state on
> entry, ring full, figure at target, rules lit, closing line present. Flipping reduced
> motion on mid hold completes it immediately rather than abandoning it.

---

## 16. The clip rail

> Build the clips section as the only full bleed horizontal element on the page. It
> breaks the container to both edges of the viewport.
>
> **Header** in the container as normal: title `Clips` at `display-m`, source chips right.
>
> **The rail** runs edge to edge below, horizontally scrollable, snap points on each
> card, 20px gaps. Cards are 320px wide, 16:9 thumbnails, `.lit` with a blue top edge
> that brightens on hover.
>
> **Both ends fade.** A 120px mask on each edge of the rail so cards dissolve rather than
> being cut, which is what makes it read as continuing past the screen instead of ending
> at it.
>
> **Each card:** thumbnail with a duration pill bottom right in mono, the platform mark
> top left, title at 14px Manrope 600 clamped to two lines, and beneath at 12px mono
> `--color-faint`, the source and the relative time.
>
> **Hover:** the card lifts 4px, the thumbnail scales to 1.04 inside its clipped bounds,
> and the blue edge brightens. 240ms, `--ease-out`. Under `(pointer: coarse)` there is
> no hover state and the tap target is the whole card.
>
> **Keyboard:** the rail is focusable, arrow keys move between cards, and the focused
> card scrolls into view. A horizontal rail that only works with a mouse is broken.
>
> **The living element:** none. This section is busy enough.

---

## 17. The wins band

The darkest point of the page, which is what sets up the CTA being the brightest.

> Build the biggest wins band as a full bleed section where **the light drops away
> almost entirely.** Its background is flat `--color-canvas` with the fixed gradient
> masked off, so scrolling into it feels like walking away from the screen.
>
> **The multipliers are the only lit thing.** The featured win's multiplier renders at
> `num-xl`, gold, mono, tabular, with a gold bloom behind it. At the top of the range
> that is 180px of number, and it should be.
>
> **Layout:** an asymmetric three column grid. The featured win occupies two columns and
> the full height, with its multiplier enormous, the slot name at `display-s`, and the
> stake and payout beneath at `num-s` in `--color-muted`. Two compact wins stack in the
> third column with their multipliers at `num-m`.
>
> **Every win card carries provenance.** The clip thumbnail, the date, and the platform,
> at 12px mono. Requirements rule 4 again: a payout with no evidence behind it is a
> claim, and this whole section is claims unless it is sourced.
>
> **Header:** eyebrow `REAL BETS, REAL PAYOUTS, ON STREAM`, title `Biggest wins`, sort
> chips right. Button beneath: `See the wall of fame`, outline.
>
> **Entrance:** the featured multiplier counts up from 0 over 1100ms with an `--ease-out`
> curve, so it decelerates into its final value the way a slot's counter does. This is
> the one place on the site where a number's animation is allowed to be theatrical.

---

## 18. About Matty

> Build the about section. The portrait is treated as a **second light source**, not as
> an image in a column.
>
> **Layout:** the portrait sits left, roughly 40% width, with its own blue bloom
> behind it matching the hero player's treatment at lower strength. The text sits right
> but **starts above the portrait's top edge and ends below its bottom edge**, so the two
> interlock rather than sitting in matched grid cells. That asymmetry is the whole point:
> the section immediately above is a rigid three column grid and this one must not be.
>
> **Text:** `About` label, `About Matty` at `display-m`, then the existing about copy at
> `body-l` in `--color-ink-2`, capped at `54ch` on the paragraphs. Any em dashes in the
> existing copy are rewritten before it ships (§ copy gate).
>
> **Beneath, two quiet panels** side by side, both `.lit`, both with a hairline header:
> - *Stream schedule.* Day left, time right in mono gold, one row each. Footer line at
>   11px mono `--color-faint`: All times UK. Extra streams get announced in Discord.
> - *Where to find him.* Platform mark, handle in mono, one row each, hovering to blue.
>   Footer link: `Check an account is really his`, ghost, to `/official`.
>
> **The living element:** the portrait's bloom breathes on a 7 second cycle at ±8%
> opacity. Slow enough that it reads as a room, not a pulse.

---

## 19. The one call to action

Every section above earns the scroll to this one.

> Build the Razed section as **the only place on the page where blue fills a large
> area.** Everything else has been quiet so that this reads as loud.
>
> **A full width panel**, `--radius-card`, filled with a blue gradient from
> `--color-light-bg` at the left to a stronger mix at the right, a `--color-light-line`
> border, and the room light peaking on it.
>
> **Layout:** copy left at `1.6fr`, mark and button right at `1fr`, baseline aligned.
>
> **Copy, verbatim.**
> - Title, `display-m`: **Play on Razed under code MATTY**. The code itself is set in
>   mono at the same size, which is the one place display and mono sit on the same line
>   and it should look deliberate.
> - Body at `body`, capped at `50ch`: Sign up under the code and every dollar you wager
>   counts towards the weekly board automatically. There is nothing to link and nothing
>   to claim until the period closes.
> - Button: `Claim the bonus`, primary, `lg`, opening in a new tab with
>   `rel="noopener noreferrer"`.
>
> **The button is the brightest object on the entire page.** Nothing above it competes.
> If anything does, the thing above it is wrong, not this.
>
> **The living element:** a slow blue sweep across the panel's top hairline, 6
> seconds, `-2s` delay. It is the only thing on the page that draws the eye downward at
> rest.

---

## 20. Leaderboard

**Superseded by `MattySpins-Leaderboard-UI-Spec.md` §1 to §10.** The summary below stands;
that document is the build input.

The most re read page on the site. A viewer who is on the board opens it daily.

> Build the full leaderboard. Same podium and rank rows as §14, at full scale, with three
> additions.
>
> **The period header** carries the pot in gold at `num-l`, the countdown beside it, and
> the Weekly / Monthly chips. It is sticky under the nav at 56px, condensing to the
> figure and the chips on scroll, because a viewer scrolling to rank 80 still needs to
> know which board they are reading.
>
> **The you row.** If the viewer is on the board, their row is **pinned to the bottom of
> the viewport** as a floating strip while their real row is off screen, blue
> hairlined, with their rank, wagered and prize, and a small `YOU` pill. When their real
> row scrolls into view the pinned strip fades out and the real row takes the blue
> hairline instead. Never render both at once.
>
> If the viewer is signed in and not on the board, the pinned strip reads their wagered
> total and the gap: `£420 more this week to reach rank 50`. If that figure is unknown it
> reads `Wager on Razed under code MATTY to appear here` and nothing else. Never invent
> the gap.
>
> **Rank rows** (§32) are hairline separated, 64px tall, and alternate nothing. Zebra
> striping on a lit surface fights the light and looks like a spreadsheet.
>
> **Footer:** the sync line, `Updated 4 minutes ago · all times UTC`, and the prize tier
> table beneath as a plain mono two column list, rank range and prize.
>
> **States:** no board open, feed unreachable (states so plainly and shows the last known
> sync time, never an empty board), fewer players than tiers, viewer signed out.

---

## 21. Claim a prize

**Superseded by `MattySpins-Leaderboard-UI-Spec.md` §11.** The summary below stands; that
document is the build input.

> Build the claim flow. It is a money screen, so it is the second plainest page on the
> site after `/verify`. Display face appears once, in the heading, and nowhere else.
>
> A single centred column at `560px`. The prize in gold at `num-l` with its rank above at
> `label` size. Then the form: the fields, one per row, full width, `--color-line-lit`
> borders, 44px minimum height, labels above in `label` size.
>
> **Every state is designed, not just the happy one:** not eligible, already claimed,
> claim window closed with the closing date shown, submitted and pending, paid with the
> date. A claim page that only renders the success path is the one that generates the
> support messages.
>
> No light drift on this page, no living elements, no entrances beyond a single fade.
> Motion on a money form reads as instability.

---

## 22. Wall of fame

**Superseded by `MattySpins-Media-and-Trust-UI-Spec.md` §1 to §4.** The summary below stands;
that document is the build input.

> Build the wall of fame as the wins band (§17) extended to a full page, and keep its
> darkness: the room light is masked off here too.
>
> **A masonry-feeling grid** at three columns desktop, two at tablet, one at mobile, with
> **deliberately unequal card heights** driven by multiplier size. A 2,431× win is
> physically larger on the page than a 40× win. The wall ranks itself visually before
> anyone reads a number.
>
> Sort chips: By multiplier, By win, All time. The active chip is blue bordered.
>
> Each card: multiplier at a size scaled to its rank in the current sort, slot name,
> stake and payout in mono, the clip thumbnail, date and platform, and a `Verify` ghost
> link where the round is one of ours.
>
> **Empty state:** No wins on the wall yet. Clips get added after the stream.

---

## 23. Clips

**Superseded by `MattySpins-Media-and-Trust-UI-Spec.md` §5 to §7.** The summary below stands;
that document is the build input.

> Build the clips page. The homepage rail (§16) becomes a grid here: three columns
> desktop, two tablet, one mobile, same card, same hover.
>
> Source chips across the top: All, Kick, YouTube, Instagram, X. Active chip blue
> bordered.
>
> **Play in place.** Clicking a card swaps the thumbnail for the embedded player inside
> the same card bounds rather than navigating or opening a modal. Only one card plays at
> a time; starting a second stops the first. No autoplay anywhere, ever.
>
> **Empty per filter:** No clips from YouTube yet. Try All.

---

## 24. Shop

**Superseded by `MattySpins-Shop-Giveaways-UI-Spec.md` §1 to §5.** The summary below
stands; that document is the build input.

Shell only today. This is what it becomes.

> Build the shop. **The coin bar is at full size here**, not the compact nav version: a
> lit panel across the top with the balance at `num-l` in gold, the rate line beneath,
> and a ghost link to `/me`. On the page where coins are spent, the balance is the
> heading.
>
> Category chips: Entries, Discord, Merch, Stream.
>
> **Item cards**, three columns desktop. Each: name at `display-s`, description at 14px
> `--color-ink-2` clamped to three lines, cost at `num-m` in gold with the coin mark, and
> the redeem button.
>
> **Six states, and the affordability one is the whole design of this page:**
> - *Affordable* — primary button, `Redeem`.
> - *Not affordable* — button disabled, and beneath it in gold at 13px mono, **the
>   shortfall, not the price**: `1,240 MC short`. The card also renders a thin gold
>   progress bar of balance against cost across its bottom edge. Telling someone how far
>   away they are is motivating. Telling them they cannot afford it is not.
> - *Out of stock* — card at 55% opacity, `Out of stock` pill, no bar.
> - *On cooldown* — button replaced by a mono countdown, `Available in 4h 12m`.
> - *Already pending* — gold bordered card, `Pending` pill, ghost link to `/me`.
> - *Signed out* — every card renders normally with costs visible and the button reads
>   `Sign in to redeem`. Never hide the catalogue behind auth. The catalogue is the
>   argument for signing in.
>
> **Redeem is a two step.** A confirm dialog naming the cost and the remaining balance
> after: `Redeem Discord VIP for 5,000 MC? You'll have 7,480 MC left.` No default focus
> on the confirm button.
>
> **Closing note**, 14px `--color-muted`, centred: Coins cannot be bought. There are no
> packages and no payment path. Everything here was earned by turning up.

---

## 25. Giveaways

**Superseded by `MattySpins-Shop-Giveaways-UI-Spec.md` §6 to §11.** The summary below
stands; that document is the build input.

> Build the giveaways page. Same full size coin bar as the shop.
>
> **Eyebrow:** `ENTRIES COST COINS · DRAWS ARE PROVABLY FAIR`. That second half is the
> reason anyone trusts this page and it belongs above the fold.
>
> **Active giveaway cards**, two columns. Each: prize at `display-s`, prize value in
> gold, entry cost with the coin mark, `Your entries 12 of 25` as a mono figure with a
> thin blue bar showing progress to the per person cap, total entries, the closes in
> countdown, and the enter control.
>
> **The seed hash is on the card, not hidden in a drawer.** At 11px mono in
> `--color-faint`, truncated to 16 characters with a copy button:
> `SERVER SEED HASH · a4f9c2e1…` Beneath it, one line: Published before entries opened,
> so the draw cannot be changed afterwards.
>
> **States:** none running (an empty state that says when the next one usually appears,
> not just "nothing here"), running, you have entries, at your cap, not enough coins
> (shortfall in gold, same treatment as the shop), signed out, drawn.
>
> **Past giveaways** as a mono table beneath: prize, drawn date, entries, cost, winner,
> and the **revealed seed** with a copy button and a `Recompute` ghost link to `/verify`.
> A past giveaway with no revealed seed is a bug, and the table should render it as a
> danger row rather than an empty cell.

---

## 26. Profile

**Superseded by `MattySpins-Profile-UI-Spec.md`.** The summary below stands; that document
is the build input.

> Build the profile. It is the viewer's own page, so it is the one place the light is
> centred on **them** rather than on the player: the key gradient shifts to sit behind
> the header card.
>
> **Header card**, full width, `.lit`, blue hairline. Avatar at 72px, username at
> `display-m`, tier badge, member since in mono, Kick username if linked, and the
> multiplier tags as pills. Right side: the balance at `num-l` in gold, the line "Earned
> by watching. Cannot be bought, sold or withdrawn." at 13px `--color-muted`, and a
> `Spend them` primary button to the shop.
>
> **Stat tiles**, four across, and here four equal boxes **are** correct, because these
> four figures are genuinely peers: lifetime earned, earned this week, coins spent, net
> from games today. Net is gold above zero and `--color-danger` below, counting rather
> than snapping.
>
> **Quick settings** as two lit panels: Discord (signed in as, sign out) and Kick
> (linked username or the link flow). The Kick verification card is the one element on
> this page allowed a blue glow, because linking Kick is what turns earning on.
>
> **The ledger** beneath as a mono table: date, reason, amount signed and coloured, and
> running balance. Tabular figures, right aligned, hairline separated rows. This is a
> bank statement and it should look like one.

---

## 27. Games lobby

**Superseded by `MattySpins-Games-UI-Spec.md` §1.** The summary below stands; that
document is the build input.

> Build the games lobby. **The balance heads the page** as in the shop.
>
> Eyebrow: `PROVABLY FAIR · PLAYED WITH COINS YOU EARNED WATCHING`.
>
> **The card grid at five per row** on desktop, using the existing key art. Cards are
> `.lit`, 4:5 portrait, art filling the card with a bottom gradient scrim and the name at
> `display-s` over it. Hover lifts 6px and brightens the blue edge.
>
> **Coming soon games** render at 45% opacity with a `SOON` pill, are not links, and
> carry `aria-disabled`. They stay in the grid because a five card row with three cards
> in it looks broken.
>
> **Biggest hits today** as a mono table beneath: player (masked), game, bet, multiplier,
> payout, and a `Verify` ghost link per row. The multiplier column is gold and tabular.
>
> **Kill switch state:** the entire lobby is replaced by a single centred lit panel,
> danger hairlined, reading that games are off, that balances are untouched, and that
> rounds in progress settled normally. Nothing else on the page. A half disabled lobby
> reads as broken software.
>
> **No rounds today:** the table is absent entirely, not rendered empty.

---

## 28. Game screen, shared

**Superseded by `MattySpins-Games-UI-Spec.md` §2 to §11.** The summary below stands; that
document is the build input.

> Build the shared game shell that Keno, Dice and Limbo sit inside.
>
> **The local light.** A game screen gets its **own** light, a blue bloom behind the
> game surface, separate from the room light. Results pulse the local light and never the
> room light. The room means the stream; the game surface means the game. Crossing them
> would make a Limbo win look like Matty came online.
>
> **Layout:** the game surface centred at `max-width: 720px`, the bet controls docked
> beneath it as attached hardware (same treatment as the hero's earning bar), and the
> round history as a horizontal mono strip above the surface, newest left.
>
> **Controls, locked while a round settles.** Every control gets `disabled` and 55%
> opacity, and the primary button's label changes to a mono `Settling…`. A control that
> looks live while the server is deciding is how double bets happen.
>
> **The result.**
> - *Win:* the local light pulses blue once over 400ms, the payout counts up in gold
>   at `num-l`, and the multiplier lands beside it.
> - *Loss:* the local light dips 30% over 300ms and eases back. The result reads `0.00×`
>   in `--color-muted`. Requirements rule 5: losing is stated plainly, never softened,
>   never animated away.
>
> **RTP on screen always**, at 12px mono in `--color-faint`, in the surface's corner. Not
> in a drawer, not on hover.
>
> **The fairness drawer** is a bottom sheet on mobile and a right panel on desktop,
> opened by a `Provably fair` ghost link with a small shield mark. It contains the server
> seed hash, client seed and nonce as three mono rows with copy buttons, a `Rotate seed`
> button, a `Verify a round` link that prefills `/verify` from the current round, and the
> sentence explaining that the hash commits the server to a seed it cannot change, and
> that rotating reveals the old one so every round played on it can be recomputed by
> anyone.
>
> **The opt in gate** replaces the game surface entirely, centred, lit, stating the 18+
> requirement and that coins have no cash value, with one primary button to turn games
> on. It never renders as a modal over a playable board.
>
> **Per game notes.** Keno's tile grid keeps its existing pop and rise animations, retuned
> to `--ease-out` and the new palette: a hit tile is blue bordered with a filled corner
> notch, a miss is `--color-line` at 55% opacity with a diagonal strike. Shape as well as
> colour, because hit and miss is the one distinction on this site that a colour blind
> viewer must never lose.

---

## 29. Verify a round

**Superseded by `MattySpins-Media-and-Trust-UI-Spec.md` §8.** The summary below stands;
that document is the build input.

> Build `/verify` as **the plainest page on the site, deliberately.** No display face
> anywhere. No light. No entrances. No living elements. Flat `--color-canvas`, mono and
> body text only, hairline separated blocks.
>
> The page that proves the site is honest should look like evidence, not like marketing.
> Every other page is designed to make you feel something. This one is designed to be
> checked.
>
> **The form:** game select, server seed, client seed, nonce, and the game specific
> inputs, all full width mono inputs with `--color-line-lit` borders. Prefilled from the
> query string, so a `Verify` link from any round lands here ready to run.
>
> **The result** as a single block: the recomputed outcome, and beside it either a
> blue `MATCHES` or a danger `DOES NOT MATCH`. That word is the entire output of this
> page and it is the only coloured thing on it.
>
> **The four step explanation** beneath as a numbered mono list: check the commitment,
> build the byte stream, turn bytes into numbers, apply the game. Each step shows its
> actual intermediate value for the round being verified, not a generic description.
>
> Works signed out. Works on somebody else's round. Both are stated on the page.

---

## 30. Casinos, Official, Legal

**Superseded by `MattySpins-Media-and-Trust-UI-Spec.md` §9 to §11.** The summary below stands;
that document is the build input.

> **Casinos.** One lit panel for the Razed offer with the code in mono at `display-s` and
> a copy button, the three step explanation as a numbered sequence reusing §15's
> connecting line, and two cards that must not look alike: a `--color-danger` hairlined
> *Play with money you can lose* card, and a muted affiliate disclosure stating Matty
> earns a commission. The warning card is above the sign up button, not below it.
>
> **Official accounts.** A plain list, platform mark, handle in mono, one row each, with
> a green free `VERIFIED` state carried by a checkmark glyph rather than a colour. Beneath,
> a danger hairlined card: **He will never DM you first asking for money or a seed
> phrase.** That sentence is set at `display-s`, because it is the only sentence on this
> site that stops someone being robbed.
>
> **Legal pages.** One shared long form template: `display-m` heading, last updated date
> in mono, then body at `body-l` with a `68ch` cap on the paragraphs and generous
> spacing. No light, no motion. A gold hairlined draft banner while the legal review flag
> is false, reading plainly that the document is a draft and not yet reviewed.
>
> `/responsible` additionally gets the self exclusion links, the helpline and the deposit
> limit guidance in a lit panel at the top of the page, above the body copy rather than
> at the bottom of it.

---

## 31. Component — surface and card

> `.lit` is the base surface treatment from §3: panel colour, the fixed attachment top
> gradient, a `--color-line` hairline, and `--radius-card`.
>
> **Tones** change only the hairline and the gradient's hue: default, light (blue),
> gold, danger. The fill never changes. Four differently coloured card fills on one page
> is how the current build ended up looking like a status dashboard.
>
> **Interactive cards** gain `--color-line-lit` on hover, a 4px lift, and a brightened
> top edge, over 240ms on `--ease-out`. Non interactive cards never lift, because a card
> that moves under the cursor and does nothing is a broken promise.
>
> Under 720px the fixed attachment gradient is dropped for a static 1px top hairline in a
> horizontal blue gradient. Cheaper, and at phone sizes the falloff was never visible.

---

## 32. Component — rank row and podium

> **Rank row.** 64px tall, hairline bottom, grid at `48px 44px 1fr auto auto`: rank
> numeral in `num-m` (`--color-muted` past rank three), avatar, username at 15px Manrope
> 600 truncated at `20ch`, wagered in `num-s` gold, prize in `num-s` gold.
>
> Ranks one to three carry their metal on the numeral only. The row itself is not tinted.
>
> **The you row** takes a blue left border at 2px and a `YOU` pill, and nothing else
> changes. Highlighting it further makes the board look like it is about the viewer, and
> it is not.
>
> **Hover** brightens the row background by 4% and nothing moves. A board row that lifts
> on hover makes scanning a hundred rows feel seasick.
>
> **Podium** as specified in §14: three unequal cards catching decreasing light, rank one
> centre and taller.

---

## 33. Component — countdown

> Mono, tabular, and it never reflows. Every digit cell has a fixed width so the layout
> does not jitter as 10 becomes 9.
>
> **Two forms.** *Inline*, for the strip and cards: `03:14:22` at `num-m`. *Boxes*, for
> the offline hero: four cells with the figure at `num-xl` and the unit beneath at
> `label` size, hairline separated, with the whole group carrying the gold bloom that
> makes it the only lit object on an offline page.
>
> **Under a minute** the figure turns `--color-danger`. That is the only place danger
> colour appears outside an error state, and it is earned.
>
> **The seconds digit is the only animated element**, a 1px rise on change, no crossfade.
>
> **Expired** renders the label the parent supplies, never `00:00:00`.

---

## 34. Component — empty and loading states

> **Empty states are designed, and they are not error states.** A lit panel, a 32px muted
> mark, a heading at `display-s`, one sentence of plain explanation, and where there is
> something useful to do, one ghost link. Never an icon of a sad face, never the word
> "Oops".
>
> Every empty state on this site says **why** it is empty and **what changes it**, which
> is the difference between the two sentences "No board to show yet" and "Nothing appears
> here until that feed returns players". Ship both.
>
> **Loading states are skeletons of the real layout**, at `--color-panel` with a 1.6s
> shimmer sweep that respects reduced motion by going static. Never a spinner on a page
> that has a known shape. A spinner says "something is happening"; a skeleton says "here
> is what is coming", and this site always knows.
>
> **Feed unreachable** is its own state, distinct from empty: danger hairlined, states
> that the Razed feed did not answer, shows the last successful sync time, and offers a
> retry. An unreachable feed rendered as an empty board is the single worst failure this
> site can have, because it silently tells every viewer they are not on the leaderboard.

---

## 35. Component — the number

> `Num` is the most used component on this site and it carries three non negotiable
> behaviours.
>
> 1. **Mono, tabular, always.** Requirements rule 1.
> 2. **`null` renders `—`, never `0`.** Requirements rule 3. This lives in the component
>    so no page can forget it.
> 3. **Money always carries its unit.** The currency symbol or `MC` is part of the
>    render, not something the page appends. A gold figure with no unit does not compile.
>
> **Counting.** `Num` takes an optional `count` prop. When set, the figure animates from
> its previous value on change, over 700ms on `--ease-out`, and jumps instantly under
> reduced motion. Used on the pool, the balance, payouts and net. Never used on a rank, a
> date or a countdown.

---

## 36. Admin — wave three

**Superseded by `MattySpins-Admin-UI-Spec.md`.** The summary below stands; that document is
the build input.

> Admin keeps the current look until public is finished, then gets a **reduced** version
> of this system, not the full one.
>
> **What it inherits:** the tokens, the type trio, the radii, the primitives, the focus
> ring, the empty and loading states, and `Num`.
>
> **What it does not get:** the light layer, any drift, any living element, the display
> face above `display-s`, entrances, and the interactive moment. An operator running
> twenty redemptions does not want the room breathing at them.
>
> Tables go denser: 44px rows, 13px body, mono everywhere a figure appears. The admin
> shell keeps its sidebar and gains the blue active state and nothing else.

---

## States to build

Requirements §6 says every page handles these. This is how each one looks.

| State | Where | Behaviour |
|---|---|---|
| Stream goes live while the page is open | Whole site | Light transitions cold to blue over 1200ms, nav hairline lights, coin bar gains its rate line, hero swaps composition. The best moment the site can produce, so it never snaps |
| Stream ends while the page is open | Whole site | The reverse, same duration. Coin bar keeps the balance, drops the rate line, gains `Paused` |
| Viewer count unavailable | Hero, live | The whole element goes. Never a `—` where a live count would be, never a zero |
| Signed out | Everywhere | Catalogues, boards and games all render fully. Auth gates the action, never the view |
| Signed in, no Kick linked | Coin bar, hero bar, profile | Gold treatment, one instruction, one link to `/me`. Same words in all three places |
| Earning frozen | Coin bar, hero bar, profile | Danger hairline, `Earning is paused on your account`, link to `/me` |
| Figure unknown | Any `Num` | `—`, enforced in the component |
| Razed feed unreachable | Board preview, leaderboard | Distinct danger state with the last sync time and a retry. **Never an empty board** |
| No board period open | Board preview, leaderboard | Empty state naming when the next period opens |
| Viewer not on the board | Leaderboard | Pinned strip shows their total and the gap, or says how to appear. Never a fabricated gap |
| Item not affordable | Shop | Shortfall in gold plus a progress bar, never a greyed price |
| At entry cap | Giveaways | Bar full, button reads `At your cap`, entries figure stays visible |
| Past giveaway with no revealed seed | Giveaways | Danger row. This is a broken promise, not a blank cell |
| Games kill switch on | Games lobby, game screens | Entire lobby replaced by one panel. Balances untouched, rounds settled, stated plainly |
| Round settling | Game screen | Every control disabled at 55%, primary reads `Settling…` |
| Round lost | Game screen | `0.00×` in muted, local light dips. Stated plainly, never softened |
| Games off for this account | Game screen | Opt in gate replaces the surface, never a modal over a live board |
| Legal doc in draft | Legal pages | Gold hairlined banner, plain words, above the body |
| Reduced motion on at load | Whole site | No drift, no entrances, all final states, skeletons static |
| Reduced motion flipped mid session | Whole site | Both directions. Pins applied on, pins removed and drives re armed on off |
| Video or embed fails | Hero, clips | Poster remains, page stays complete. The layout never collapses around a missing embed |
| Phone, portrait | Whole site | Static light, no drift, no fixed attachment gradients, tab bar carries the live tell |

---

## The quality floor

Every item, every page, every time.

- Fonts trimmed to the weights in §2, with `preconnect` to `fonts.gstatic.com`.
- **Contrast computed, not guessed.** 4.5:1 body, 3:1 large text and interactive borders.
  `--color-line` is decorative and must never be used on an interactive border, which is
  the entire reason `--color-line-lit` exists.
- Semantic landmarks: `<nav>`, `<main id="main" tabindex="-1">`, `<footer>`, a skip link
  to `#main`, one `h1` per page, and `aria-hidden="true"` on every decoration including
  the light layer and the grain.
- `:focus-visible` in blue, 2px, 2px offset, defined once globally and removed nowhere.
- Touch targets at least 44px under `(pointer: coarse)`, added without changing layout.
- Text blocks capped in `ch` on the text element, never on a container.
- Rows of text align on the baseline, not on centred boxes.
- Decorations never collide with content. Absolutely positioned elements reserve their
  space and hide under a `max-height` query.
- Real `<title>` and meta description per route, `theme-color: #070B14`, and an inline SVG
  favicon of the coin mark.
- Zero console errors at desktop and phone widths.

---

## The copy gate

**Mandatory before anyone sees a page.** Run it on the whole of `app/` and
`components/`, not just the hero.

1. **Grep for em dashes.** Zero, in every string. The `—` glyph rendered by `Num` for an
   unknown figure is the one permitted use and it lives in one component.
2. **Grep for the stock words:** leverage, seamless, empower, unlock, robust, actionable,
   data driven, solutions. Rewrite every hit in plain voice and re grep until zero.
3. **Sweep the body copy for the quieter tells:** "it's not just X, it's Y" constructions,
   false ranges, vague attributions, generic big finish conclusions, and the words
   testament, landscape, delve, elevate.

**One carve out, and it matters.** The deliberate devices in this document are craft, not
tells, and they stay: the repeated word "room", the staccato of "no packages, no top ups
and no payment path", the plain refusals that Requirements rule 5 demands, and the
shortfall phrasing in the shop. A tell is what drifted in uninvited. A device is what this
document chose on purpose for this brand.

**Every line of copy in this document ships verbatim.** Build passes wire the authored
lines in and never paraphrase them.

---

## The self test

Run all of it before showing anything. Prove it, do not assume it.

1. Screenshots at 1440×900, 1280×800, 375×812 and 375×667.
2. Every button and link exercised. Every form submitted and its response state seen.
3. **Every entrance proved to actually play.** Cascade order silently kills them.
4. **Stagger retirement proved** by hovering the second and third card after an entrance
   finishes. If they lag, the retirement rule lost a specificity fight.
5. Reduced motion on at load, then **flipped on and off while the page is open**. Both
   directions, or step 4 of §4 is not done.
6. The live and offline light states both checked, and the transition between them
   triggered by hand.
7. The page forced sideways: anchor links, wide decorations, narrow widths.
8. Console clean at desktop and phone.
9. Letter tails (g, y, p) checked at 100% zoom in every clipped or masked text.
10. **Greyscale pass.** Money, actions and live state all still readable.
11. Contrast measured on the four worst pairs, not eyeballed.
12. **The fresh eyes pass, last.** Look at the page as a first time visitor with zero
    context. Does anything float unexplained? Is any parallel element unequal, a card
    styled differently from its siblings, a step without its figure? Does it read as made
    for this one site, or does any stretch read as filler? This is a different act from
    auditing and it catches what audits cannot.

---

## File map

**New**

```
components/system/LightLayer.tsx      §3   client
components/system/Reveal.tsx          §4   client
components/system/SplitText.tsx       §4   client
components/system/HoldToEarn.tsx      §15  client
lib/useReducedMotion.ts               §4
```

**Rewritten**

```
app/globals.css                       §1, §4
app/layout.tsx                        §2   font imports only
app/(site)/layout.tsx                 §3   mounts LightLayer
app/(site)/page.tsx                   §11–§19  layout only, every data call untouched
components/ui/typography.tsx          §5
components/ui/surfaces.tsx            §5, §31, §34
components/ui/controls.tsx            §5
components/ui/marks.tsx               §5
components/ui/Countdown.tsx           §33
components/site/Hero.tsx              §11, §12
components/site/Nav.tsx               §6
components/site/CoinBar.tsx           §7
components/site/MobileTabBar.tsx      §8
components/site/Footer.tsx            §9
components/site/AgeGate.tsx           §10
components/site/Leaderboard.tsx       §14, §20, §32
components/site/ClipCard.tsx          §16, §23
components/site/BigWinCard.tsx        §17, §22
components/site/Section.tsx           §5
components/games/shared.tsx           §28
components/games/Keno|Dice|Limbo.tsx  §28  presentation only
```

**Untouched, and this is enforced, not aspirational**

```
app/api/**        lib/** (except the new hook)      db/**
auth.ts           middleware.ts                     scripts/**
every actions.ts  every route path                  every data shape
```

---

## Build order

**§1 tokens → §2 type → §3 the light → §4 motion → §5 primitives → §6 nav → §7 coin bar →
§11 and §12 hero → §13 strip → §14 board preview → §15 coin rules and the hold → §16 clip
rail → §17 wins band → §18 about → §19 CTA → self test → show Samhith.**

Tokens, type and the light first, and nothing is visible for the first stretch of work.
That is correct. Every surface on this site is lit by §3, so building a card before the
light exists means building it twice.

**The nav and the coin bar come before the homepage** because they are on every page and
they carry the live state. Getting them right proves the signature works at small scale
before it is committed to at hero scale.

**The hero and the light deserve the most time on the whole project.** Everything after
them is presentation layered on a system that already works, and if the room does not
feel like a room in the hero, no later section will rescue it.

**§15's hold interaction comes late in the homepage sequence deliberately.** It is the
highest effort single component on the page and the page is fully shippable without it.
It must never be allowed to block getting a real homepage in front of real eyes.

### Then, in waves

**Wave two, public:** §20 leaderboard → §26 profile → §27 and §28 games → §22 wall of
fame → §23 clips → §24 shop → §25 giveaways → §21 claim → §29 verify → §30 the rest.

Leaderboard and profile first because they are the two pages a returning viewer opens
without being sent there. Verify late, because it is the plainest page in the system and
it needs almost nothing from it.

**Wave three:** §36 admin, on the reduced system.
