-- Leaderboard periods and prize tiers (Master Plan §7, §13).
--
-- Until now the board's date range was computed from the server's boot time —
-- `days(-4)` to `days(3)` — which meant the window sent to Razed as from/to
-- moved every time the app restarted. A period nobody chose is a period nobody
-- can defend when a result is disputed, so it becomes a row Matty sets.
--
-- Prize tiers hang off a period rather than sitting global, so editing next
-- week's pot cannot rewrite what last week paid. The archive is evidence.

CREATE TABLE IF NOT EXISTS lb_periods (
  id          bigserial   PRIMARY KEY,
  -- 'weekly' | 'monthly'
  type        text        NOT NULL,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL,
  -- 'open' | 'frozen' | 'paid' | 'archived'
  status      text        NOT NULL DEFAULT 'open',
  locked_at   timestamptz,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lb_periods_range CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS lb_periods_listing_idx ON lb_periods (type, starts_at DESC);

/*
 * One open period per type at a time. Two open weekly boards would mean two
 * different answers to "what am I competing in this week", which is the kind
 * of ambiguity that turns into an argument about money.
 */
CREATE UNIQUE INDEX IF NOT EXISTS lb_periods_one_open_idx
  ON lb_periods (type) WHERE status = 'open';

/*
 * A range tier ("4-10 -> $400 each") is one row, so Matty is not typing seven
 * identical lines. The pot is never stored: it is summed from these rows, so
 * the advertised prize pool cannot disagree with what the tiers actually pay.
 */
CREATE TABLE IF NOT EXISTS prize_tiers (
  id         bigserial   PRIMARY KEY,
  period_id  bigint      NOT NULL REFERENCES lb_periods(id) ON DELETE CASCADE,
  rank_from  integer     NOT NULL CHECK (rank_from >= 1),
  rank_to    integer     NOT NULL CHECK (rank_to >= rank_from),
  amount     integer     NOT NULL CHECK (amount >= 0),
  currency   text        NOT NULL DEFAULT 'USD',
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prize_tiers_no_overlap_self CHECK (rank_to >= rank_from)
);

CREATE INDEX IF NOT EXISTS prize_tiers_period_idx ON prize_tiers (period_id, rank_from);

/* Overlapping ranges would pay one rank twice. Enforced in the database so a
   second admin editing concurrently cannot slip past an application check. */
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE prize_tiers DROP CONSTRAINT IF EXISTS prize_tiers_no_overlap;
ALTER TABLE prize_tiers ADD CONSTRAINT prize_tiers_no_overlap
  EXCLUDE USING gist (
    period_id WITH =,
    int4range(rank_from, rank_to, '[]') WITH &&
  );
