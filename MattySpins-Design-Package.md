# MattySpins Design Package

The single input to the UI rebuild. Written before any code changes, approved before any
code changes. Built to the 10k-websites standard, adapted from that skill's static
one-page architecture to this Next.js app.

**What this file replaces.** `MattySpins-UI-Spec.md` is the old visual system and is
retired on approval of this document. `MattySpins-UI-Requirements.md` stays exactly as
it is: it describes content, structure, behaviour and state, and every rule in it
survives this restyle.

**What this rebuild never touches.** `app/api/`, `lib/`, `db/`, `auth.ts`,
`middleware.ts`, `scripts/`, every server action, every data shape and every route path.
This is a UI layer replacement, not a rewrite.

**Two rules govern this document.** Every line of copy in it ships verbatim. Every
number in it is a starting point until the build validates it.

---

## 1. The brand premise

The one word from the subject's world is **the room**.

Matty streams from a dark room at two in the morning and thousands of people are in
there with him. That is the whole product. Coins are paid for presence, not for
spending. The board ranks who was in the room most. The shop spends the room's own
currency, which cannot be bought at any price. The giveaways are for people who were
there.

So the site is the room. Every section teaches one idea: **being here is what pays.**
If a section does not serve that idea, it does not belong on the page.

The direction that carries it is **Late Night**. Not a casino floor, not a neon strip.
One dark room lit by one screen, with an RGB key light behind the desk, which is what a
real streamer's room actually looks like and what the audience already knows.

---

## 2. The palette as CSS tokens

Two colours, and they never appear on the same element.

**Magenta is the light.** It means live, it means action, it means the one call to
action. It is the RGB key light behind the desk.

**Gold is money.** Prize pools, payouts, multipliers, coin figures. It never appears on
anything clickable, so gold on the page always means a number and never means a button.

Everything else is the room: a deep violet dark, never pure black, so the page reads as
a lit space instead of a void.

```css
@theme {
  /* The room */
  --color-canvas:     #0A0817;  /* page ground, violet tinted, never #000 */
  --color-panel:      #14112B;  /* cards and raised surfaces */
  --color-panel-2:    #1D1940;  /* hover and pressed */
  --color-line:       #241F45;  /* quiet borders */
  --color-line-lit:   #3A3168;  /* interactive borders, passes 3:1 */

  /* Ink, warmed toward the light, never pure #fff */
  --color-ink:        #F2EEFF;
  --color-ink-2:      #B9B2D6;
  --color-muted:      #8A83A8;
  --color-faint:      #665F85;

  /* The light: live, action, the one CTA */
  --color-light:      #F5327E;
  --color-light-hot:  #FF5C99;  /* hover */
  --color-light-ink:  #1A0410;  /* text on a filled magenta surface */
  --color-light-bg:   #2A0C22;  /* magenta at whisper level */
  --color-light-line: #4A1638;

  /* Money, and money only */
  --color-gold:       #F0B429;
  --color-gold-bg:    #241A05;
  --color-gold-line:  #40300C;

  /* Podium metals */
  --color-silver:     #C9C4DE;
  --color-bronze:     #C08557;

  /* Failure, kept quiet */
  --color-danger:     #FF8A6B;
  --color-danger-bg:  #24100C;
  --color-danger-line:#4A1D14;
}
```

**What leaves.** `--color-brand` blue is gone from the site entirely. `--color-online`
green is gone: live is no longer a green dot, it is the room being lit, which is the
signature element in section 4. Discord blurple stays, since it is another brand's mark
and borrowing it is honest.

**Radii.** The current 3px is the single loudest tell that a machine chose it. Cards go
to 14px, controls to 10px, pills to full round. Surfaces are lit, and lit surfaces have
edges you can see the light travel around.

---

## 3. The type trio

| Role | Face | Weights | Why |
|---|---|---|---|
| Display | **Unbounded** | 700, 800 | Wide, geometric, unmistakable. Reads modern and nocturnal, and it is nobody's default. |
| Body | **Manrope** | 400, 500, 600, 700 | Quiet, warm, gets out of the way. Not Inter, not Roboto. |
| Numbers and labels | **JetBrains Mono** | 400, 500, 700 | Stays. Every number in a column is mono with tabular figures, which is Requirements rule 1 and it is correct. |

