/* -------------------------------------------------------------------------- */
/* Team battle                                                                */
/* -------------------------------------------------------------------------- */

/*
 * How a team battle runs on stream:
 *
 *   1. The streamer starts a battle between two named teams, with a number of
 *      buys per team and an MC prize pot.
 *   2. Chat joins with `!sr <team> <slot>`, or plain `!sr <slot>` to be put on
 *      the smaller team. A viewer stays on the team they joined.
 *   3. Draws alternate between the teams. Within a team, a random waiting
 *      member is drawn — everyone gets a go before anyone gets a second.
 *   4. The streamer bonus-buys that viewer's slot, and its multiplier
 *      (payout ÷ cost) is added to their team's total.
 *   5. Once both teams have had their buys, the higher total wins. A tie goes
 *      to a tiebreaker: one more buy each, until the totals differ.
 *   6. Ending the battle splits the pot evenly across the winning team's
 *      members with a linked Kick account. A battle ended before it is
 *      decided pays nobody.
 *
 * Totals are never stored: they are summed from the turns, so they cannot
 * disagree with them.
 *
 * Only one battle is ever running, so `!sr` never has to say which one.
 */
CREATE TABLE IF NOT EXISTS battle_games (
  id              bigserial     PRIMARY KEY,
  title           text          NOT NULL,
  team_a          text          NOT NULL,
  team_b          text          NOT NULL,
  -- Buys each team gets before the totals decide it (tiebreakers add more).
  rounds          integer       NOT NULL CHECK (rounds BETWEEN 1 AND 50),
  -- The MC pot, fixed when the battle starts, split across the winning team.
  prize           integer       NOT NULL DEFAULT 0 CHECK (prize >= 0),
  -- 'running' | 'finished'
  status          text          NOT NULL DEFAULT 'running',
  requests_open   boolean       NOT NULL DEFAULT true,
  -- 'a' | 'b' once decided and ended; null for a battle stopped early.
  winner          text,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  CHECK (lower(team_a) <> lower(team_b))
);

CREATE UNIQUE INDEX IF NOT EXISTS battle_games_one_live_idx
  ON battle_games ((status = 'running')) WHERE status = 'running';

/*
 * The members: one row per chatter per battle, keyed on the numeric Kick id,
 * with the team they joined. The row also carries their slot request:
 *
 *   waiting → playing → played        (or skipped, if the slot can't be played)
 *
 * A second !sr replaces a waiting slot, and a member who has played or been
 * skipped can !sr again. Only the member being played right now is left
 * alone. The team never changes.
 */
CREATE TABLE IF NOT EXISTS battle_entries (
  id              bigserial   PRIMARY KEY,
  game_id         bigint      NOT NULL REFERENCES battle_games(id) ON DELETE CASCADE,
  kick_user_id    text        NOT NULL,
  kick_username   text        NOT NULL,
  team            text        NOT NULL CHECK (team IN ('a', 'b')),
  query           text        NOT NULL,
  slot_id         bigint      REFERENCES slots(id) ON DELETE SET NULL,
  status          text        NOT NULL DEFAULT 'waiting',
  -- Filled in when the battle ends and this member's share is paid.
  paid_user_id    bigint      REFERENCES users(id) ON DELETE SET NULL,
  paid            integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, kick_user_id)
);

CREATE INDEX IF NOT EXISTS battle_entries_pool_idx ON battle_entries (game_id, team, status);

/*
 * Every buy, kept as history: who was drawn, for which team, with which slot,
 * and what the buy cost and paid. The slot is copied so editing the catalog
 * cannot rewrite a finished battle.
 */
CREATE TABLE IF NOT EXISTS battle_turns (
  id              bigserial     PRIMARY KEY,
  game_id         bigint        NOT NULL REFERENCES battle_games(id) ON DELETE CASCADE,
  entry_id        bigint        REFERENCES battle_entries(id) ON DELETE SET NULL,
  team            text          NOT NULL CHECK (team IN ('a', 'b')),
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
  drawn_at        timestamptz   NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);

CREATE INDEX IF NOT EXISTS battle_turns_game_idx ON battle_turns (game_id, drawn_at);
CREATE UNIQUE INDEX IF NOT EXISTS battle_turns_one_playing_idx
  ON battle_turns (game_id) WHERE status = 'playing';
