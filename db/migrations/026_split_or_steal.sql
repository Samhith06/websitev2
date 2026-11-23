/* -------------------------------------------------------------------------- */
/* Split or Steal                                                             */
/* -------------------------------------------------------------------------- */

/*
 * How a Split or Steal event runs, entirely on the website (not Kick chat):
 *
 *   1. The owner opens an event: a cash prize per pair and how many pairs.
 *      A draw seed is generated and its hash published straight away.
 *   2. Members enter on /split-or-steal. Entry needs an approved Razed link and
 *      the minimum wager under the code in the current leaderboard period.
 *   3. Drawing the pairs shuffles the entries with the committed seed and pairs
 *      them off; with more entrants than places, the rest miss out.
 *   4. Each drawn player sees their opponent and locks in Split or Steal on the
 *      site. A choice is final and hidden from everyone, staff included, until
 *      that pair is revealed.
 *   5. Staff reveal pair by pair (or all at once). Both split: half each. One
 *      steals: they take it all. Both steal: nobody wins. A player who never
 *      chose forfeits, and an opponent who did choose takes the full prize.
 *
 * Only one event is live (open or choosing) at a time.
 */
CREATE TABLE IF NOT EXISTS split_steal_events (
  id                bigserial     PRIMARY KEY,
  title             text          NOT NULL,
  -- Dollars at stake in each pair.
  prize             numeric(12,2) NOT NULL CHECK (prize > 0),
  -- The most pairs the draw will make.
  pairs             integer       NOT NULL CHECK (pairs BETWEEN 1 AND 100),
  -- 'open' | 'choosing' | 'finished' | 'cancelled'
  status            text          NOT NULL DEFAULT 'open',
  draw_seed         text          NOT NULL,
  draw_seed_hash    text          NOT NULL,
  seed_revealed_at  timestamptz,
  created_by        text          NOT NULL DEFAULT '',
  created_at        timestamptz   NOT NULL DEFAULT now(),
  drawn_at          timestamptz,
  finished_at       timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS split_steal_one_live_idx
  ON split_steal_events ((status IN ('open', 'choosing')))
  WHERE status IN ('open', 'choosing');

/* One entry per member per event, with the wager that let them in. */
CREATE TABLE IF NOT EXISTS split_steal_entries (
  id          bigserial     PRIMARY KEY,
  event_id    bigint        NOT NULL REFERENCES split_steal_events(id) ON DELETE CASCADE,
  user_id     bigint        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wagered     numeric(14,2) NOT NULL DEFAULT 0,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

/* The drawn pairs. A choice is 'split' or 'steal', null until made. */
CREATE TABLE IF NOT EXISTS split_steal_pairs (
  id            bigserial    PRIMARY KEY,
  event_id      bigint       NOT NULL REFERENCES split_steal_events(id) ON DELETE CASCADE,
  position      integer      NOT NULL,
  a_user_id     bigint       NOT NULL REFERENCES users(id),
  b_user_id     bigint       NOT NULL REFERENCES users(id),
  a_choice      text         CHECK (a_choice IN ('split', 'steal')),
  b_choice      text         CHECK (b_choice IN ('split', 'steal')),
  a_chosen_at   timestamptz,
  b_chosen_at   timestamptz,
  revealed_at   timestamptz,
  paid_at       timestamptz,
  UNIQUE (event_id, position)
);

CREATE INDEX IF NOT EXISTS split_steal_pairs_a_idx ON split_steal_pairs (a_user_id);
CREATE INDEX IF NOT EXISTS split_steal_pairs_b_idx ON split_steal_pairs (b_user_id);
