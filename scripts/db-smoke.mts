/**
 * The database smoke test.
 *
 * Runs the real migrations and the real store modules against a real Postgres —
 * not a mock — because the things worth checking here are the things only
 * Postgres enforces: the unique indexes that make a double-tap one bet, the row
 * lock that stops two concurrent rounds sharing a nonce, and the constraint that
 * keeps a balance from going negative.
 *
 *   DATABASE_URL=postgres://... npm run db:smoke
 *
 * It drops and recreates the schema, so point it at a throwaway database and
 * never at production. Pass --keep to run against the existing schema instead.
 */
import { ready, rows, write } from '../lib/db';
import * as accounts from '../lib/store/accounts';
import * as coins from '../lib/store/coins';
import * as play from '../lib/store/play';
import * as presence from '../lib/store/presence';
import * as clips from '../lib/store/clips';
import * as periods from '../lib/store/periods';
import * as shop from '../lib/store/shop';
import * as settings from '../lib/store/settings';
import * as blackjack from '../lib/store/blackjack';
import { handTotal as bjTotal } from '../lib/blackjack';

let failures = 0;
function check(name: string, condition: unknown, detail = '') {
  if (condition) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}
function section(name: string) {
  console.log(`\n== ${name} ==`);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. This test needs a real Postgres.');
  process.exit(1);
}

// Repeatable from a clean schema unless told otherwise.
if (!process.argv.includes('--keep')) {
  const { pool } = await import('../lib/db');
  const p = pool();
  if (p) await p.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
}

/* -------------------------------------------------------------------------- */
section('migrations');

await ready();
const tables = (await rows<{ table_name: string }>(
  `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1`,
)).map((r) => r.table_name);

for (const t of ['users', 'kick_links', 'verification_codes', 'coin_ledger', 'coin_balances',
                 'seed_pairs', 'game_rounds', 'clips', 'presence_windows', 'stream_sessions',
                 'kick_events', 'audit_log', 'sub_state', 'schema_migrations']) {
  check(`table ${t}`, tables.includes(t));
}
check('the real clip is seeded', (await clips.listClips({})).length === 1);

const before = await rows<{ n: number }>('SELECT count(*)::int AS n FROM schema_migrations');
await ready();
const after = await rows<{ n: number }>('SELECT count(*)::int AS n FROM schema_migrations');
check('migrations are idempotent', before[0].n === after[0].n);

/* -------------------------------------------------------------------------- */
section('accounts');

const alice = await accounts.ensureUser({ discordId: 'd-alice', discordUsername: 'alice' });
const bob = await accounts.ensureUser({ discordId: 'd-bob', discordUsername: 'bob' });
check('two distinct users', alice.id !== bob.id);

const aliceAgain = await accounts.ensureUser({ discordId: 'd-alice', discordUsername: 'alice2' });
check('ensureUser is an upsert, not a second row', aliceAgain.id === alice.id);
check('a changed username is picked up', aliceAgain.discordUsername === 'alice2');

/* -------------------------------------------------------------------------- */
section('kick verification');

const code = await accounts.issueVerificationCode(alice.id);
check('code has the MS-XXXX shape', /^MS-[A-Z2-9]{4}$/.test(code.code), code.code);
check('state is waiting', (await accounts.verificationStateFor(alice.id)).status === 'waiting');

const wrong = await accounts.redeemVerificationCode({
  code: 'MS-2222', kickUserId: '999', kickUsername: 'nobody',
});
check('an unknown code is refused', wrong.ok === false && wrong.reason === 'no-code');

const redeemed = await accounts.redeemVerificationCode({
  code: code.code.toLowerCase(), kickUserId: '8814422', kickUsername: 'alicekick',
});
check('a code typed in lower case still works', redeemed.ok === true);
check('state is linked', (await accounts.verificationStateFor(alice.id)).status === 'linked');

const replayed = await accounts.redeemVerificationCode({
  code: code.code, kickUserId: '8814422', kickUsername: 'alicekick',
});
check('a code is single use', replayed.ok === false);

