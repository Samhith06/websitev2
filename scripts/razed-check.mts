/**
 * Reads the live Razed feed and prints what the board would render.
 *
 * The one thing worth checking by hand when the leaderboard looks wrong: it
 * separates "Razed is not answering" from "Razed answered and nobody qualified",
 * which look identical on the page and have completely different fixes.
 *
 *   RAZED_REFERRAL_KEY=... npm run razed:check
 */
import { fetchRazedLeaderboard, healthFrom, mask, toBoardRows } from '../lib/razed';

const r = await fetchRazedLeaderboard({ from: '2026-08-01', to: '2026-08-30' });
console.log('ok:', r.ok);
if (r.ok) {
  console.log('returned:', r.returned, '| total:', r.total, '| truncated:', r.truncated);
  console.log('health:', JSON.stringify(healthFrom(r)));
  const prize = (rank: number) => (rank === 1 ? 2000 : rank === 2 ? 1200 : rank === 3 ? 800 : rank <= 10 ? 200 : 0);
  console.log('\ntop 5 as the page renders them:');
  for (const row of toBoardRows(r.rows, prize).slice(0, 5)) {
    console.log('  #' + String(row.rank).padEnd(2), row.maskedUsername.padEnd(14),
      '$' + row.wagered.toFixed(2).padStart(12), ' prize $' + row.prize);
  }
  console.log('\nmasking:', r.rows.slice(0, 3).map((x) => `${x.username} -> ${mask(x.username)}`).join(' | '));
} else {
  console.log('reason:', r.reason, '-', r.detail);
}
