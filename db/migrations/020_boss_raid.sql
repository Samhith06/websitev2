/* -------------------------------------------------------------------------- */
/* Boss raid                                                                  */
/* -------------------------------------------------------------------------- */

/*
 * How a boss raid runs on stream:
 *
 *   1. The streamer starts a raid on a named boss with a set HP and an MC
 *      prize.
 *   2. Chat joins the pool with `!sr <slot>`.
 *   3. The site draws a random viewer from the pool — everyone waiting gets a
 *      go before anyone gets a second.
 *   4. The streamer bonus-buys that viewer's slot. The buy deals damage equal
 *      to its multiplier (payout ÷ cost): a 130× buy takes 130 HP.
 *   5. The buy that takes the boss to 0 HP is the killing blow. Draws stop,
 *      and ending the raid pays that viewer the prize. A raid ended with the
 *      boss still standing pays nobody.
 *
 * Damage and HP are never stored: they are summed from the turns, so they
 * cannot disagree with them.
 *
 * Only one raid is ever running, so `!sr` never has to say which one.
 */
CREATE TABLE IF NOT EXISTS raid_games (
  id              bigserial     PRIMARY KEY,
  boss            text          NOT NULL,
  max_hp          integer       NOT NULL CHECK (max_hp > 0),
  -- MC paid for the killing blow, fixed when the raid starts so nobody plays
  -- for one prize and is paid another.
  prize           integer       NOT NULL DEFAULT 0 CHECK (prize >= 0),
  -- 'running' | 'finished'
  status          text          NOT NULL DEFAULT 'running',
  requests_open   boolean       NOT NULL DEFAULT true,
  -- 'slain' when the boss fell, 'stopped' when the streamer ended it first.
  result          text,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  finished_at     timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS raid_games_one_live_idx
  ON raid_games ((status = 'running')) WHERE status = 'running';

/*
 * The pool: one row per chatter per raid, keyed on the numeric Kick id.
 *
 *   waiting → playing → played        (or skipped, if the slot can't be played)
 *
 * A second !sr replaces a waiting one, and a viewer who has played or been
 * skipped can !sr again. Only the viewer being played right now is left alone.
 */
CREATE TABLE IF NOT EXISTS raid_entries (
  id              bigserial   PRIMARY KEY,
  game_id         bigint      NOT NULL REFERENCES raid_games(id) ON DELETE CASCADE,
  kick_user_id    text        NOT NULL,
  kick_username   text        NOT NULL,
  query           text        NOT NULL,
  slot_id         bigint      REFERENCES slots(id) ON DELETE SET NULL,
  status          text        NOT NULL DEFAULT 'waiting',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, kick_user_id)
);

CREATE INDEX IF NOT EXISTS raid_entries_pool_idx ON raid_entries (game_id, status);

/*
 * Every hit, kept as history: who was drawn, with which slot, and what the
 * buy cost and paid. The slot is copied so editing the catalog cannot rewrite
 * a finished raid.
 */
CREATE TABLE IF NOT EXISTS raid_turns (
  id              bigserial     PRIMARY KEY,
  game_id         bigint        NOT NULL REFERENCES raid_games(id) ON DELETE CASCADE,
  entry_id        bigint        REFERENCES raid_entries(id) ON DELETE SET NULL,
  kick_user_id    text          NOT NULL,
  kick_username   text          NOT NULL,
  slot_id         bigint        REFERENCES slots(id) ON DELETE SET NULL,
  slot_name       text          NOT NULL,
  provider        text          NOT NULL DEFAULT '',
  image_url       text,
  -- 'playing' | 'played' | 'skipped'
  status          text          NOT NULL DEFAULT 'playing',
  buy_cost        numeric(12,2) CHECK (buy_cost > 0),
  payout          numeric(12,2) CHECK (payout >= 0),
  -- Filled in on the killing blow's turn when the raid ends and the prize is paid.
  paid_user_id    bigint        REFERENCES users(id) ON DELETE SET NULL,
  paid            integer       NOT NULL DEFAULT 0,
  drawn_at        timestamptz   NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);

CREATE INDEX IF NOT EXISTS raid_turns_game_idx ON raid_turns (game_id, drawn_at);
CREATE UNIQUE INDEX IF NOT EXISTS raid_turns_one_playing_idx
  ON raid_turns (game_id) WHERE status = 'playing';
