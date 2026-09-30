/**
 * Prints the top wagerers under the Mattyspins code for any window, straight
 * from the Razed API — no periods, no snapshots, no prizes. For one-off boards
 * that don't line up with a month the site has open.
 *
 * Usernames are printed in full: this runs on your machine, not on a page.
 * Pass a CSV path as the fourth argument to also save the board.
 *
 *   npm run razed:top -- 2026-08-30 2026-09-30 50
 *   npm run razed:top -- 2026-08-30 2026-09-30 50 data/top50.csv
 */
import { writeFileSync } from 'node:fs';
import { fetchRazedLeaderboard } from '../lib/razed';

const [from, to, topArg = '50', csvPath] = process.argv.slice(2);
const top = Number(topArg);

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
if (!from || !to || !dateRe.test(from) || !dateRe.test(to) || !Number.isInteger(top) || top < 1) {
  console.error('Usage: npm run razed:top -- <from YYYY-MM-DD> <to YYYY-MM-DD> [top=50] [out.csv]');
  process.exit(1);
}

// Plain dates mean whole days: lib/razed sends `to` as 23:59:59.
const r = await fetchRazedLeaderboard({ from, to, top, revalidate: 0 });

if (!r.ok) {
  console.error(`Razed read failed (${r.reason}): ${r.detail}`);
  process.exit(1);
}

const money = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const nameWidth = Math.max(8, ...r.rows.map((row) => row.username.length));
const sum = r.rows.reduce((acc, row) => acc + row.wagered, 0);

console.log(`\nMattyspins code, ${from} to ${to} (inclusive) — top ${top}`);
console.log(`fetched ${r.fetchedAt} | showing ${r.returned} of ${r.total} referred players\n`);
console.log('  #    ' + 'Username'.padEnd(nameWidth) + '   Wagered');
console.log('  ' + '─'.repeat(nameWidth + 22));
for (const row of r.rows) {
  console.log(
    '  ' + String(row.rank).padEnd(4) + ' ' + row.username.padEnd(nameWidth) + ' ' + money(row.wagered).padStart(16),
  );
}
console.log('  ' + '─'.repeat(nameWidth + 22));
console.log(`  top ${r.returned} combined: ${money(sum)}\n`);

if (csvPath) {
  const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = ['rank,username,wagered', ...r.rows.map((row) => `${row.rank},${quote(row.username)},${row.wagered.toFixed(2)}`)];
  writeFileSync(csvPath, lines.join('\n') + '\n');
  console.log(`saved ${csvPath}\n`);
}
