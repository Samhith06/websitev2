/* -------------------------------------------------------------------------- */
/* Forget the Kick embed that never worked                                    */
/* -------------------------------------------------------------------------- */

/*
 * `010` gave every Kick clip its stream URL, so they play. It left the old
 * `player.kick.com/<channel>?clip=<id>` in `embed_url`, which is harmless
 * right up until it is not: a clip whose stream URL is missing — one Kick
 * would not answer for — falls back to the iframe, and the iframe is the bug.
 * It ignores the clip and renders the live channel, so the card would go
 * straight back to "MattySpinss is offline".
 *
 * There is no Kick clip embed to fall back to, so there should be no URL here
 * pretending otherwise. A Kick clip with no stream says so and offers the link.
 */

UPDATE clips
   SET embed_url = ''
 WHERE source = 'kick'
   AND embed_url LIKE '%player.kick.com%';
