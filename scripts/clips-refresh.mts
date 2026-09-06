/**
 * Repairs stored clip metadata from the command line.
 *
 * Exactly the code path the "Refresh clip data" button in `/admin/clips` uses,
 * so a failure here is a real failure rather than a harness artefact. It exists
 * because that button needs an owner or mod session in a browser, and the rows
 * it repairs are the reason clips do not play at all — a fix that can only be
 * applied by being logged in is a fix that waits.
 *
 * What it repairs, and why the rows are wrong:
 *
 *   The shard segment in a Kick clip URL — the `8b` in
 *   `clips.kick.com/clips/8b/<id>/thumbnail.webp` — is per-clip and cannot be
 *   worked out from the clip id. Early rows were built with a hardcoded `60`,
 *   which 403s, and migration 010 derived each clip's stream URL from its
 *   thumbnail — so those rows now hold a guessed thumbnail *and* a guessed
 *   playlist, both refused. Only Kick knows the real segment, so this asks.
 *
 * Safe to run repeatedly: a clip Kick will not answer for is left exactly as it
 * was rather than blanked, so an outage costs nothing and a second run picks up
 * whatever the first could not.
 *
 *   DATABASE_URL=... npm run clips:refresh
 *
 * Against production, with Railway supplying the connection string:
 *
 *   railway run npm run clips:refresh
 */
import { refreshClipMetadata } from '../lib/store/clips';

const report = await refreshClipMetadata();

console.log(`Checked ${report.checked} Kick clip${report.checked === 1 ? '' : 's'}.`);
console.log(`Repaired ${report.fixed}.`);

if (report.failed.length) {
  console.log(`\n${report.failed.length} could not be read from Kick — deleted, private, or renamed:`);
  for (const id of report.failed) console.log(`  ${id}`);
}

if (report.checked === 0) {
  console.log('\nNothing to do: no Kick clips are stored.');
} else if (report.fixed === 0 && report.failed.length === 0) {
  console.log('\nEvery clip already held the metadata Kick reports.');
}

process.exit(0);