// One Kick account cannot end up on two profiles.
const bobCode = await accounts.issueVerificationCode(bob.id);
const stolen = await accounts.redeemVerificationCode({
  code: bobCode.code, kickUserId: '8814422', kickUsername: 'alicekick',
});
check('a Kick id cannot be claimed twice', stolen.ok === false && stolen.reason === 'kick-taken');

const stale = await accounts.issueVerificationCode(bob.id);
await write(`UPDATE verification_codes SET expires_at = now() - interval '1 minute' WHERE code = $1`, [stale.code]);
const tooLate = await accounts.redeemVerificationCode({
  code: stale.code, kickUserId: '777', kickUsername: 'late',
});
check('an expired code is refused', tooLate.ok === false && tooLate.reason === 'expired');
check('an expired code reads as expired, not as an error',
  (await accounts.verificationStateFor(bob.id)).status === 'expired');

/* -------------------------------------------------------------------------- */
section('coins');

await coins.record({ userId: alice.id, delta: 500, kind: 'adjustment', reason: 'test seed' });
let bal = await coins.balanceOf(alice.id);
check('a credit lands', bal.balance === 500, JSON.stringify(bal));
check('an adjustment is not "lifetime earned"', bal.lifetimeEarned === 0);

await coins.record({ userId: alice.id, delta: 40, kind: 'watch', reason: 'tick', multiplier: 1 });
bal = await coins.balanceOf(alice.id);
check('watching does count as earned', bal.balance === 540 && bal.lifetimeEarned === 40, JSON.stringify(bal));

let refused = false;
try {
  await coins.record({ userId: alice.id, delta: -10_000, kind: 'game', reason: 'overdraw' });
} catch (error) {
  refused = error instanceof coins.InsufficientCoins;
}
check('a balance cannot go negative', refused);
check('the refused movement left nothing behind', (await coins.balanceOf(alice.id)).balance === 540);

const ledger = await coins.ledgerFor(alice.id, 10);
check('both movements are on the ledger', ledger.length === 2);
check('each row carries the balance after it', ledger[0].balance === 540);

/* -------------------------------------------------------------------------- */
section('game rounds');

const opening = await play.publicState(alice.id);
check('a seed pair is created on first look', Boolean(opening.serverSeedHash) && opening.nonce === 0);

const win = () => ({ multiplier: 2, payout: 40, outcome: { fake: true } });
const lose = () => ({ multiplier: 0, payout: 0, outcome: {} });

const first = await play.playRound({
  userId: alice.id, game: 'keno', bet: 20, idempotencyKey: 'key-1', resolve: win,
});
check('a round settles', first.ok === true);
check('the balance moves by the net', first.ok && first.balance === 560, first.ok ? String(first.balance) : '');
check('the nonce advances', first.ok && first.nextNonce === 1);
check('a win writes two ledger rows',
  (await coins.ledgerFor(alice.id, 10)).filter((e) => e.kind === 'game').length === 2);

const again = await play.playRound({
  userId: alice.id, game: 'keno', bet: 20, idempotencyKey: 'key-1', resolve: win,
});
check('a repeated key returns the same round', again.ok === true && again.replayed === true);
check('a repeated key moves no coins', (await coins.balanceOf(alice.id)).balance === 560);

// Two rounds at once on different keys must not share a nonce.
const [a, b] = await Promise.all([
  play.playRound({ userId: alice.id, game: 'dice', bet: 10, idempotencyKey: 'race-a', resolve: lose }),
  play.playRound({ userId: alice.id, game: 'dice', bet: 10, idempotencyKey: 'race-b', resolve: lose }),
]);
check('both concurrent rounds settle', a.ok && b.ok);
check('concurrent rounds get different nonces', a.ok && b.ok && a.round.nonce !== b.round.nonce,
  a.ok && b.ok ? `${a.round.nonce} vs ${b.round.nonce}` : '');

// The same key twice at once is one bet.
const beforeDouble = (await coins.balanceOf(alice.id)).balance;
await Promise.all([
  play.playRound({ userId: alice.id, game: 'dice', bet: 10, idempotencyKey: 'dup', resolve: lose }),
  play.playRound({ userId: alice.id, game: 'dice', bet: 10, idempotencyKey: 'dup', resolve: lose }),
]);
const afterDouble = (await coins.balanceOf(alice.id)).balance;
check('a double-tap is charged once', afterDouble === beforeDouble - 10, `${beforeDouble} -> ${afterDouble}`);

