-- The archive has to be immutable.
--
-- Razed answers a from/to window live, so an archived month re-asked today can
-- come back different: a restated figure, a voided bet, a bonus applied late.
-- Storing what the board said at the moment it locked makes the archive a
-- record rather than a re-query, so the past cannot quietly change under a
-- winner who has already been paid against it.

ALTER TABLE lb_periods
  ADD COLUMN IF NOT EXISTS frozen_standings jsonb,
  ADD COLUMN IF NOT EXISTS frozen_at timestamptz;
