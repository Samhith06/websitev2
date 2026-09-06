/* -------------------------------------------------------------------------- */
/* Kick clips play from their own HLS stream, not from Kick's player           */
/* -------------------------------------------------------------------------- */

/*
 * `player.kick.com/<channel>?clip=<id>` no longer plays a clip. Kick's player
 * bundle carries no clip route at all any more: it reads the channel slug,
 * ignores the query string, and renders the live player — which, off stream,
 * is the "MattySpinss is offline" card every clip on the site was showing.
 *
 * What Kick does still serve is the clip's own HLS playlist, publicly and with
 * `Access-Control-Allow-Origin: *`, so the site can play it directly.
 *
 * The playlist sits in the same directory as the thumbnail, which is why the
 * backfill below can repair every existing row without asking Kick anything:
 * the per-clip shard segment we could never derive is already sitting in
 * `thumb_url`.
 */

ALTER TABLE clips ADD COLUMN IF NOT EXISTS video_url text NOT NULL DEFAULT '';

UPDATE clips
   SET video_url = replace(thumb_url, 'thumbnail.webp', 'playlist.m3u8')
 WHERE source = 'kick'
   AND video_url = ''
   AND thumb_url LIKE 'https://clips.kick.com/%thumbnail.webp';

/* The seeded clip predates the fetched thumbnail, so it is named outright. */
UPDATE clips
   SET video_url = 'https://clips.kick.com/clips/60/clip_01M0NBWS4MYE20NF4Z6QQW79J6/playlist.m3u8'
 WHERE id = 'clip_01M0NBWS4MYE20NF4Z6QQW79J6' AND video_url = '';