Anton and Barlow are both retired. Body size goes from 15px to 16px with a 1.6 line
height, because 15px is an admin panel and 16px is a website.

Display face is used at real scale or not at all. The hero headline runs at
`clamp(44px, 7vw, 96px)`. Nothing in between gets Unbounded.

---

## 4. The signature element: the light

One fixed light source behind the entire page. This is the piece whose absence would be
noticed, and the whole boldness budget is spent here.

**How it works.** A single fixed layer sits behind all content, holding one large soft
radial gradient positioned behind the hero player. Content scrolls; the light does not.
Scrolling therefore feels like moving through one room instead of past stacked sections,
which is the environment requirement in the skill.

**It is wired to the live state, which is the whole point.**

- **Live.** The light is magenta, at full strength, drifting on a 90 second cycle so it
  is never quite still. Card top edges catch a 1px highlight that falls off with
  distance from the source. The room is on.
- **Offline.** The light cools and drops to about a fifth of its strength. The room goes
  dark and the countdown to the next stream becomes the only lit thing on the screen. It
  glows gold, because the thing worth waiting for is the money.

The single most checked fact on this site is whether Matty is live. Right now that fact
is a green dot roughly two pixels wide. After this it is the lighting of the entire
page, felt before it is read.

**Supporting rules.** Panels are never flat fills. Each carries a low opacity gradient
angled from the light source, so a card near the top of the page is lit differently to
one near the bottom. This is the detail that stops the page reading as stacked
rectangles.

**Reduced motion.** The light renders at its final state with the drift stopped. It
never disappears, because it is the design, not decoration.

---

## 5. The homepage plan

No two adjacent sections share a skeleton. The current page runs eyebrow, title, chip
row, grid four times in a row, and that is the second loudest tell after the radii.

### 5.1 The room (hero)

Not a two column split. The player sits centred and slightly recessed into the page, the
light blooming behind it. The headline overlaps its top edge. The earning status docks
to its bottom edge as a lit bar, so the one thing a returning visitor checks is attached
to the one thing they came to watch.

Two genuinely different compositions, not one composition with a flag.

**Live, copy verbatim:**

- Eyebrow: `LIVE ON KICK` and, only when Kick actually gives us a number, `2,431 WATCHING`
- H1: **You're in the room.**
- Sub: Talk in chat and you earn Matty Coins every three minutes. Stay all week and you're on the board.
- Buttons: `Watch live` (filled magenta) and `See the board` (outline)
- Docked bar, signed out: **Sign in to start earning.** It takes about a minute.
- Docked bar, no Kick linked: **Link your Kick account to start earning.**
- Docked bar, earning: **You're earning 2 MC every 3 minutes.** Sub multiplier applied.
- Docked bar, frozen: **Earning is paused on your account.**

**Offline, copy verbatim:**

- Eyebrow: `OFFLINE`
- H1: **The room opens Thursday, 8PM.**
- Countdown boxes, gold, the only lit thing on the page
- Sub: Coins pause when the stream does. The board, the shop and the giveaways keep running.
- Buttons: `Watch last stream` and `Wall of fame`
- Docked bar: the week's schedule, day, time and platform

**Entrance.** Headline splits into words on load and rises in reading order, then the
sub fades, then the buttons, then the docked bar. Three arrivals, one beat. Driven by a
load ramp, transform and opacity only, and skipped entirely under reduced motion.

### 5.2 The strip

Not four equal boxes. The weekly prize pool is the dominant figure, set in gold at
display scale, with the other three as small mono readouts stacked beside it.
Asymmetric on purpose, and a completely different shape to the section above and below.

Labels stay as they are: `Weekly prize pool`, `Board resets in`, `Earning right now`,
`Paid out to date`. Requirements rule 3 holds: anything we do not have renders as an em
dash and never as a zero.

### 5.3 This week's board

