/* -------------------------------------------------------------------------- */
/* What VIP, Champion and Podium now ask for                                   */
/* -------------------------------------------------------------------------- */

/*
 * VIP is decided on the previous calendar month or the last 30 days, and Champion
 * and Podium on the most recently frozen monthly board. The rules are in
 * lib/store/badge-rules.ts and their criteria have not changed shape, so only the
 * wording moves. Matched on the old text, so wording staff have since edited stays.
 */
UPDATE badges SET description = '$40,000 last month or in the last 30 days'
 WHERE slug = 'vip' AND description = '$40,000 in 30 days';

UPDATE badges SET description = 'Won the last monthly leaderboard'
 WHERE slug = 'champion' AND description = 'Won a monthly leaderboard';

UPDATE badges SET description = 'Top 3 on the last monthly leaderboard'
 WHERE slug = 'podium' AND description = 'Top 3 on a monthly board';
