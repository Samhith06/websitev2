# MattySpins

The community site described in `MattySpins-Master-Plan.md` and `MattySpins-UI-Spec.md`, built as a
Next.js App Router project. Every screen in both documents exists and renders.

```bash
npm run dev
```

Then <http://localhost:3000>. Admin is at `/admin` — deliberately unlinked from the public nav.

> **If `next dev` dies instantly with `EINVAL: invalid argument, readlink '.next\...'`:**
> run `rm -rf .next` and start again. The project lives inside OneDrive, which syncs `.next` and
> turns build files into cloud placeholders that Next cannot read back. The permanent fixes are to
> move the project outside OneDrive, or to right-click `.next` → *Always keep on this device* (or
> exclude it from syncing). Deleting `.next` is only a per-incident workaround.

---

## Deploying to Railway

The app is a standard Next.js server build — Railway's Nixpacks detects it, and
`railway.json` pins the build and start commands. `npm run start` binds to Railway's
injected `$PORT`.

**Set these environment variables in the Railway service:**

| Variable | Value | Why |
|---|---|---|
| `ADMIN_PASSWORD` | something long | **Required.** Without it `/admin` returns 404 in production. |
| `SITE_PASSWORD` | something long | Set for a private preview — puts the whole site behind a password. Leave unset to go public. |
| `ALLOW_INDEXING` | `true` | Only once the legal review has landed. Defaults to `noindex, nofollow`. |

The username for both passwords is `matty`. Admin credentials unlock `/admin`; the site
password unlocks everything else.

**Before it goes public, not before it deploys** — see Master Plan §12 and §18:

- The four legal pages linked in the footer (`/terms`, `/privacy`, `/giveaway-rules`,
  `/responsible`) are **404 right now**. They are required at launch.
- No geo-blocking exists. Washington and Idaho prohibit sweepstakes casinos today.
- There is no auth: every visitor is the same mock signed-in viewer, and the games run on
  one shared in-memory balance. Fine behind `SITE_PASSWORD`, not fine in public.
- The Razed key has been pasted into a chat and must be rotated before it is used.

A private preview deploy — `SITE_PASSWORD` + `ADMIN_PASSWORD` set, indexing off — is safe
today and is the recommended first step.

---

## What is real and what is mock

This matters more than anything else in the repo, so it is first.

**Real, and written to survive the backend landing:**

- **The fairness engine** (`lib/fairness.ts`). Commit–reveal over HMAC-SHA256. The server commits to
  a seed by publishing its hash, the player sets a client seed, a nonce increments per round, and
  the outcome derives from those three values and nothing else. Rotating reveals the old seed.
- **The public verifier** (`/verify`, `app/api/verify/route.ts`). Recomputes any round from the three
  values, signed in or not, on anyone's round. It shares the engine with the games, so the two can
  never drift apart.
- **Server-authoritative play** (`app/api/games/play/route.ts`). The browser sends "play" and never
  computes an outcome. Every request carries an idempotency key, so a double-tap is one bet. Bet
  limits, the daily wager cap and the balance are all checked server-side.
- **The game maths** (`lib/games.ts`). All forty keno paytables from `keno-paytables.json`, the wheel
  rings, and the dice and limbo formulas — all at 98% RTP, verified (see below).

**Mock, and swapped by changing one module:**

- `lib/mock.ts` is the single data file the UI Spec asks for. Every screen reads from it. When the
  database lands you change this module's exports to real queries; you do not touch the components.
- `lib/session.ts` holds game state in memory — a stand-in for `seed_pairs`, `game_rounds`,
  `coin_ledger` and `play_limits`. The *shape* of what it holds is the real shape.

**Known artifact of that split:** the nav shows the mock viewer's balance while a game screen shows
its live session balance, so they diverge once you play. In the real build both read the session.

---

## Verifying the numbers

The RTP and the fairness engine are the two things nobody should take on trust, so there is a check
that reimplements both from scratch rather than importing the library:

```bash
node scripts/check-rtp.mjs .
```

It confirms all forty keno paytables land on 98% (±0.005), all twelve wheel rings land on exactly
0.98, and — empirically over 300,000 rounds — that dice, limbo and keno return 98%, that keno always
draws ten distinct numbers in range, and that the engine is deterministic per nonce.

The commit–reveal chain has also been checked end to end in the browser: the hash published before a
round matches the SHA-256 of the seed revealed after it, and the verifier reproduces the exact draw.

---

## Layout

```
app/
  (site)/        public site — its own layout with nav, footer, mobile tab bar, age gate
  admin/         admin — its own shell, denser, never shares the public chrome
  api/           games/play, games/seed, verify
components/
  ui/            primitives: typography, controls, surfaces, marks, Countdown, CopyButton
  site/          public composites: Hero, Leaderboard, BigWinCard, ClipCard, CoinBar, ...
  games/         shared bet rail / result panel / fairness drawer, then Keno, Dice, Limbo, Wheel
  admin/         AdminShell, Table, RedemptionQueue, ClipEditor
lib/             cn, format, types, mock, fairness, games, session
data/            keno-paytables.json
```

Design tokens live in `app/globals.css` as Tailwind v4 `@theme` variables, named exactly as the UI
Spec names them (`bg`, `surface`, `line`, `ink`, `brand`, `gold`, …).

---

## Decisions carried through from the plan

These are the ones easiest to erode by accident:

- **Coins cannot be bought.** No packages, no top-ups, no payment path anywhere in the codebase.
- **Blue is the only loud colour; amber only ever means money;** never both on one element.
- **Every number in a column is mono with tabular figures.**
- **The multiplier is always derived** from bet and payout (`lib/format.ts`), never stored as typed —
  including in the admin clip editor, where it is an inset panel labelled "calculated", not a field.
- **Losing paytable tiers are rendered explicitly** ("0 – 1 hits → 0×"), never omitted.
- **Nothing embeds until it is clicked.** Clips and big wins hold a thumbnail; the player replaces it
  in place. Aspect ratio is a data field, so 9:16 reels are not letterboxed into a 16:9 box.
- **Games are hidden from the nav** until the viewer opts in behind the 18+ gate, and disappear again
  on self-exclusion.
- **The leaderboard carries its provenance** — the sync timestamp, the stale-feed banner, and the row
  explaining why you cannot find yourself on it.
- **Admin role differences are visible, not hidden** — owner-only areas are greyed and labelled.

---

## Not built, and why

- **Auth, the Kick integration, the Razed poller, the coin tick job and the Discord bot.** These are
  the worker and the database, not the interface. `/api/auth/discord` is a link with nothing behind
  it yet; the verification flow simulates the bot confirming.
- **Blackjack and baccarat** — in the lobby at 50% with a "Coming soon" chip, as the plan specifies.
- **Real media.** `public/brand/*.svg` are generated placeholders. Matty's portrait is one of them:
  drop the real photograph into `public/brand/` and point `portraitUrl` in `lib/mock.ts` at it — that
  is the only line that needs to change.
- **The legal pages** (`/terms`, `/privacy`, `/giveaway-rules`, `/responsible`) are linked from the
  footer but not written. They need a lawyer, not a developer — see Master Plan §12.

The About copy on the home page is built from Matty's own description of himself and is worth him
reading before launch.