const broke = await play.playRound({
  userId: bob.id, game: 'limbo', bet: 50, idempotencyKey: 'bob-1', resolve: win,
});
check('no coins means no round', broke.ok === false && broke.error === 'insufficient-coins');

const tiny = await play.playRound({
  userId: alice.id, game: 'limbo', bet: 1, idempotencyKey: 'tiny', resolve: win,
});
check('a bet below the minimum is refused', tiny.ok === false && tiny.error === 'bet-below-minimum');

/* -------------------------------------------------------------------------- */
section('seed rotation');

const priorState = await play.publicState(alice.id);
const rotated = await play.rotateSeed(alice.id, 'my-own-seed');
check('the old seed is revealed', rotated.revealedServerSeedHash === priorState.serverSeedHash);
check('the new hash is different', rotated.serverSeedHash !== priorState.serverSeedHash);
check('the nonce resets with the new pair', rotated.nonce === 0);
check('a chosen client seed is applied', rotated.clientSeed === 'my-own-seed');
check('the revealed seed stays readable',
  (await play.publicState(alice.id)).previousServerSeedHash === priorState.serverSeedHash);

/* -------------------------------------------------------------------------- */
section('presence and the tick');

/*
 * The ceiling is measured over the last hour of watch and bonus rows, so a test
 * that wants to observe one tick in isolation has to age the earlier ones out
 * first. Without `quiet()`, the 40 MC watch row above eats the whole 30/hour
 * allowance and the tick correctly pays nothing.
 */
const quiet = () => write(`UPDATE coin_ledger SET created_at = now() - interval '2 hours'`);
const dueATick = () =>
  write(`UPDATE stream_sessions SET last_tick_at = now() - interval '4 minutes' WHERE ended_at IS NULL`);
const streakOf = async (userId: number) =>
  (await rows<{ streak: number }>('SELECT streak FROM presence_windows WHERE user_id = $1', [userId]))[0]?.streak;

check('no tick while the stream is offline', (await presence.runTick()).reason === 'not-live');

await presence.streamWentLive();
await presence.openWindow(alice.id, 'chat');
await presence.openWindow(bob.id, 'chat');   // bob has no Kick link
await quiet();

const beforeTick = (await coins.balanceOf(alice.id)).balance;
const tick = await presence.runTick();
check('the tick runs', tick.ran === true);
check('only the verified account is paid', tick.paid === 1, `paid ${tick.paid}`);
check('a member earns 1 MC', (await coins.balanceOf(alice.id)).balance === beforeTick + 1);
check('an unverified account earns nothing', (await coins.balanceOf(bob.id)).balance === 0);

const early = await presence.runTick();
check('a second tick inside the interval is refused', early.ran === false && early.reason === 'too-soon');

// Multipliers never stack: the highest single one applies.
await accounts.setSubState({ userId: alice.id, subActiveUntil: new Date(Date.now() + 86_400_000), source: 'webhook' });
check('a sub is 2x', accounts.multiplierFor(await accounts.subStateFor(alice.id)).value === 2);
await accounts.setSubState({ userId: alice.id, isVip: true, source: 'webhook' });
check('VIP replaces sub rather than stacking with it',
  accounts.multiplierFor(await accounts.subStateFor(alice.id)).value === 2.5);
await accounts.setSubState({ userId: alice.id, isVip: false, source: 'webhook' });

await quiet();
await dueATick();
const beforeSubTick = (await coins.balanceOf(alice.id)).balance;
await presence.runTick();
check('a sub earns 2 MC per tick', (await coins.balanceOf(alice.id)).balance === beforeSubTick + 2,
  `${beforeSubTick} -> ${(await coins.balanceOf(alice.id)).balance}`);