A broadcast table. Top three lift onto a podium where rank one catches the most light
and rank three catches the least, which reuses the signature instead of inventing a new
device. Ranks four to six run below as rows.

- Eyebrow: `WAGERED ON RAZED UNDER CODE MATTY`
- Title: **This week's board**
- Footer line: `Updated 4 minutes ago · all times UTC`, which is Requirements rule 4 and stays
- Empty state: **No board to show yet.** Positions come straight from Razed for accounts registered under the code MATTY. Nothing appears here until that feed returns players.

### 5.4 How coins work, and the interactive moment

Not three cards in a row. A vertical numbered sequence with a self drawing SVG line
running down the left, connecting each rule to the next as you scroll. The line draws
itself once and holds.

**The one interactive moment lives here.** A coin the visitor presses and holds. While
held, a tick counter climbs at the real rate with their own multiplier applied, showing
what an hour in the room actually pays them. Release early and it eases back down rather
than snapping to zero. Hold it to the end and the three rules light up in sequence.
Under reduced motion it shows the finished state with no hold required.

The visitor does not read that being here pays. They perform it.

**Copy verbatim:**

- `1 MC` / every 3 minutes / Say anything in chat and you start earning. One message keeps you earning for the next fifteen minutes, and the bot drops a claim word every twenty so quiet people never have to spam.
- `+10 MC` / for a full hour / Twenty ticks in a row with no gap pays a bonus on top. Miss one and the run resets. It pays for being here, not for leaving a tab open.
- `2×` / everything, for subs / Any sub tier doubles every coin you earn. VIPs earn 2.5×. Multipliers never stack, so the highest single one applies and a VIP who also subs earns 2.5×, not 5×.
- Closing line: Coins cannot be bought. There are no packages, no top ups and no payment path. They are earned by turning up and nothing else. They have no cash value and cannot be transferred.

### 5.5 Clips

Breaks the container to full bleed. A horizontal rail that runs off both edges of the
screen, cards lit along their top edge, the rail dimming toward the edges so it reads as
continuing past the viewport. Nothing else on the page is full bleed horizontal.

### 5.6 Biggest wins

A full bleed band where the light dims almost to nothing and the multiplier numerals are
the only lit thing. Gold, enormous, mono, tabular. The featured win runs at
`clamp(72px, 12vw, 180px)`.

- Eyebrow: `REAL BETS, REAL PAYOUTS, ON STREAM`
- Title: **Biggest wins**
- Button: `See the wall of fame`

This is the darkest point of the page, which sets up the CTA being the brightest.

### 5.7 About Matty

The portrait is treated as a second light source, with its own bloom, and the text wraps
asymmetrically around it rather than sitting in a 5 and 7 column grid. Schedule and
socials become two quiet lit panels below.

Existing about copy is kept, with any em dashes rewritten.

### 5.8 The one call to action

Razed, and it is the only place on the page where magenta fills a large area. Every
section above earns the scroll toward it.

- Title: **Play on Razed under code MATTY**
- Body: Sign up under the code and every dollar you wager counts towards the weekly board automatically. There is nothing to link and nothing to claim until the period closes.
- Button: `Claim the bonus`

---

## 6. The motion system

- **Nothing snaps.** Two easing tokens, `--ease-out: cubic-bezier(.16,1,.3,1)` and
  `--ease-soft: cubic-bezier(.4,0,.2,1)`, used everywhere. Even the page eases in.
- **Entrances are choreography.** A `Reveal` client component wraps an
  IntersectionObserver and adds `.in`. Children arrive in sequence at 60 to 150ms steps.
  Start and end states are prefixed with the container class so a later rule cannot
  silently cancel them, and the stagger delays are retired after the entrance so hovers
  on later siblings never lag.
- **One living element per section** at whisper level, four seconds or slower, given a
  negative delay so it is mid cycle at first paint, paused off screen by an observed
  class and paused on hidden tabs by `body.paused *, body.paused *::before,
  body.paused *::after { animation-play-state: paused !important }`.
- **Transform and opacity only.** Glow pulses put the shadow on a pseudo element at full
  strength and animate its opacity.
