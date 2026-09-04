/**
 * Subscribes Kick to the events this site handles.
 *
 * The dashboard's webhook URL says where deliveries go; this says what to
 * deliver. Run it once at setup, and again if the event list ever changes.
 *
 * It reports before it writes, and only subscribes to what is missing, so
 * running it twice is harmless rather than a way to get every chat message
 * delivered twice.
 *
 *   KICK_CLIENT_ID=... KICK_CLIENT_SECRET=... npm run kick:events
 */
import { channel } from '../lib/mock';
import { REQUIRED_EVENTS, broadcasterId, listSubscriptions, subscribe } from '../lib/kick-events';

const existing = await listSubscriptions();
if (!existing.ok) {
  console.error(`FAILED: ${existing.detail}`);
  process.exit(1);
}

const have = new Set(existing.subscriptions.map((s) => s.event));
console.log(`Currently subscribed (${have.size}):`);
for (const s of existing.subscriptions) console.log(`  ${s.event}  (v${s.version}, ${s.id})`);
if (have.size === 0) console.log('  none');

const missing = REQUIRED_EVENTS.filter((e) => !have.has(e));
if (missing.length === 0) {
  console.log('\nEvery event this site handles is already subscribed. Nothing to do.');
  process.exit(0);
}

console.log(`\nMissing (${missing.length}):`);
for (const e of missing) console.log(`  ${e}`);

const broadcaster = await broadcasterId(channel);
if (!broadcaster.ok) {
  console.error(`\nFAILED: ${broadcaster.detail}`);
  process.exit(1);
}
console.log(`\nSubscribing for ${channel} (broadcaster ${broadcaster.id})…`);

const result = await subscribe(missing, broadcaster.id);
if (!result.ok) {
  console.error(`FAILED: ${result.detail}`);
  process.exit(1);
}

console.log(`Subscribed to ${result.created} event(s). Kick will now POST them to /api/kick/webhook.`);
process.exit(0);
