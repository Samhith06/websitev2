-- MattySpins — initial schema (Master Plan §13).
--
-- Scoped to what is actually wired up: accounts, Kick verification, presence,
-- the coin ledger, game rounds and clips. Shop, giveaways, prize claims and
-- leaderboard snapshots are not here yet; those screens read from Razed or show
-- an empty state, and a table nothing writes to is worse than no table.
--
-- The ledger is append-only. `coin_balances` is a cache maintained inside the
-- same transaction as the ledger row and is never written from anywhere else.

/* -------------------------------------------------------------------------- */
/* Accounts                                                                   */
/* -------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS users (
  id                bigserial PRIMARY KEY,
  discord_id        text        NOT NULL UNIQUE,
  discord_username  text        NOT NULL,
  avatar_url        text,
  -- 'active' | 'frozen'. Frozen accounts keep their coins and stop earning.
  status            text        NOT NULL DEFAULT 'active',
  frozen_reason     text,
  frozen_until      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  last_seen_at      timestamptz NOT NULL DEFAULT now()
);

/*
 * One person = one Discord account = one Kick account, unique in both
 * directions (§4). Both uniques are enforced here rather than in application
 * code, because this is the constraint alt accounts attack first.
 *
 * Keyed on the numeric Kick user id, never the username — usernames change.
 */
