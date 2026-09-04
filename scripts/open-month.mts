/**
 * Opens the current month's leaderboard board, with the design's prize ladder.
 *
 * The same store functions the admin screen calls, so this goes through the
 * same validation — including the refusal to open a second board while one is
 * already open. It exists because the admin screen needs a Discord owner
 * session, which a script cannot have.
 *
 * Every amount here is editable afterwards from /admin/leaderboard.
 *
 *   railway run npm run open:month
 */
import { createPeriod, currentPeriod, potOf, upsertTier } from '../lib/store/periods';
import { money } from '../lib/format';

/** The design's ladder: top ten paid, $5,000 in total. */
const LADDER: Array<[rank: number, amount: number]> = [
  [1, 1500],
  [2, 1000],
  [3, 700],
  [4, 500],
  [5, 400],
  [6, 300],
  [7, 250],
  [8, 150],
  [9, 125],
  [10, 75],
];

const existing = await currentPeriod('monthly');
if (existing) {
  console.log(
    `A monthly board is already open (${existing.startsAt.slice(0, 10)} → ${existing.endsAt.slice(0, 10)}, pot ${money(existing.pot)}).`,
  );
  console.log('Nothing to do. Freeze it before opening the next month.');
  process.exit(0);
}

const now = new Date();
const year = now.getUTCFullYear();
const month = now.getUTCMonth();

// The calendar month in UTC — what the site tells members the window is.
const startsAt = new Date(Date.UTC(year, month, 1, 0, 0, 0));
const endsAt = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0) - 1000);

const period = await createPeriod({
  type: 'monthly',
  startsAt: startsAt.toISOString(),
  endsAt: endsAt.toISOString(),
  createdBy: 'setup script',
});

for (const [rank, amount] of LADDER) {
  await upsertTier({
    periodId: period.id,
    rankFrom: rank,
    rankTo: rank,
    amount,
    updatedBy: 'setup script',
  });
}

const opened = await currentPeriod('monthly');
console.log(
  `Opened ${startsAt.toISOString().slice(0, 10)} → ${endsAt.toISOString().slice(0, 10)}`,
);
console.log(`Prize pool: ${money(potOf(opened?.tiers ?? []))} across ${opened?.tiers.length} tiers`);
for (const tier of opened?.tiers ?? []) {
  console.log(`  #${tier.rankFrom}${tier.rankTo !== tier.rankFrom ? `–${tier.rankTo}` : ''}  ${money(tier.amount)}`);
}
process.exit(0);
