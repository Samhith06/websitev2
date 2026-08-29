# MattySpins — Master Plan

Everything decided so far, in one place, so the build can start from this file alone.

**What it is:** a community website for MattySpins, a Kick casino streamer. Viewers sign in with Discord, link their Kick account, earn Matty Coins by watching, and spend them in a shop, on giveaway entries and in four provably-fair games. Wager leaderboards come straight from Razed. A clips hub and a wall of big wins carry the personality.

**Operator:** Matty personally. **Casino partner:** Razed. **Launch:** one release with everything, games included.

---

## 1. Decisions already made

Recorded with the reasoning, so nobody re-litigates them in month two.

| Decision | What was chosen | Why |
|---|---|---|
| Currency name | **Matty Coins**, written **MC**, gold coin mark with an M | "Points" appears nowhere in the interface |
| Coins purchasable? | **Never.** No packages, no top-ups, no payment path | This single fact keeps the games promotional rather than licensed gambling |
| Leaderboard data | Razed's feed only. No viewer self-linking, no "your position" row | Razed returns a top-N list, so any claim from outside it is unverifiable — and unverifiable claims attached to prize money are fraud waiting to happen |
| Prize claiming | Winner claims through the site; a mod verifies against the frozen snapshot | Replaces account linking |
| Shop | Coins only, no cash checkout | No payment processor, no tax, no shipping regulation |
| Games currency | The same Matty Coins used in the shop | Chosen over a separate non-redeemable chip. Needs legal sign-off — see §12 |
| Games visibility | Opt-in. Hidden from the nav until a viewer enables them behind an 18+ confirmation | Anyone who wants nothing to do with them never sees them |
| Launch games | Keno, Wheel, Dice, Limbo. Blackjack and Baccarat later | One engine, four skins. Blackjack is several times the work and the one where a rules bug reads as rigging |
| Game RTP | **98%** | Deliberately thin edge, generous by any comparison |
| Sub multiplier | Flat **2×** for every tier | One sentence in chat, one number in the code |
| VIP multiplier | **2.5×** | Just above subs. Rare and given, never requested |
| Stacking | **Never.** Highest single multiplier applies | A VIP who also subs earns 2.5×, not 5× |
| Theme | Dark navy with the logo's blue as the only loud accent; amber reserved for money | Taken from the M$ logo |
| Clip auto-sync | YouTube and Instagram automatic; Kick and X manual | Kick has no public clips endpoint |
| Timeline | Single launch, everything at once (~10–12 weeks) | Chosen over shipping the public site first |

---

## 2. Site map

**Public**

| Route | Page | Contents |
|---|---|---|
| `/` | Home — live | Kick player, earning strip, stat strip, weekly podium, how coins work, clips, big wins, About Matty, Razed strip |
| `/` | Home — offline | Next-stream countdown, last VOD, schedule, coins-paused notice, "while you wait" row. Board still runs |
| `/leaderboard` | Leaderboards | Weekly / monthly / archive, stepped podium, ranks 4–10, provenance row, rules |
| `/leaderboard/claim` | Prize claim | Pick position → state Razed username → mod verifies |
| `/shop` | Coin shop | Balance bar, category chips, item grid |
| `/giveaways` | Giveaways | Active draws, entries, provable fairness block, past winners |
| `/games` | Games lobby | Opt-in gated. Balance, daily limit, four game cards, biggest hits, fairness |
| `/games/keno` etc. | The games | Keno, Wheel, Dice, Limbo |
| `/verify` | Fairness verifier | Public. Recomputes any round from seed pair + nonce |
| `/clips` | Clips | Filter chips, click-to-play grid |
| `/wins` | Wall of fame | Sortable big wins, all-time record cards |
| `/casinos` | Razed hub | Offer, referral code, three-step how-to |
| `/me` | My account | Kick verification, coin balance + ledger, redemptions, limits, self-exclusion |
| `/official` | Official accounts | The four real handles, anti-impersonation |

**Admin** — overview, Razed players, members & coins, redemptions, giveaways, shop items, prizes & periods, clips, games config, audit log.

---

## 3. The Matty Coin economy

Matty streams **1.5 hours a day**. That fixes everything.

**Per session:** 30 ticks (90 min ÷ 3) + 10 for the one completed continuous hour = **40 MC base**. Averages 26.7 MC/hr, under the 30/hr ceiling — so the cap only ever catches an exploit.

