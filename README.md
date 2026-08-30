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

### 1. Add a Postgres service

In the Railway project: **New → Database → Postgres**. Railway sets `DATABASE_URL` on the
service once you reference it. Nothing else is needed — the schema creates itself on the
first request that touches the database, and re-running is a no-op.

The site boots without a database. Reads come back empty, writes refuse with a message
saying what to set, and every screen says so rather than showing invented numbers. A deploy
that goes up before Postgres is attached is not broken, just empty.

### 2. Environment variables

**Required for the site to function:**

| Variable | Value | What breaks without it |
|---|---|---|
| `DATABASE_URL` | from the Postgres service | Coins, clips, accounts and Kick links do not persist. |
| `AUTH_SECRET` | any long random string | Sign-in fails. |
| `AUTH_URL` | `https://your-domain.up.railway.app` | OAuth redirects back to the wrong host. |
| `DISCORD_CLIENT_ID` | Discord Developer Portal, your app | Sign-in fails. |
| `DISCORD_CLIENT_SECRET` | same place | Sign-in fails. |
| `OWNER_DISCORD_IDS` | your numeric Discord id, comma-separated for several | `/admin` refuses everybody. |

In the Discord Developer Portal, add `https://your-domain.up.railway.app/api/auth/callback/discord`
as a redirect URI. It has to match exactly.

**Required before coins can be earned:**

| Variable | Value | What breaks without it |
|---|---|---|
| `RAZED_REFERRAL_KEY` | the referral key from Razed | Leaderboards show "no board to show yet". |
| `CRON_SECRET` | any long random string | `/api/kick/tick` stays closed, so no coins are ever awarded. |
| `KICK_WEBHOOK_PUBLIC_KEY` | Kick's webhook public key | Falls back to fetching it from Kick. Set it to pin the key. |

**Optional:**

| Variable | Value | Effect |
|---|---|---|
| `MOD_DISCORD_IDS` | comma-separated Discord ids | Moderator access to `/admin`. Owners get everything; mods are capped. |
| `SITE_PASSWORD` | something long | Puts the whole site behind a password (username `matty`). Unset to go public. |
| `WELCOME_COINS` | e.g. `500` | Starting balance for a new account. Off by default — every coin it mints is one nobody watched for. |
| `ALLOW_INDEXING` | `true` | Only once the legal review has landed. Defaults to `noindex, nofollow`. |

### 3. Kick webhooks

In Kick's developer settings, point the webhook at:

```
https://your-domain.up.railway.app/api/kick/webhook
```

Subscribe to `chat.message.sent`, `livestream.status.updated`, `channel.subscription.new`,
`channel.subscription.renewal`, `channel.subscription.gifts` and `moderation.banned`.
Scopes: `events:subscribe`, `chat:write`, `channel:read`, `user:read`.

Every delivery is signature-checked before anything is read from it. An unsigned request
could carry somebody else's verification code, so one that cannot be verified is refused
outright.

### 4. The coin tick

Coins are awarded by a job that runs every three minutes while the stream is live. Point a
scheduler — Railway cron, GitHub Actions, cron-job.org, anything reliable — at:

```
POST https://your-domain.up.railway.app/api/kick/tick
Authorization: Bearer YOUR_CRON_SECRET
```

Calling it more often than every three minutes is harmless; the endpoint refuses anything
early. Missing a call costs a viewer 1 MC and breaks their hour streak, so pick a scheduler
that is boring rather than clever.

> The Master Plan puts this in a separate worker so a web deploy never drops ticks, and that
> is still the right destination. Every rule — the streak, the hourly ceiling, the ban
> freeze — lives in `lib/store/presence.ts`, which a worker can lift wholesale.

### 5. Before it goes public

- **Rotate the Razed key.** It has been pasted into a chat.
- **The legal pages exist but are unreviewed.** `lib/legal.ts` has `LEGAL_REVIEWED = false`,
  which shows a draft banner on all four. A lawyer flips it.
- **No geo-blocking exists.** Washington and Idaho prohibit sweepstakes casinos today.
- **The Kick and Razed field mappings are unverified** — see below.

---

## How coins are earned

One person = one Discord account = one Kick account, unique in both directions and enforced
by the database rather than by application code.

1. Sign in with Discord. That creates the account row.
2. On `/me`, press **Generate my code**. The server issues `MS-XXXX`, stores it, and shows
   it. Ten minutes, single use.
3. Type it in Matty's Kick chat. The `chat.message.sent` webhook arrives carrying the code
   and the sender's numeric Kick user id, and the link is written.
