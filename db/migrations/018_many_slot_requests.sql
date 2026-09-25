/* -------------------------------------------------------------------------- */
/* A viewer can have any number of !sr requests in a hunt                     */
/* -------------------------------------------------------------------------- */

/*
 * 015 allowed one request per chatter per hunt, a second !sr replacing the
 * first. The stream wants every request kept, so that uniqueness goes. The
 * store still ignores a viewer asking for the same slot again while it waits,
 * which is what stops one person flooding the queue with a repeat.
 *
 * The constraint was declared inline in 015, so Postgres named it; it is
 * looked up rather than assumed, in case a database named it differently.
 */
DO $$
DECLARE
  name text;
BEGIN
  SELECT c.conname INTO name
    FROM pg_constraint c
   WHERE c.conrelid = 'slot_requests'::regclass
     AND c.contype = 'u'
     AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
            FROM unnest(c.conkey) AS k(attnum)
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum)
         = ARRAY['hunt_id', 'kick_user_id'];
  IF name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE slot_requests DROP CONSTRAINT %I', name);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS slot_requests_viewer_idx ON slot_requests (hunt_id, kick_user_id, status);
