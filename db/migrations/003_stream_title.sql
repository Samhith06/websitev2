-- The stream's title, carried on the livestream.status.updated webhook.
--
-- The hero printed a hardcoded title, viewer count and uptime while the Kick
-- embed sitting beside it said the channel was offline. Whatever we can learn
-- from the webhook is stored here; whatever we cannot is shown as unknown
-- rather than invented.

ALTER TABLE stream_sessions ADD COLUMN IF NOT EXISTS title text;
