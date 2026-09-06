/* -------------------------------------------------------------------------- */
/* How often a clip is watched here, as opposed to on Kick                    */
/* -------------------------------------------------------------------------- */

/*
 * Kick's own view count is already stored on `clips`, but it counts views on
 * Kick — it says nothing about the clip being watched on this site, and for
 * these clips it is single digits. This counts the plays that happen here.
 *
 * A counter and a timestamp, and deliberately nothing else. No viewer id, no
 * session, no address: the question is "how many times has this been
 * watched", and answering it does not require knowing by whom. Repeat plays
 * are filtered in the browser instead, which keeps the honest answer without
 * building a record of who watched what.
 *
 * Its own table rather than a column on `clips` so the row every page reads is
 * not rewritten by every play.
 */

CREATE TABLE IF NOT EXISTS clip_plays (
  clip_id      text        PRIMARY KEY REFERENCES clips (id) ON DELETE CASCADE,
  plays        integer     NOT NULL DEFAULT 0,
  last_play_at timestamptz
);