| Tier | Multiplier | Per stream | Per week (daily) | Per month (5 days/wk) |
|---|---|---|---|---|
| Regular | 1× | 40 | 280 | 860 |
| Sub (any tier) | 2× | 80 | 560 | 1,715 |
| VIP | 2.5× | 100 | 700 | 2,145 |

The five-day column is the planning number — nobody catches every stream.

**Launch prices**

| Item | Price | Regular, 5 days/wk |
|---|---|---|
| Weekly giveaway entry | 50 MC | 4 a week |
| Monthly draw entry | 150 MC | Just over one a week |
| Custom chat colour, 14 days | 200 MC | 1 week |
| Shoutout on stream | 350 MC | Under 2 weeks |
| High Roller role, 30 days | 500 MC | 2.5 weeks |
| Pick the next slot | 750 MC | Under 4 weeks |
| Signed card deck | 1,000 MC | 5 weeks |
| MattySpins hoodie | 1,250 MC | 6 weeks |

To make the hoodie "about a month", drop it to 1,000 MC and shift everything below down by a fifth. That is the one number to move — the rest are ratios off it.

**Rules:** coins expire after 90 days of inactivity (state it in the terms at launch). Earning is frozen while a viewer is banned in Kick chat. Winnings from games get a short hold before they can be spent in the shop, which kills the hit-big-cash-out-vanish pattern.

**Watch the flow.** Admin shows coins minted by watching against coins destroyed by the house edge, weekly. At 98% RTP the games are close to neutral, not a real sink. If coins inflate, pull the daily wager cap or nudge shop prices — **never cut the advertised RTP.**

---

## 4. Identity and Kick verification

One person = one Discord account = one Kick account, unique in both directions.