// Twenty consecutive ticks pays +10, times the multiplier.
await write(
  `UPDATE presence_windows SET streak = 19, last_tick_at = now() - interval '3 minutes' WHERE user_id = $1`,
  [alice.id],
);
await quiet();
await dueATick();
const beforeBonus = (await coins.balanceOf(alice.id)).balance;
const bonusTick = await presence.runTick();
check('the hour bonus is paid', bonusTick.bonuses === 1, JSON.stringify(bonusTick));
check('the bonus is (1 + 10) x 2', (await coins.balanceOf(alice.id)).balance === beforeBonus + 22,
  `${beforeBonus} -> ${(await coins.balanceOf(alice.id)).balance}`);
check('the streak resets after the bonus', (await streakOf(alice.id)) === 0);

// A gap breaks the run towards the next bonus.
await write(
  `UPDATE presence_windows SET streak = 5, last_tick_at = now() - interval '30 minutes' WHERE user_id = $1`,
  [alice.id],
);
await quiet();
await dueATick();
await presence.runTick();
check('a missed tick resets the streak to one', (await streakOf(alice.id)) === 1);

// The ceiling: 30/hour x 2 for a sub. Sitting one under it pays the remainder.
await quiet();
await coins.record({ userId: alice.id, delta: 59, kind: 'watch', reason: 'ceiling setup', multiplier: 2 });
await dueATick();
const atCeiling = (await coins.balanceOf(alice.id)).balance;
await presence.runTick();
check('the last coin under the ceiling is paid',
  (await coins.balanceOf(alice.id)).balance === atCeiling + 1,
  `${atCeiling} -> ${(await coins.balanceOf(alice.id)).balance}`);

await dueATick();
const overCeiling = (await coins.balanceOf(alice.id)).balance;
await presence.runTick();
check('nothing is paid over the ceiling',
  (await coins.balanceOf(alice.id)).balance === overCeiling,
  `${overCeiling} -> ${(await coins.balanceOf(alice.id)).balance}`);

// Offline closes every window, so no tick can pay after the stream stops.
await presence.streamWentOffline();
check('every window closes when the stream ends', (await presence.openWindowCount()) === 0);
check('no tick runs after the stream ends', (await presence.runTick()).ran === false);

/* -------------------------------------------------------------------------- */
section('freezing');

await presence.streamWentLive();
await accounts.freezeUser(alice.id, 'banned in chat', null);
await presence.openWindow(alice.id, 'chat');
await quiet();
const whileFrozen = (await coins.balanceOf(alice.id)).balance;
const frozenTick = await presence.runTick();
check('a frozen account earns nothing', frozenTick.paid === 0, JSON.stringify(frozenTick));
check('a frozen account keeps the coins it had',
  (await coins.balanceOf(alice.id)).balance === whileFrozen);
await accounts.unfreezeUser(alice.id);

/* -------------------------------------------------------------------------- */
section('clips');

const kick = await clips.createClip({
  kind: 'clip',
  url: 'https://kick.com/mattyspinss/clips/clip_TESTID123',
  title: 'A test clip',
  status: 'published',
});
check('a Kick clip is recognised', kick.source === 'kick' && kick.id === 'clip_TESTID123');
check('its embed is built from the link', kick.embedUrl.includes('player.kick.com/mattyspinss?clip='));
check('its thumbnail is built from the link', kick.thumbUrl.includes('clips.kick.com'));

const youtube = await clips.createClip({
  kind: 'big_win', url: 'https://www.youtube.com/watch?v=abc123XYZ',
  title: 'A big win', status: 'draft', bet: 20, payout: 5000,
});
check('a YouTube link is recognised', youtube.source === 'youtube' && youtube.id === 'yt_abc123XYZ');
check('a draft is not public', (await clips.publishedBigWins()).length === 0);
await clips.setClipStatus(youtube.id, 'published');
check('publishing makes it public', (await clips.publishedBigWins()).length === 1);
check('a short is 9:16', clips.parseSourceUrl('https://youtube.com/shorts/xyz789')?.aspect === '9:16');

let badHost: string | null = null;
try {
  await clips.createClip({ kind: 'clip', url: 'https://example.com/nope', title: 'x', status: 'draft' });
} catch (error) {
  badHost = (error as Error).message;
}
check('an unknown host is refused', badHost !== null, badHost ?? '');

