/* -------------------------------------------------------------------------- */
/* Slot tournament                                                            */
/* -------------------------------------------------------------------------- */

/*
 * How a slot tournament runs on stream:
 *
 *   1. The streamer opens sign-ups for a 4, 8 or 16 player bracket with an MC
 *      prize. Chat signs up with `!sr <slot>`.
 *   2. Seeding the bracket picks the players — at random, if more signed up
 *      than there are places — and shuffles them into it. With too few, the
 *      bracket shrinks to the next size that holds them, and the places left
 *      over are byes: those players go straight through to round two.
 *   3. Matches are played in order. Each is one bonus buy per player, and the
 *      higher multiplier (payout ÷ cost) goes through. A tie means both buy
 *      again. A player still in can `!sr` a new slot between matches.
 *   4. The winner of the final is the champion, and ending the tournament pays
 *      them the prize. A tournament ended before the final pays nobody.
 *
 * Scores are never stored: they are read from the turns. A match's winner
 * is stored, because it fills the next round's match.
 *
 * Only one tournament is ever live, so `!sr` never has to say which one.
 */
CREATE TABLE IF NOT EXISTS tourney_games (
  id              bigserial     PRIMARY KEY,
  title           text          NOT NULL,
  -- Places in the bracket: 4, 8 or 16 when chosen; shrunk at seeding if
  -- fewer signed up.
  size            integer       NOT NULL CHECK (size IN (2, 4, 8, 16)),
  -- MC paid to the champion, fixed when the tournament opens.
  prize           integer       NOT NULL DEFAULT 0 CHECK (prize >= 0),
  -- 'signup' | 'running' | 'finished'
  status          text          NOT NULL DEFAULT 'signup',
  requests_open   boolean       NOT NULL DEFAULT true,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  started_at      timestamptz,
  finished_at     timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS tourney_games_one_live_idx
  ON tourney_games ((status <> 'finished')) WHERE status <> 'finished';

/*
 * Sign-ups: one row per chatter per tournament, keyed on the numeric Kick id,
 * carrying the slot they will play. `seeded` marks the ones who made the
 * bracket.
 */
CREATE TABLE IF NOT EXISTS tourney_entries (
  id              bigserial   PRIMARY KEY,
  game_id         bigint      NOT NULL REFERENCES tourney_games(id) ON DELETE CASCADE,
  kick_user_id    text        NOT NULL,
  kick_username   text        NOT NULL,
  query           text        NOT NULL,
  slot_id         bigint      REFERENCES slots(id) ON DELETE SET NULL,
  seeded          boolean     NOT NULL DEFAULT false,
  -- Filled in on the champion when the tournament ends and the prize is paid.
  paid_user_id    bigint      REFERENCES users(id) ON DELETE SET NULL,
  paid            integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, kick_user_id)
);

/*
 * The bracket: every match of every round, made when it is seeded. Round 1's
 * players are set then; later rounds fill in as winners go through. A bye is
 * a round 1 match with no second player, decided at seeding.
 */
CREATE TABLE IF NOT EXISTS tourney_matches (
  id              bigserial   PRIMARY KEY,
  game_id         bigint      NOT NULL REFERENCES tourney_games(id) ON DELETE CASCADE,
  round           integer     NOT NULL CHECK (round >= 1),
  position        integer     NOT NULL CHECK (position >= 0),
  a_entry_id      bigint      REFERENCES tourney_entries(id) ON DELETE SET NULL,
  b_entry_id      bigint      REFERENCES tourney_entries(id) ON DELETE SET NULL,
  bye             boolean     NOT NULL DEFAULT false,
  winner_entry_id bigint      REFERENCES tourney_entries(id) ON DELETE SET NULL,
  -- 'played' | 'bye' | 'forfeit', once there is a winner.
  decided_by      text,
  decided_at      timestamptz,
  UNIQUE (game_id, round, position)
);

/*
 * Every buy, kept as history: which match, which side, which slot, what it
 * cost and paid. The slot is copied so editing the catalog cannot rewrite a
 * finished tournament.
 */
CREATE TABLE IF NOT EXISTS tourney_turns (
  id              bigserial     PRIMARY KEY,
  game_id         bigint        NOT NULL REFERENCES tourney_games(id) ON DELETE CASCADE,
  match_id        bigint        NOT NULL REFERENCES tourney_matches(id) ON DELETE CASCADE,
  entry_id        bigint        REFERENCES tourney_entries(id) ON DELETE SET NULL,
  side            text          NOT NULL CHECK (side IN ('a', 'b')),
  kick_username   text          NOT NULL,
  slot_id         bigint        REFERENCES slots(id) ON DELETE SET NULL,
  slot_name       text          NOT NULL,
  provider        text          NOT NULL DEFAULT '',
  image_url       text,
  -- 'playing' | 'played' | 'skipped'
  status          text          NOT NULL DEFAULT 'playing',
  buy_cost        numeric(12,2) CHECK (buy_cost > 0),
  payout          numeric(12,2) CHECK (payout >= 0),
  drawn_at        timestamptz   NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);

CREATE INDEX IF NOT EXISTS tourney_turns_match_idx ON tourney_turns (match_id, drawn_at);
CREATE UNIQUE INDEX IF NOT EXISTS tourney_turns_one_playing_idx
  ON tourney_turns (game_id) WHERE status = 'playing';
