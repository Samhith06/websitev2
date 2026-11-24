/* -------------------------------------------------------------------------- */
/* Weekly chat leaderboard                                                    */
/* -------------------------------------------------------------------------- */

/*
 * One row per linked viewer per week (Monday 00:00 Europe/London). A chat
 * message during a live stream that passes the spam filter (lib/chat-score.ts)
 * is one point. When a week ends its top ten are paid from a 5,000 MC pool.
 *
 * Message text is never stored: `recent_keys` holds short hashes of the last
 * few counted messages, which is all the repeat check needs.
 */
CREATE TABLE IF NOT EXISTS chat_activity (
  week_start       date         NOT NULL,
  user_id          bigint       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points           integer      NOT NULL DEFAULT 0,
  -- Every message seen during a live stream, counted or not.
  messages         integer      NOT NULL DEFAULT 0,
  last_counted_at  timestamptz,
  recent_keys      text[]       NOT NULL DEFAULT '{}',
  -- The clock hour the hourly cap is being counted in, and the points in it.
  hour_start       timestamptz,
  hour_points      integer      NOT NULL DEFAULT 0,
  PRIMARY KEY (week_start, user_id)
);

CREATE INDEX IF NOT EXISTS chat_activity_board_idx
  ON chat_activity (week_start, points DESC, last_counted_at);

/*
 * A week is settled once: the row is claimed inside the payout transaction,
 * so a second scheduler call or a staff click cannot pay it twice.
 * `standings` is the paid top ten as it stood, kept for the archive.
 */
CREATE TABLE IF NOT EXISTS chat_weeks (
  week_start  date         PRIMARY KEY,
  settled_at  timestamptz  NOT NULL DEFAULT now(),
  settled_by  text         NOT NULL DEFAULT 'auto',
  pool        integer      NOT NULL,
  paid        integer      NOT NULL DEFAULT 0,
  standings   jsonb        NOT NULL DEFAULT '[]'
);