let noFigures: string | null = null;
try {
  await clips.createClip({ kind: 'big_win', url: 'https://kick.com/a/clips/c1', title: 'x', status: 'draft' });
} catch (error) {
  noFigures = (error as Error).message;
}
check('a big win needs a bet and a payout', noFigures !== null, noFigures ?? '');

await clips.setClipPinned(kick.id, true);
check('a pin is counted', (await clips.pinnedCount()) === 1);
for (const n of [2, 3]) {
  const extra = await clips.createClip({
    kind: 'clip', url: `https://kick.com/m/clips/clip_p${n}`, title: `pin ${n}`, status: 'published',
  });
  await clips.setClipPinned(extra.id, true);
}
const fourth = await clips.createClip({
  kind: 'clip', url: 'https://kick.com/m/clips/clip_p4', title: 'pin 4', status: 'published',
});
let pinRefused: string | null = null;
try {
  await clips.setClipPinned(fourth.id, true);
} catch (error) {
  pinRefused = (error as Error).message;
}
check('a fourth pin is refused with a message', pinRefused !== null, pinRefused ?? '');

/* -------------------------------------------------------------------------- */
section('periods and prize tiers');

const week = await periods.createPeriod({
  type: 'weekly', startsAt: '2026-08-24T00:00:00Z', endsAt: '2026-08-30T23:59:59Z',
});
check('a period is created open', week.status === 'open');
check('a new period starts with no tiers', week.tiers.length === 0);
check('an empty period has a zero pot', week.pot === 0);

