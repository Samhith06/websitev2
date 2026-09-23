/* -------------------------------------------------------------------------- */
/* Bonus hunts, the slot catalog, !sr requests and guess the balance          */
/* -------------------------------------------------------------------------- */

/*
 * The slot catalog.
 *
 * Filled from BonusHunt.gg's public slot feed (every game each casino added in
 * the last week, refreshed hourly) and by hand from /admin/slots. The feed
 * only ever shows what is new, so the table accumulates: a slot is never
 * removed because it dropped out of the window, which is also why a manual
 * row and a synced row can coexist without one overwriting the other.
 *
 * `key` is what de-duplicates a re-sync: the lowercased name and provider, so
 * the same game listed by six casinos is one row with six casinos on it.
 */
CREATE TABLE IF NOT EXISTS slots (
  id          bigserial   PRIMARY KEY,
  key         text        NOT NULL UNIQUE,
  name        text        NOT NULL,
  provider    text        NOT NULL DEFAULT '',
  image_url   text,
  play_url    text,
  casinos     text[]      NOT NULL DEFAULT '{}',
  bonus_buy   boolean,
  -- 'bonushunt' | 'manual'
  source      text        NOT NULL DEFAULT 'bonushunt',
  added_at    timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS slots_name_idx ON slots (lower(name));
CREATE INDEX IF NOT EXISTS slots_provider_idx ON slots (provider);
CREATE INDEX IF NOT EXISTS slots_added_idx ON slots (added_at DESC);

/*
 * A hunt.
 *
 *   collecting → opening → finished
 *
 * Only one hunt is ever unfinished, which the partial unique index enforces:
 * chat commands resolve "the hunt" without anybody saying which one, and two
 * live hunts would make that a guess.
 *
 * Guess the balance runs alongside it with its own small state machine —
 * closed → open → locked → settled — because guessing has to close before the
 * first bonus is opened, not when the hunt finishes.
 */
CREATE TABLE IF NOT EXISTS bonus_hunts (
  id              bigserial     PRIMARY KEY,
  title           text          NOT NULL,
  start_cost      numeric(12,2) NOT NULL CHECK (start_cost >= 0),
  status          text          NOT NULL DEFAULT 'collecting',
  requests_open   boolean       NOT NULL DEFAULT true,
  gtb_status      text          NOT NULL DEFAULT 'closed',
  gtb_prize       integer       NOT NULL DEFAULT 0 CHECK (gtb_prize >= 0),
  -- Written once, at settlement, so the result cannot drift if a payout is
  -- corrected afterwards.
  final_balance   numeric(12,2),
  gtb_winner_kick_id text,
  gtb_winner_name text,
  gtb_winner_user_id bigint     REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  opening_at      timestamptz,
  finished_at     timestamptz,
  settled_at      timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS bonus_hunts_one_live_idx
  ON bonus_hunts ((status <> 'finished')) WHERE status <> 'finished';

/* A bonus in a hunt. `payout` is null until it is opened. The slot name is
   copied rather than joined so editing the catalog cannot rewrite history. */
CREATE TABLE IF NOT EXISTS hunt_bonuses (
  id            bigserial     PRIMARY KEY,
  hunt_id       bigint        NOT NULL REFERENCES bonus_hunts(id) ON DELETE CASCADE,
  slot_id       bigint        REFERENCES slots(id) ON DELETE SET NULL,
  slot_name     text          NOT NULL,
  provider      text          NOT NULL DEFAULT '',
  image_url     text,
  bet           numeric(12,2) NOT NULL CHECK (bet > 0),
  payout        numeric(12,2) CHECK (payout >= 0),
  position      integer       NOT NULL,
  requested_by  text,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  opened_at     timestamptz
);

CREATE INDEX IF NOT EXISTS hunt_bonuses_hunt_idx ON hunt_bonuses (hunt_id, position);

/*
 * !sr <slot> from Kick chat. One pending request per chatter per hunt: a
 * second !sr replaces the first, so the queue stays one line per person and
 * nobody can flood it. Keyed on the numeric Kick id, never the username.
 */
CREATE TABLE IF NOT EXISTS slot_requests (
  id              bigserial   PRIMARY KEY,
  hunt_id         bigint      NOT NULL REFERENCES bonus_hunts(id) ON DELETE CASCADE,
  kick_user_id    text        NOT NULL,
  kick_username   text        NOT NULL,
  query           text        NOT NULL,
  slot_id         bigint      REFERENCES slots(id) ON DELETE SET NULL,
  -- 'pending' | 'added' | 'dismissed'
  status          text        NOT NULL DEFAULT 'pending',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hunt_id, kick_user_id)
);

CREATE INDEX IF NOT EXISTS slot_requests_hunt_idx ON slot_requests (hunt_id, status, created_at);

/* One guess per chatter per hunt, replaceable while guessing is open. */
CREATE TABLE IF NOT EXISTS gtb_guesses (
  hunt_id         bigint        NOT NULL REFERENCES bonus_hunts(id) ON DELETE CASCADE,
  kick_user_id    text          NOT NULL,
  kick_username   text          NOT NULL,
  guess           numeric(12,2) NOT NULL CHECK (guess >= 0),
  guessed_at      timestamptz   NOT NULL DEFAULT now(),
  PRIMARY KEY (hunt_id, kick_user_id)
);