- **Reduced motion is honoured live, in both directions.** A `useReducedMotion` hook
  listens for the change event. On a flip in, drawn lines finish, counters jump to
  target, the hold completes and every drive stops. On a flip back out, the drives are
  re armed and the pins removed.
- **`overflow-x: clip` on both `html` and `body`**, with `hidden` declared first.

---

## 7. The vector and environment layer

- The fixed light layer from section 4, one element, behind everything.
- A hand drawn SVG coin path that self draws down the left of the coin rules section.
- Grain at about 3 percent opacity over the whole page, static, so the flat dark never
  bands on a cheap monitor.
- Particles are deliberately not used. In a dark room they read as dust on the screen,
  and the light already carries the atmosphere.

All of it shows its final state under reduced motion, with the drives stopped.

---

## 8. The engineering list

**New files**

- `app/globals.css` rewritten around the tokens above.
- `components/system/LightLayer.tsx` (client) the signature light, wired to live state.
- `components/system/Reveal.tsx` (client) the IntersectionObserver entrance wrapper.
- `components/system/SplitText.tsx` (client) word and character splitting with a seeded
  generator so offsets are identical on every load, plus a visually hidden full sentence
  for screen readers and `aria-hidden` on the visual copy.
- `lib/useReducedMotion.ts` the live, both directions hook.

**Rewritten**

- `components/ui/typography.tsx`, `surfaces.tsx`, `controls.tsx`, `marks.tsx`
- `components/site/Hero.tsx`, `Section.tsx`, `Nav.tsx`, `Footer.tsx`, `Leaderboard.tsx`,
  `BigWinCard.tsx`, `ClipCard.tsx`, `CoinBar.tsx`, `MobileTabBar.tsx`
- `app/(site)/page.tsx` layout only, every data call left as it is
- `app/layout.tsx` font imports only

**Untouched.** Every file under `app/api/`, `lib/` except the new hook, `db/`, `auth.ts`,
`middleware.ts`, `scripts/`, and every `actions.ts`.

**Quality floor, all of it, every time**

- Fonts trimmed to the weights listed in section 3, with `preconnect`.
- Contrast computed, not guessed: 4.5:1 body, 3:1 large text and interactive borders.
  `--color-line` is a decorative hairline and is never used on an interactive border,
  which is what `--color-line-lit` exists for.
- Semantic landmarks, a skip link to `#main`, a real heading hierarchy, `aria-hidden` on
  every decoration including the light layer.
- `:focus-visible` in magenta, defined once and removed nowhere.
- 44px minimum touch targets under `(pointer: coarse)`, added without changing layout.
- Text blocks sized in `ch` on the text element itself, never on a container.
- Real `<title>`, meta description, `theme-color` set to `#0A0817`, and an inline SVG
  favicon of the coin mark.

---

## 9. The copy gate

Every viewer facing line in this document ships verbatim.

Before anything is shown to anyone, the built pages are grepped for em dashes and for
the words leverage, seamless, empower, unlock, robust, actionable, data driven and
solutions. Every hit is rewritten in plain voice and the grep is re run until both
return zero.

Then the body copy is swept for the quieter tells: "it's not just X, it's Y"
constructions, false ranges, vague attributions, generic big finish conclusions, and the
words testament, landscape, delve and elevate.

One carve out. The deliberate devices in this package stay, because the package chose
them on purpose for this brand: the repeated word "room", the staccato of "no packages,
no top ups and no payment path", and the plain refusals in Requirements rule 5. A tell
is what drifts in uninvited, not what was designed.

---

## 10. Build order

1. Tokens, fonts and the light layer. Nothing visible yet.
2. The primitives: typography, surfaces, controls, marks.
3. The motion system: Reveal, SplitText, the reduced motion hook.
4. The homepage, section by section, in the order of section 5.
5. Self test against the checklist: screenshots at 1440x900, 1280x800, 375x812 and
   375x667, every button exercised, console clean, reduced motion on and flipped live,
   entrances proved to actually play, the page forced sideways, letter tails checked in
   every clipped text.
6. Show Samhith the homepage. Take notes in plain words. Then the remaining pages in
   waves.