let secondOpen: string | null = null;
try {
  await periods.createPeriod({ type: 'weekly', startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-09-07T00:00:00Z' });
} catch (error) { secondOpen = (error as Error).message; }
check('a second open weekly board is refused', secondOpen !== null, secondOpen ?? '');

let backwards: string | null = null;
try {
  await periods.createPeriod({ type: 'monthly', startsAt: '2026-09-07T00:00:00Z', endsAt: '2026-09-01T00:00:00Z' });
} catch (error) { backwards = (error as Error).message; }
check('a period ending before it starts is refused', backwards !== null);

await periods.upsertTier({ periodId: week.id, rankFrom: 1, rankTo: 1, amount: 2000 });
await periods.upsertTier({ periodId: week.id, rankFrom: 2, rankTo: 2, amount: 1000 });
await periods.upsertTier({ periodId: week.id, rankFrom: 4, rankTo: 10, amount: 400 });

const withTiers = (await periods.periodById(week.id))!;
check('tiers are stored', withTiers.tiers.length === 3);
// 2000 + 1000 + (7 x 400)
check('the pot counts every rank a range covers', withTiers.pot === 5800, String(withTiers.pot));
check('a rank inside a range gets that amount', periods.prizeForRank(withTiers.tiers, 7) === 400);
check('a rank outside every tier gets nothing', periods.prizeForRank(withTiers.tiers, 11) === 0);
check('rank 3 is unpaid because no tier covers it', periods.prizeForRank(withTiers.tiers, 3) === 0);

let overlap: string | null = null;
try {
  await periods.upsertTier({ periodId: week.id, rankFrom: 5, rankTo: 12, amount: 250 });
} catch (error) { overlap = (error as Error).message; }
check('an overlapping tier is refused by the database', overlap !== null, overlap ?? '');

let badRange: string | null = null;
try {
  await periods.upsertTier({ periodId: week.id, rankFrom: 20, rankTo: 15, amount: 100 });
} catch (error) { badRange = (error as Error).message; }
check('a backwards rank range is refused', badRange !== null);

check('the open weekly board is the current one',
  (await periods.currentPeriod('weekly'))?.id === week.id);

await periods.setPeriodStatus(week.id, 'frozen');
const frozen = (await periods.periodById(week.id))!;
check('freezing records when it happened', frozen.status === 'frozen' && frozen.lockedAt !== null);
check('a frozen board is findable for claims', (await periods.frozenPeriod())?.id === week.id);

let lockedDates: string | null = null;
try {
  await periods.updatePeriodDates(week.id, '2026-08-01T00:00:00Z', '2026-08-05T00:00:00Z');
} catch (error) { lockedDates = (error as Error).message; }
check('a frozen board cannot have its dates moved', lockedDates !== null, lockedDates ?? '');

// Freezing frees the slot, and the next board can inherit the tiers.
const next = await periods.createPeriod({
  type: 'weekly', startsAt: '2026-08-31T00:00:00Z', endsAt: '2026-09-06T23:59:59Z',
  copyTiersFromLast: true,
});
check('the next board opens once the last is frozen', next.status === 'open');
check('tiers are copied forward', next.tiers.length === 3);
check('the copy carries the same pot', next.pot === 5800, String(next.pot));

await periods.setPeriodStatus(week.id, 'paid');
check('a paid board appears in the archive',
  (await periods.archivedPeriods()).some((p) => p.id === week.id));

/* -------------------------------------------------------------------------- */
section('the shop');

const catalogue = await shop.listItems(alice.id);
check('the launch catalogue is seeded', catalogue.length === 8, String(catalogue.length));

const entry = catalogue.find((i) => i.cost === 50)!;
const hoodie = catalogue.find((i) => i.name.includes('hoodie'))!;
const deck = catalogue.find((i) => i.name.includes('card deck'))!;
const colour = catalogue.find((i) => i.name.includes('chat colour'))!;

await coins.record({ userId: alice.id, delta: 5000, kind: 'adjustment', reason: 'shop test float' });
const startBalance = (await coins.balanceOf(alice.id)).balance;

const bought = await shop.redeem(alice.id, Number(entry.id));
check('an affordable item is redeemed', bought.ok === true, bought.ok ? '' : bought.error);
check('the coins are taken', (await coins.balanceOf(alice.id)).balance === startBalance - 50);
check('an entry is granted without review',
  bought.ok && bought.redemption.status === 'fulfilled', bought.ok ? bought.redemption.status : '');

const reviewed = await shop.redeem(alice.id, Number(hoodie.id));
check('a merch item queues for review',
  reviewed.ok && reviewed.redemption.status === 'pending', reviewed.ok ? reviewed.redemption.status : '');
check('it appears in the moderator queue', (await shop.pendingCount()) === 1);

// Stock actually moves.
const afterBuy = await shop.listItems(alice.id);
check('stock is decremented',
  afterBuy.find((i) => i.name.includes('hoodie'))!.stock === 13,
  String(afterBuy.find((i) => i.name.includes('hoodie'))!.stock));

const soldOut = await shop.redeem(alice.id, Number(deck.id));
check('an out-of-stock item is refused', soldOut.ok === false, soldOut.ok ? '' : soldOut.error);

// Cooldowns are personal and enforced.
const colourOnce = await shop.redeem(alice.id, Number(colour.id));
check('a cooldown item can be bought once', colourOnce.ok === true, colourOnce.ok ? '' : colourOnce.error);
const colourTwice = await shop.redeem(alice.id, Number(colour.id));
check('and refused inside its cooldown', colourTwice.ok === false, colourTwice.ok ? '' : colourTwice.error);
check('the cooldown is reported to the buyer',
  (await shop.listItems(alice.id)).find((i) => i.id === colour.id)!.cooldownDaysRemaining === 14);
check('but not to somebody else',
  (await shop.listItems(bob.id)).find((i) => i.id === colour.id)!.cooldownDaysRemaining === 0);

// Nobody can spend what they do not have.
const noCoins = await shop.redeem(bob.id, Number(hoodie.id));
check('no coins means no purchase', noCoins.ok === false, noCoins.ok ? '' : noCoins.error);
check('and nothing was taken', (await coins.balanceOf(bob.id)).balance === 0);
check('and no stock was consumed',
  (await shop.listItems(bob.id)).find((i) => i.name.includes('hoodie'))!.stock === 13);

// Rejecting refunds and restocks, in one write.
const beforeRefund = (await coins.balanceOf(alice.id)).balance;
const queued = (await shop.queue('pending'))[0];
const rejectedNoReason = await shop.resolveRedemption({
  id: Number(queued.id), status: 'rejected', handledBy: 'test',
});
check('a rejection without a reason is refused', rejectedNoReason.ok === false);

const rejected = await shop.resolveRedemption({
  id: Number(queued.id), status: 'rejected', handledBy: 'test', reason: 'Out of that size',
});
check('a rejection succeeds with one', rejected.ok === true);
check('the coins come back', (await coins.balanceOf(alice.id)).balance === beforeRefund + hoodie.cost);
check('the stock comes back',
  (await shop.listItems(alice.id)).find((i) => i.name.includes('hoodie'))!.stock === 14);
check('the queue is empty again', (await shop.pendingCount()) === 0);

const twice = await shop.resolveRedemption({
  id: Number(queued.id), status: 'fulfilled', handledBy: 'test',
});
check('a handled redemption cannot be handled again', twice.ok === false);

check('the member sees their redemptions', (await shop.redemptionsFor(alice.id)).length === 3);

/* -------------------------------------------------------------------------- */
section('operational switches');

check('games are on by default', (await settings.gamesAreKilled()) === false);
await settings.setGamesKilled(true, 'test');
check('the kill switch persists', (await settings.gamesAreKilled()) === true);
check('and makes every game unplayable', (await settings.gameIsPlayable('keno')) === false);
await settings.setGamesKilled(false, 'test');

await settings.setGameEnabled('dice', false, 'test');
check('one game can be switched off', (await settings.gameIsPlayable('dice')) === false);
check('without affecting the others', (await settings.gameIsPlayable('keno')) === true);
await settings.setGameEnabled('dice', true, 'test');
check('and switched back on', (await settings.gameIsPlayable('dice')) === true);

/* -------------------------------------------------------------------------- */
section('rate limits');

const flood: boolean[] = [];
for (let i = 0; i < 3; i += 1) {
  const r = await play.playRound({
    userId: bob.id, game: 'limbo', bet: 10, idempotencyKey: 'flood-' + i, resolve: lose,
  });
  flood.push(r.ok === false && r.error === 'rate-limited');
}
check('the limit is not hit by ordinary play', flood.every((x) => x === false));

/* -------------------------------------------------------------------------- */
section('blackjack');

await coins.record({ userId: bob.id, delta: 4000, kind: 'adjustment', reason: 'blackjack float' });
const bjStart = (await coins.balanceOf(bob.id)).balance;

const noBet = await blackjack.openBlackjack({
  userId: bob.id, bets: [{ main: 0, pairs: 0, plusThree: 0 }], idempotencyKey: 'bj-none',
});
check('a hand with no main bet is refused', 'ok' in noBet && noBet.ok === false);

const sideOnly = await blackjack.openBlackjack({
  userId: bob.id, bets: [{ main: 0, pairs: 20, plusThree: 0 }], idempotencyKey: 'bj-side',
});
check('a side bet without a main bet is refused', 'ok' in sideOnly && sideOnly.ok === false);

const tooBig = await blackjack.openBlackjack({
  userId: bob.id, bets: [{ main: 500, pairs: 0, plusThree: 0 }], idempotencyKey: 'bj-big',
});
check('a stake over the cap is refused', 'ok' in tooBig && tooBig.ok === false);

const dealt = await blackjack.openBlackjack({
  userId: bob.id, bets: [{ main: 20, pairs: 10, plusThree: 10 }], idempotencyKey: 'bj-1',
});
check('a hand is dealt', !('ok' in dealt), 'ok' in dealt ? dealt.detail ?? dealt.error : '');

if (!('ok' in dealt)) {
  check('the stake left the balance',
    (await coins.balanceOf(bob.id)).balance === bjStart - 40,
    `${bjStart} -> ${(await coins.balanceOf(bob.id)).balance}`);
  check('the player got two cards', dealt.state.seats[0].hands[0].cards.length === 2);
  check('the dealer got two cards', dealt.state.dealer.length === 2);
  check('the hole card is hidden', dealt.state.holeHidden === true);
  check('side bets resolved at the deal', dealt.state.seats[0].notes.length === 2,
    dealt.state.seats[0].notes.join(' / '));

  const replay = await blackjack.openBlackjack({
    userId: bob.id, bets: [{ main: 20, pairs: 10, plusThree: 10 }], idempotencyKey: 'bj-1',
  });
  check('a repeated deal is the same hand', !('ok' in replay) && replay.roundId === dealt.roundId);

  const second = await blackjack.openBlackjack({
    userId: bob.id, bets: [{ main: 20, pairs: 0, plusThree: 0 }], idempotencyKey: 'bj-2',
  });
  check('a second hand is refused while one is live', 'ok' in second && second.error === 'hand-in-progress');
}

// Play a hand out to settlement, standing every time.
let live = await blackjack.currentBlackjack(bob.id);
let guard = 0;
while (live && live.actions.length > 0 && guard++ < 30) {
  const next = await blackjack.actBlackjack({ userId: bob.id, action: 'stand' });
  if ('ok' in next) break;
  live = next;
}
check('the hand settles', live !== null && live.state.phase === 'settled', live?.state.phase);
check('the hole card is turned over', live !== null && live.state.holeHidden === false);
check('the dealer reached 17 or more, or nobody was live',
  live !== null && (bjTotal(live.state.dealer) >= 17 || live.state.seats.every((s) =>
    s.hands.every((h) => h.result === 'lose'))),
  live ? String(bjTotal(live.state.dealer)) : '');
check('every hand has a result',
  live !== null && live.state.seats.every((s) => s.hands.every((h) => h.result !== null)));
check('the round is on the shared history',
  (await play.recentRounds(bob.id, 5)).some((r) => r.game === 'blackjack'));

const afterSettle = (await coins.balanceOf(bob.id)).balance;
check('the balance moved by stake minus return',
  afterSettle === bjStart - 40 + (live?.returned ?? 0),
  `staked 40, returned ${live?.returned}, balance ${bjStart} -> ${afterSettle}`);

const noHand = await blackjack.actBlackjack({ userId: bob.id, action: 'hit' });
check('acting with no hand on the table is refused', 'ok' in noHand && noHand.error === 'no-hand');

// The same seed and nonce must rebuild the same cards.
const { buildShoe } = await import('../lib/fairness');
const shoeA = buildShoe('s', 'c', 7);
const shoeB = buildShoe('s', 'c', 7);
check('a shoe is reproducible from its seed',
  JSON.stringify(shoeA) === JSON.stringify(shoeB));
check('a shoe holds 312 cards', shoeA.length === 312);

// The dealer peeks. Find a shoe whose first four cards give the dealer a
// natural, then confirm the round is over before the player can act — a
// no-peek deal would let them double into a hand that had already lost.
{
  const { openRound } = await import('../lib/blackjack');
  let peeked = false;
  let checkedNonce = -1;
  for (let n = 0; n < 400; n += 1) {
    const shoe = buildShoe('peek', 'peek', n);
    const dealerCards = [shoe[1], shoe[3]];
    const ten = (r: string) => ['10', 'J', 'Q', 'K'].includes(r);
    const natural =
      (dealerCards[0].r === 'A' && ten(dealerCards[1].r)) ||
      (dealerCards[1].r === 'A' && ten(dealerCards[0].r));
    if (!natural) continue;
    checkedNonce = n;
    const state = openRound(shoe, [{ main: 10, pairs: 0, plusThree: 0 }]);
    peeked = state.phase !== 'playing' && state.activeSeat === -1 && !state.holeHidden;
    break;
  }
  check('a dealer natural ends the round before anyone acts', peeked,
    `nonce ${checkedNonce}`);
}

/* -------------------------------------------------------------------------- */
section('admin figures');

const flow = await coins.coinFlow(new Date(Date.now() - 7 * 86_400_000));
check('coin flow reports minted and destroyed',
  typeof flow.minted === 'number' && typeof flow.destroyed === 'number', JSON.stringify(flow));
check('rounds today is counted', (await play.roundsToday()) > 0);
check('the round feed masks usernames',
  (await play.biggestRoundsToday(5)).every((r) => r.masked !== r.player));
check('the member list carries balances',
  (await accounts.recentUsers(10)).some((u) => u.balance > 0));

console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