1. Sign in with Discord (`identify` + `guilds`; require membership of Matty's server).
2. Site generates a six-character code, e.g. `MS-7K2Q`, 10-minute expiry, single use.
3. Viewer types it in Kick chat while Matty is live.
4. The `chat.message.sent` webhook delivers it with the sender's Kick user id, username and badges. Link written, bot replies in chat, the page live-updates without a refresh.

**Key off the numeric Kick user id, never the username** — usernames change, ids don't. Refresh the username on every webhook.

There is deliberately **no casino account linking.**

---

## 5. Kick integration — and its one hard limit

**Kick's public API does not expose who is watching.** No viewer roster, no join/leave event; the livestream endpoint returns an aggregate count only. The only per-user live signal is `chat.message.sent`. Presence has to be inferred.

**Presence model — activity windows**

| Element | Rule |
|---|---|
| Tick | Every 3 minutes while live (`livestream.status.updated` gates it) |
| Award | 1 MC per tick to every user with an open presence window, × their multiplier |
| Presence window | Opened for 15 minutes by any Kick chat message; re-opened by each new one |
| Hour bonus | 20 consecutive ticks with no gap → +10, × multiplier. Resets on a missed tick |
| Hourly ceiling | 30 × multiplier |
| Offline | No ticks. All windows close |

**Drop codes:** the bot posts a random claim word every ~20 minutes while live. Anyone who types it opens a window. This is how quiet viewers earn without spamming, and it proves they are actually watching.

**On-site player heartbeat** is a phase-two addition — watching in the embedded player opens a window too, gated on tab visibility and an hourly "still there?" prompt.

**Scopes:** `events:subscribe`, `chat:write`, `channel:read`, `user:read`.
**Webhooks:** `chat.message.sent`, `livestream.status.updated`, `channel.subscription.new` / `.renewal` / `.gifts`, `moderation.banned`.
Verify the signature on every webhook, respond 200 fast and process on a queue, de-duplicate on message id.

**Sub state** comes from both the badges on chat payloads (instant) and the subscription webhooks (authoritative). Store `sub_active_until` and `is_vip`; a lapse or a grant takes effect on the next tick.

**Abuse, in the order it will happen**

| Attack | Defence |
|---|---|
| Idle tab | Chat presence already needs a human action every 15 min; drop codes make it every 20 |
| Chat macro | Randomised drop codes can't be scripted. Flag near-identical, evenly-spaced messages and shadow-freeze for review |
| Alt accounts | One Kick id per Discord id at the database level. Discord account age > 30 days, server membership required. Log IP hashes and flag clusters — never auto-ban on IP |
| Chat-banned users still earning | `moderation.banned` freezes accrual for the ban duration |

---

## 6. Razed integration

```
GET https://api.razed.com/player/api/v1/referrals/leaderboard
Header: X-Referral-Key: <secret — env var only>
Params: referral_code=Mattyspins, from=YYYY-MM-DD, to=YYYY-MM-DD, top=25
```

Weekly and monthly boards are the same call with different `from`/`to`.

**Treat the key as a password.** Server-side environment variable, never the frontend bundle, never a repo. It has been pasted into a chat, so it must be rotated before launch. Every call to Razed happens from the server; the browser only ever talks to your own API.

**Three things to confirm with one real call:** exact field names; whether `to` is inclusive and what timezone the boundaries use; and whether `top` accepts more than 25. That last one matters — 25 is a top-N board, not a per-player lookup.

**Ingest:** poll every 10 minutes → store a full snapshot with a timestamp → compute the display board (rank, masked username, movement arrows, prize) → freeze at period end → "pending verification" for 72 hours → finalise → claims open.

**Details that cause arguments:** pick one timezone and put it on the page; state the tie rule (earliest to reach the amount); state the minimum wager to qualify; keep the archive forever.

**If the poller fails,** the board says "last updated 4 hours ago" in a visible gold banner. Silent staleness during a close finish is how you get accused of rigging.

---

## 7. Prizes

Prize tiers are **data Matty edits**, per period, from admin: rank or rank range, amount, currency. A range tier ("4–10 → $400 each") is a first-class row so he isn't typing seven identical lines.

Editing defaults to the **next** period. Editing a live period is allowed but logged, and the public board shows a "prizes updated" note with a timestamp. Finalised periods lock.

**Claim flow:** frozen board → viewer picks their position → states their full Razed username → mod verifies against the snapshot → payout recorded (who, how much, method, paid-at, by whom). Unclaimed after 14 days rolls into the next pot. A second claimant on the same position is a flag for a mod, not a race.

---

## 8. Coin shop and giveaways

**Shop.** Item types: giveaway entries (automatic), Discord roles (automatic via bot), slot calls and shoutouts (manual queue), merch (manual, with size/address capture), and anything casino-side only if Razed's terms allow it. Per-item stock, per-user cooldowns, minimum account age. Redemption state machine: pending → approved → fulfilled, or rejected with automatic coin refund. Out-of-stock items stay visible with the price shown.

**Giveaways.** Coins buy entries; entries are rows; the draw is a scheduled job.
- **Provable draws:** publish a SHA-256 hash of the server seed before opening; reveal the seed at draw time; the winning index derives from `HMAC(seed, giveaway_id)` over the final entry count. Anyone can verify.
- Entry caps per user so it isn't just whoever has the biggest balance.
- Winner page with date, prize, masked winner and the seed. Never deleted.
- 7-day claim window, then redraw. Stated in the rules.

---

## 9. Games

Four at launch, one engine. **Opt-in and hidden** until enabled behind an 18+ confirmation.

| Game | The round | Build |
|---|---|---|
| Keno | Pick up to 10 of 40; server draws 10; paytable pays on hits. Four risk levels | 2–3 days. The grid, risk selector and paytables are the work |
| Wheel | Risk level + segment count; one spin, one multiplier | A day |
| Dice | Slide a target, roll over or under; payout follows the chance | Half a day |
| Limbo | Name a target multiplier; beat it or don't | Half a day |
| Blackjack / Baccarat | Later, after fairness has run in public for a month | Several times the others combined |

**Keno risk levels: Classic, Low, Medium, High.** They change the paytable, nothing else. Classic pays on the most hit counts with the lowest ceiling; High pays on the fewest with the highest. All forty tables (four levels × 1–10 picks) are solved to 98% and live in `keno-paytables.json`.

Classic, six picks: `0–1 → 0× · 2 → 1.3× · 3 → 2.94× · 4 → 6.63× · 5 → 14.97× · 6 → 33.78×`
High, six picks: nothing below five hits, then 482× and 547×.

**Two interface rules.** Switching risk redraws the paytable immediately. Losing tiers are shown explicitly as "0 – 1 hits → 0×", never omitted — on High a player can hit five of six and win nothing, and learning that after the round is what makes a fair game feel rigged.

**The fairness engine, built first.** Commit–reveal: publish a hash of the server seed, the player sets their own client seed, a nonce increments per round, the outcome derives deterministically from the three. Every round stores bet, outcome, payout, seed hash, client seed and nonce. Rotating the seed reveals the old one so every round on it can be recomputed. The public verifier page takes the three values and reproduces the result. **The same machinery serves the giveaway draws — build it once.**

**Non-negotiables.** Server-authoritative always: the browser sends "spin", never computes an outcome. One transaction per round — debit, resolve, credit, ledger row, all or nothing. Idempotency keys on every play request, or a double-tap becomes two bets. Rate limits and no autoplay.

**Limits.** Min bet 10 MC, max bet 100 MC, max win per round 20,000 MC. Default daily wager cap 200 MC, raisable to 1,000 by the viewer. A top-tier multiplier above 200× only pays in full below the maximum bet — say so on the paytable.

**Responsible play, not optional.** Viewer-set daily wager limit (decreases apply immediately, increases take 24 hours). Session reminders after an hour with time played and net position in plain numbers. Self-exclusion for a day, week, month or permanently — one switch that hides the games and blocks every play endpoint server-side while the rest of the site keeps working. All enforced on the server, never by hiding a button.

---

## 10. Clips, big wins, and the rest of the content

**Auto-sync, honestly, per platform**

| Platform | Automatic? | How |
|---|---|---|
| YouTube `@MattySpinss` | **Yes** | Data API v3 uploads playlist, or WebSub push. Free, no approval |
| Instagram `@mattyspinss` | **Yes, with setup** | Instagram API with Instagram Login, `instagram_business_basic`. Needs a professional account, a Meta app and app review. No Facebook Page required |
| Kick `/mattyspinss` | **No** | No clips endpoint in the public API. Paste a URL in admin |
| X `@mattyspinsslots` | Manual | Reading a timeline needs a paid tier |

Auto-pulled posts land as **drafts** — Matty publishes the good ones. Everything appearing automatically fills the carousel with filler inside a week.

**Big wins are playable videos with their numbers attached.** 30 seconds to 2 minutes. Bet, win and multiplier as three separate figures under the player; slot and date beneath. The multiplier is always calculated, never typed. Clicking plays in place — no lightbox, no navigation. **Aspect ratio is a data field** — Kick and YouTube are 16:9, Instagram reels are 9:16; letterboxing every reel is the classic way this gets built wrong.

For a raw mp4: put Cloudflare Stream or Bunny behind the admin rather than serving video off the app server. Same form as paste-a-URL. Fallback with zero infrastructure: unlisted YouTube.

**Never autoplay embeds.** Thumbnails only until clicked. This one decision is most of the site's mobile performance.

**About Matty** — portrait, 120–150 words in his voice, the schedule, and the four socials: `kick.com/mattyspinss`, `@MattySpinss` (YouTube), `@mattyspinss` (Instagram), `@mattyspinsslots` (X).

**Official accounts page** — the four real handles plus the Discord invite, and one line in ink: **Matty will never DM you first and will never ask you to deposit.** Impersonation DMs are the standard scam in this niche, and a legitimate-looking site makes them more convincing.

---

## 11. Admin

Two roles. **Owner (Matty):** everything, including prize tables, casino config, games config and admin management. **Mods:** redemptions, giveaways, clips, user lookup, freezing an account — with owner-only areas greyed and labelled rather than hidden. Every destructive action writes an audit row naming the admin.

Screens: overview (today's numbers, queue length, feed health, last ten audit entries — resist adding charts), **Razed players** (the feed as a working table with unmasked names and an optional mod-assigned match to a member), members & coins (lookup, ledger, adjustment with a mandatory reason, freeze/unfreeze), **redemption queue** (built to work on a phone between bonus buys), clip & big-win editor, prizes & periods, giveaways, **games config** (per-game enable, RTP, paytable, limits, a live round feed with anomaly filters, the coins-minted-vs-destroyed panel, and an owner-only kill switch that disables every game without a deploy), audit log.

---

## 12. Legal and compliance

Not legal advice. These are the items that get affiliate sites shut down.

- **A lawyer, engaged in week one.** The games change the site's regulatory shape, and the review plus the geo-block list must land before anything goes public. Washington and Idaho prohibit sweepstakes casinos today, several states have bills moving, and there have been AG actions in Michigan and Pennsylvania.
- **Coins can never be bought.** No packages, no top-ups, no payment path. This is the line that keeps the site promotional rather than licensed, and it must hold permanently.
- **Matty is the operator personally.** His name on the terms, the giveaway rules and the prize records; the liability is personal. Terms need a real contact address. Worth asking counsel whether a company is warranted before launch — moving the operator later means re-issuing every set of rules.
- **Age gate** (18+ or 21+) on first visit, plus a persistent footer notice.
- **Responsible gambling** links and a "play responsibly" line, with a helpline appropriate to the main audience.
- **Affiliate disclosure** stated plainly.
- **Coins are not money** — no cash value, non-transferable, expire on account closure, revocable for abuse.
- **Giveaway rules** — eligibility, age, excluded territories, claim window, and that the operator is Matty rather than Razed.
- **Privacy policy** and a delete-my-account path. You store Discord ids, Kick ids and claimed Razed usernames.
- **Razed's own terms** — check whether displaying other players' usernames is permitted even masked, and what caching they require.

---

## 13. Data model

| Table | Key columns |
|---|---|
| users | id, discord_id (uniq), discord_username, avatar_url, role, status, created_at, last_seen_at |
| kick_links | user_id (uniq), kick_user_id (uniq), kick_username, verified_at |
| verification_codes | code (uniq), user_id, expires_at, consumed_at |
| sub_state | user_id, sub_active_until, is_vip, source, updated_at |
| presence_windows | user_id, opened_at, expires_at, source (chat / drop / heartbeat) |
| coin_ledger | id, user_id, delta, reason, ref_type, ref_id, multiplier, created_at — **append only** |
| coin_balances | user_id, balance, lifetime_earned, updated_at |
| stream_sessions | id, started_at, ended_at, tick_count |
| casinos | id, name (Razed), slug, referral_code, affiliate_url, api_base, active — key lives in env |
| lb_periods | id, casino_id, type, starts_at, ends_at, status, locked_at |
| prize_tiers | period_id, rank_from, rank_to, amount, currency, updated_by, updated_at |
| lb_snapshots | period_id, fetched_at, payload (jsonb) |
| lb_results | period_id, rank, razed_username, masked_username, wagered, prize, final |
| prize_claims | id, period_id, rank, user_id, claimed_username, status, verified_by, paid_at, method, note |
| shop_items | id, name, description, cost, stock, cooldown_days, type, active |
| redemptions | id, user_id, item_id, cost, status, fulfilment_data, handled_by, created_at |
| giveaways | id, title, prize, entry_cost, max_entries, opens_at, draws_at, server_seed_hash, server_seed, winner_entry_id |
| giveaway_entries | id, giveaway_id, user_id, count, created_at |
| game_configs | id, slug, enabled, rtp, paytable (jsonb), min_bet, max_bet, max_win, updated_by |
| seed_pairs | id, user_id, server_seed, server_seed_hash, client_seed, nonce, revealed_at |
| game_rounds | id, user_id, game, seed_pair_id, nonce, bet, outcome (jsonb), multiplier, payout, created_at |
| play_limits | user_id, games_enabled, daily_wager_cap, cap_effective_at, excluded_until, updated_at |
| clips | id, kind (clip / big_win), source, url, thumb_url, title, status, slot_name, bet_amount, payout_amount, multiplier, aspect, occurred_at, pinned, sort_order, added_by |
| audit_log | id, admin_id, action, target, before, after, created_at |

**The ledger is the crown jewel.** Append-only, balance derived and cached in the same transaction. Nightly automated backups with a tested restore — losing it means every balance on the site is a guess.

---

## 14. Stack

| Layer | Choice |
|---|---|
| Frontend + API | Next.js App Router, TypeScript, Tailwind |
| Auth | Auth.js with the Discord provider, database sessions so accounts can be revoked |
| Database | Postgres (Neon or Supabase) with Drizzle or Prisma |
| Cache / locks | Redis (Upstash) — rate limits, heartbeats, and a lock so the 3-minute tick can never double-award |
| Bot / worker | A small Node service on Railway or Fly, separate from the web app so a deploy never drops ticks. Handles Kick webhooks, drop codes, chat replies, the tick job and the Razed poller |
| Video | Cloudflare Stream or Bunny |
| Media | Cloudflare R2 or S3 for thumbnails and images |
| Hosting | Vercel + Cloudflare DNS |
| Ops | Sentry, a Discord alert webhook, Umami or Plausible |

---

## 15. Design system

Single dark theme, deliberately — this sits beside a dark player.

**Colour.** Ground `#070B14`, surfaces `#0D1422` / `#111A2B`, borders `#1B2740` (`#29354D` for anything clickable). Text `#E8EDF5` / `#A9B6C9` / `#8C99AD` / `#6B7891`. Accent `#2B8FFF` from the logo, with `#04121F` for text on it. Money is amber `#FFB93B`. Silver `#C6CFDD` and bronze `#B07A4E` for ranks. Danger `#FF8A6B`, live-tag red `#E5352B`.

Four rules that keep it coherent: blue is the only loud colour; amber means money and nothing else; never both on one element; borders are always the border token.

**Type.** Anton for display (uppercase only), Barlow for body, JetBrains Mono for every number. **Every number in a column is mono with tabular figures** — money, coins, wagered totals, multipliers, countdowns.

**Layout.** 1440px container, 56px gutters desktop / 18px mobile, 72px between sections, 12-column grid at 40px, cards at 20px. Two breakpoints: below 768 mobile, 1024+ desktop. Hairline dividers via a 1px-gap grid over a border-coloured background.

**Radii** are tight — 3px cards and buttons, 2px chips, circles only for avatars and status dots.

**Razed's marks:** the wordmark where the partnership is sold, always on its own dark plate; the Z mark inline at 15–18px beside labels that say where data came from. Razed's blue is close to ours, which is why the wordmark needs that plate.

**Motion.** Four things move: the live dot pulses, buttons transition colour at 150ms, cards brighten their border on hover, the play button scales slightly. All disabled under reduced-motion.

---

## 16. Build order

Fairness engine and identity first; the pretty parts last.

1. **Foundation** — project, tokens, fonts, primitives (Label, Button, Chip, Card, Stat, Input), Nav, Footer, live badge, mobile shell
2. **Public shell on mock data** — home live and offline, About, clips, Razed hub, official accounts, age gate, terms
3. **Leaderboards** — Razed poller, snapshots, stepped podium, rows, archive, stale-feed banner, alerting
4. **Accounts** — Discord login, Kick verification, `/me`
5. **Coin engine** — tick job, ledger, presence windows, drop codes, multipliers, caps, ban sync
6. **Admin core** — shell, Razed players, member lookup, adjustments, audit log
7. **Shop** — items, redemption state machine, admin queue
8. **Giveaways** — entries, provable draws, winner archive
9. **Fairness engine** — commit–reveal, verifier page (shared with giveaways)
10. **Games** — keno, then dice and limbo, then wheel; opt-in gate and limits before the second game ships
11. **Games admin** — config, kill switch, round feed, coin flow panel
12. **Prize claims and payouts**
13. **Clip sync** — YouTube, then Instagram
14. **States pass** — skeletons, empty, stale, error, signed-out, offline
15. **Mobile pass** — density, tap targets, table collapse
16. **Hardening** — rate limits, anti-alt, backups, load check

Steps 2–8 run on one mock-data file. When the backend lands you change the data source, not the components.

---

## 17. Second wave — after launch

Discord notifications (giveaway wins, redemption decisions, board resets, go-live) — the biggest single retention lever and the plumbing already exists. Link preview cards for when the URL is pasted into chat. A "my coins are wrong" form feeding the admin queue. Outbound click tracking on the Razed links. On-site player heartbeat. Bonus-hunt tracker. Viewer profile pages.

---

## 18. Open items

**Blocking:** Kick developer app authorised on the channel; Razed key rotated and one real JSON response captured; a lawyer engaged; the domain bought.

**Needed from Matty:** portrait, About Me copy, logo source file, 10–12 clip URLs, 3 big wins with slot/bet/payout/date, exact schedule and timezone, prize tables for week one, how prizes get paid, real merch stock, month-one giveaway plan, VIP policy, age gate choice, contact address for the terms, helpline to list, Discord server + mod account ids, Instagram converted to a Creator account, YouTube channel id, a test Kick account.

Full detail in `what-we-need-from-matty.md`.

---

## 19. Files in this folder

| File | What it is |
|---|---|
| `MattySpins-Master-Plan.md` | This document |
| `MattySpins-UI-Spec.md` | Every screen and component, written as build instructions |
| `keno-paytables.md` | All forty paytables, readable |
| `keno-paytables.json` | The same tables as config |
| `what-we-need-from-matty.md` | The checklist, with a paste-ready summary |
| `brand/matty-coin.svg` | The coin, full detail |
| `brand/matty-coin-flat.svg` | 24px inline version |
| `brand/matty-coin-mono.svg` | Single-colour outline |
| `brand/matty-coin-512.png` | Raster fallback |

The visual mockup lives as a published artifact — fourteen screens across two pages, web and mobile.
