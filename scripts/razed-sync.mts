/**
 * Runs the lifetime Razed sync from the command line.
 *
 * Exactly the code path the admin button and the cron route use, so a failure
 * here is a real failure rather than a harness artefact. Useful for seeding a
 * fresh database, and for checking how far back the referral code actually has
 * data after Razed's 45-day window cap forced the walk.
 *
 *   RAZED_REFERRAL_KEY=... DATABASE_URL=... npm run razed:sync
 */
import { latestWagerRows, syncLifetime } from '../lib/store/razed-snapshots';

const result = await syncLifetime();

if (!result.ok) {
  console.error(`FAILED: ${result.reason} — ${result.detail}`);
  process.exit(1);
}

console.log(`Synced ${result.rowCount} wagerers into snapshot ${result.snapshot.id}.`);

const top = await latestWagerRows();
for (const row of top.slice(0, 12)) {
  console.log(`  ${row.username.padEnd(24)} $${row.wagered.toFixed(2)}`);
}

process.exit(0);