4. The page updates on its own — it polls while it waits.

**Only a verified link earns.** A presence window can only be opened against a `kick_links`
row, so an unverified account cannot accrue a single coin whatever it does in chat.

After that, every chat message opens a 15-minute presence window, and each three-minute tick
pays 1 MC × your multiplier to everybody with an open one. Twenty consecutive ticks pays a
+10 bonus. The ceiling is 30/hour × multiplier, which at 1.5 hours a day only ever catches an
exploit. A chat ban freezes accrual; coins already held are kept.

---

## What is real and what is not

**Persisted in Postgres** (`db/migrations/001_init.sql`, read and written through `lib/store/*`):

- **Accounts** — created on first sign-in, keyed on the numeric Discord id, never the username.
- **Kick links and verification codes** — both uniques enforced at the database level.
- **The coin ledger** — append-only, with `coin_balances` as a cache written inside the same
  transaction. Nothing outside `lib/store/coins.ts` may write a balance. Losing this table
  means every balance on the site is a guess, so it is the one that needs backups.
- **Seed pairs and game rounds** — one live pair per player, one round per nonce, both by
  unique index. A round is one transaction: lock the pair, draw, insert, move coins.
- **Clips and big wins** — written from the admin clip editor, published before they appear.
- **Presence windows, stream sessions and the audit log.**

**Live from an API:** the leaderboards, straight from Razed on each request (`lib/razed.ts`).

**Still mock** (`lib/mock.ts`, and each screen says so):

- The stream state and schedule — the live badge is not yet driven by Kick.
- Razed's period definitions and prize tiers.
- The shop catalogue and giveaways — neither has a table yet, so nothing can be redeemed or
  entered. That is the next piece of work.

**Unverified against the real service, and marked as such in the code:**

- `lib/razed.ts` — the response field names are a tolerant guess. One real call confirms them,
  along with whether `to` is inclusive and whether `top` accepts more than 25.
- `lib/kick.ts` — the signature construction and the payload field names follow Kick's
  published docs but have not seen a real delivery.

Both fail loudly rather than silently: a shape they cannot read is logged and reported, never
treated as "no data".

---

## Verifying the numbers

The RTP and the fairness engine are the two things nobody should take on trust, so there is a check
that reimplements both from scratch rather than importing the library:

```bash
node scripts/check-rtp.mjs .
```

It confirms all forty keno paytables land on 99% (±0.005) and — empirically over 300,000 rounds —
that dice, limbo and keno return 99%, that keno always draws ten distinct numbers in range, and that
the engine is deterministic per nonce.

The commit–reveal chain has also been checked end to end in the browser: the hash published before a
round matches the SHA-256 of the seed revealed after it, and the verifier reproduces the exact draw.

---

## Layout

```
app/
  (site)/        public site — its own layout with nav, footer, mobile tab bar, age gate
  admin/         admin — its own shell, denser, never shares the public chrome
  api/           games/play, games/seed, verify, kick/webhook, kick/verify, kick/tick
components/
  ui/            primitives: typography, controls, surfaces, marks, Countdown, CopyButton
  site/          public composites: Hero, Leaderboard, BigWinCard, ClipCard, CoinBar, ...
  games/         shared bet rail / result panel / fairness drawer, then Keno, Dice, Limbo
  admin/         AdminShell, Table, ClipEditor, MemberActions
lib/             cn, format, types, mock, fairness, games, db, razed, kick, viewer, player
  store/         accounts, coins, play, presence, clips — every database read and write
db/migrations/   numbered SQL, applied once on first use
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

- **The Discord bot.** The clip editor's "Announce in Discord" switch is disabled, because there is
  nothing behind it. Kick's side of the bot — the chat reply confirming a link, and the drop codes
  that let quiet viewers earn — also needs `chat:write` and a service that holds it.
- **The shop and giveaways.** Both screens render from `lib/mock.ts` and neither has a table, so
  nothing can be redeemed or entered. This is the next piece of work: it is what makes the coins
  people are now earning worth having.
- **Prize claims and leaderboard snapshots.** A claim has no row to go in, and movement arrows need
  two stored snapshots to compare.
- **A live stream badge.** `livestream.status.updated` opens and closes a stream session in the
  database, but the badge still reads `lib/mock.ts`.
- **Blackjack and baccarat** — in the lobby with a "Coming soon" label, as the plan specifies.
- **Geo-blocking**, which the legal review will define the shape of.

The About copy on the home page is built from Matty's own description of himself and is worth him
reading before launch.
