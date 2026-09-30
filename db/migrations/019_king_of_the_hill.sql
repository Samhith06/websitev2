/* -------------------------------------------------------------------------- */
/* King of the hill                                                           */
/* -------------------------------------------------------------------------- */

/*
 * How a king of the hill runs on stream:
 *
 *   1. The streamer starts a game with an MC prize. The hill starts empty.
 *   2. Chat joins the pool with `!sr <slot>`.
 *   3. The site draws a random viewer from the pool — everyone waiting gets a
 *      go before anyone gets a second.
 *   4. The streamer bonus-buys that viewer's slot. The first buy takes the
 *      hill; after that, a buy whose multiplier (payout ÷ cost) beats the
 *      king's takes it. A tie does not: the challenger has to beat the king.
 *   5. The streamer ends the game when they choose, and whoever holds the hill
 *      then is paid the prize.
 *
 * Who is king is never stored: it is the best multiplier among the played
 * turns, earliest first on a tie, so it cannot disagree with the turns.
 *
 * Only one game is ever running, so `!sr` never has to say which one.
 */
CREATE TABLE IF NOT EXISTS koth_games (
  id              bigserial     PRIMARY KEY,
  title           text          NOT NULL,
  -- MC paid to the final king, fixed when the game starts so nobody plays for
  -- one prize and is paid another.
  prize           integer       NOT NULL DEFAULT 0 CHECK (prize >= 0),
  -- 'running' | 'finished'
  status          text          NOT NULL DEFAULT 'running',
  requests_open   boolean       NOT NULL DEFAULT true,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  finished_at     timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS koth_games_one_live_idx
  ON koth_games ((status = 'running')) WHERE status = 'running';

/*
 * The pool: one row per chatter per game, keyed on the numeric Kick id.
 *
 *   waiting → playing → played        (or skipped, if the slot can't be played)
 *
 * A second !sr replaces a waiting one, and a viewer who has played or been
 * skipped can !sr again — the king too, to put another slot on the hill. Only
 * the viewer being played right now is left alone.
 */
CREATE TABLE IF NOT EXISTS koth_entries (
  id              bigserial   PRIMARY KEY,
  game_id         bigint      NOT NULL REFERENCES koth_games(id) ON DELETE CASCADE,
  kick_user_id    text        NOT NULL,
  kick_username   text        NOT NULL,
  query           text        NOT NULL,
  slot_id         bigint      REFERENCES slots(id) ON DELETE SET NULL,
  status          text        NOT NULL DEFAULT 'waiting',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, kick_user_id)
);

CREATE INDEX IF NOT EXISTS koth_entries_pool_idx ON koth_entries (game_id, status);

/*
 * Every challenger, kept as history: who was drawn, with which slot, and what
 * the buy cost and paid. The slot is copied so editing the catalog cannot
 * rewrite a finished game.
 */
CREATE TABLE IF NOT EXISTS koth_turns (
  id              bigserial     PRIMARY KEY,
  game_id         bigint        NOT NULL REFERENCES koth_games(id) ON DELETE CASCADE,
  entry_id        bigint        REFERENCES koth_entries(id) ON DELETE SET NULL,
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
  -- Filled in on the final king's turn when the game ends and the prize is paid.
  paid_user_id    bigint        REFERENCES users(id) ON DELETE SET NULL,
  paid            integer       NOT NULL DEFAULT 0,
  drawn_at        timestamptz   NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);

CREATE INDEX IF NOT EXISTS koth_turns_game_idx ON koth_turns (game_id, drawn_at);
CREATE UNIQUE INDEX IF NOT EXISTS koth_turns_one_playing_idx
  ON koth_turns (game_id) WHERE status = 'playing';