CREATE TABLE IF NOT EXISTS kick_links (
  user_id       bigint      PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  kick_user_id  text        NOT NULL UNIQUE,
  kick_username text        NOT NULL,
  verified_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification_codes (
  code        text        PRIMARY KEY,
  user_id     bigint      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS verification_codes_user_idx
  ON verification_codes (user_id, created_at DESC);

/* Sub and VIP state. Badges on a chat payload are instant, the subscription
   webhooks are authoritative; `source` records which one wrote the row. */
CREATE TABLE IF NOT EXISTS sub_state (
  user_id          bigint      PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sub_active_until timestamptz,
  is_vip           boolean     NOT NULL DEFAULT false,
  source           text        NOT NULL DEFAULT 'badge',
  updated_at       timestamptz NOT NULL DEFAULT now()
);

/* -------------------------------------------------------------------------- */
/* Presence and the stream                                                    */
/* -------------------------------------------------------------------------- */

/*
 * Kick's API cannot tell us who is watching — there is no viewer roster and no
 * join/leave event (§5). Presence is inferred from chat: any message opens a
 * 15-minute window, and a tick only pays users with an open one.
 */
CREATE TABLE IF NOT EXISTS presence_windows (
  user_id    bigint      PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  opened_at  timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  source     text        NOT NULL DEFAULT 'chat',
  -- Consecutive ticks, for the full-hour bonus. Resets on a missed tick.
  streak     integer     NOT NULL DEFAULT 0,
  last_tick_at timestamptz
);

CREATE INDEX IF NOT EXISTS presence_windows_expiry_idx ON presence_windows (expires_at);

CREATE TABLE IF NOT EXISTS stream_sessions (
  id           bigserial PRIMARY KEY,
  started_at   timestamptz NOT NULL DEFAULT now(),
  ended_at     timestamptz,
  tick_count   integer     NOT NULL DEFAULT 0,
  last_tick_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS stream_sessions_one_open_idx
  ON stream_sessions ((ended_at IS NULL)) WHERE ended_at IS NULL;

/* Webhook de-duplication. Kick retries, and a retried chat message must not
   open a second window or pay a second time. */
CREATE TABLE IF NOT EXISTS kick_events (
  message_id  text        PRIMARY KEY,
  event_type  text        NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kick_events_received_idx ON kick_events (received_at);

/* -------------------------------------------------------------------------- */
/* Coins — the crown jewel                                                    */
/* -------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS coin_ledger (
  id          bigserial   PRIMARY KEY,
  user_id     bigint      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta       integer     NOT NULL,
  -- 'watch' | 'bonus' | 'game' | 'redemption' | 'giveaway' | 'adjustment' | 'refund'
  kind        text        NOT NULL,
  reason      text        NOT NULL,
  ref_type    text,
  ref_id      text,
  multiplier  numeric(4,2),
  -- The balance immediately after this row, so history can be read back
  -- without re-summing the whole ledger.
  balance_after integer   NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coin_ledger_user_idx ON coin_ledger (user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS coin_ledger_kind_idx ON coin_ledger (kind, created_at DESC);

CREATE TABLE IF NOT EXISTS coin_balances (
  user_id         bigint      PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance         integer     NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_earned integer     NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

/* -------------------------------------------------------------------------- */
/* Games                                                                      */
/* -------------------------------------------------------------------------- */

/*
 * A seed pair is a commitment: the hash is published before any round is
 * played, and rotating reveals the old seed so every round on it can be
 * recomputed by anybody (§9). One live pair per user, enforced below.
 */
CREATE TABLE IF NOT EXISTS seed_pairs (
  id               bigserial   PRIMARY KEY,
  user_id          bigint      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  server_seed      text        NOT NULL,
  server_seed_hash text        NOT NULL,
  client_seed      text        NOT NULL,
  nonce            integer     NOT NULL DEFAULT 0,
  revealed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS seed_pairs_one_live_idx
  ON seed_pairs (user_id) WHERE revealed_at IS NULL;

CREATE TABLE IF NOT EXISTS game_rounds (
  id              bigserial   PRIMARY KEY,
  user_id         bigint      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game            text        NOT NULL,
  seed_pair_id    bigint      NOT NULL REFERENCES seed_pairs(id),
  nonce           integer     NOT NULL,
  bet             integer     NOT NULL,
  multiplier      numeric(12,2) NOT NULL,
  payout          integer     NOT NULL,
  outcome         jsonb       NOT NULL,
  idempotency_key text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

/* A double-tap is one bet. This constraint is what makes that true, rather
   than a check that races with itself. */
CREATE UNIQUE INDEX IF NOT EXISTS game_rounds_idem_idx
  ON game_rounds (user_id, idempotency_key);

/* A nonce never repeats on a seed pair — the verifier depends on it. */
CREATE UNIQUE INDEX IF NOT EXISTS game_rounds_nonce_idx
  ON game_rounds (seed_pair_id, nonce);

CREATE INDEX IF NOT EXISTS game_rounds_user_idx ON game_rounds (user_id, created_at DESC);

/* -------------------------------------------------------------------------- */
/* Clips and big wins                                                         */
/* -------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS clips (
  id               text        PRIMARY KEY,
  kind             text        NOT NULL DEFAULT 'clip',      -- 'clip' | 'big_win'
  source           text        NOT NULL,                     -- kick | youtube | instagram | x
  url              text        NOT NULL,
  embed_url        text        NOT NULL DEFAULT '',
  thumb_url        text        NOT NULL DEFAULT '',
  title            text        NOT NULL,
  aspect           text        NOT NULL DEFAULT '16:9',
  duration_seconds integer     NOT NULL DEFAULT 0,
  views            integer,
  occurred_at      timestamptz NOT NULL DEFAULT now(),
  pinned           boolean     NOT NULL DEFAULT false,
  sort_order       integer     NOT NULL DEFAULT 0,
  status           text        NOT NULL DEFAULT 'draft',     -- 'draft' | 'published'
  slot_name        text,
  bet_amount       integer,
  payout_amount    integer,
  added_by         text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clips_listing_idx
  ON clips (kind, status, pinned DESC, sort_order, occurred_at DESC);

/* -------------------------------------------------------------------------- */
/* Audit                                                                      */
/* -------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS audit_log (
  id               bigserial   PRIMARY KEY,
  admin_discord_id text,
  admin_name       text        NOT NULL DEFAULT 'system',
  action           text        NOT NULL,
  target           text        NOT NULL DEFAULT '',
  detail           jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log (created_at DESC);

/* -------------------------------------------------------------------------- */
/* Seed: the one real clip that already exists                                */
/* -------------------------------------------------------------------------- */

INSERT INTO clips (
  id, kind, source, url, embed_url, thumb_url, title,
  aspect, duration_seconds, views, occurred_at, status, added_by
) VALUES (
  'clip_01M0NBWS4MYE20NF4Z6QQW79J6',
  'clip',
  'kick',
  'https://kick.com/mattyspinss/clips/clip_01M0NBWS4MYE20NF4Z6QQW79J6',
  'https://player.kick.com/mattyspinss?clip=clip_01M0NBWS4MYE20NF4Z6QQW79J6',
  'https://clips.kick.com/clips/60/clip_01M0NBWS4MYE20NF4Z6QQW79J6/thumbnail.webp',
  '3000 Bonus Bingo! 1200 leaderboard',
  '16:9', 90, 6, now() - interval '7 days', 'published', 'seed'
)
ON CONFLICT (id) DO NOTHING;
