/**
 * The milestone cycles, against a real Postgres.
 *
 * What is being checked is who can be paid what and when, and most of that rests
 * on a unique index and on which snapshot a read lands on, so a mock would prove
 * nothing. Razed itself is stubbed: the point is what we do with its answer.
 *
 *   DATABASE_URL=postgres://... npm run milestones:smoke
 *
 * Like db:smoke it drops and recreates the schema, so point it at a throwaway
 * database and never at production.
 */
import { pool, ready, rows, write } from '../lib/db';
import * as accounts from '../lib/store/accounts';
import {
  LIFETIME_CYCLE,
  buildLadder,
  claimCycles,
  claimTier,
  claimsFor,
  claimsInCycle,
  claimsForCycle,
  findMembersByHandle,
  grantLifetime,
  isLifetimeMember,
  listLifetimeMembers,
  listTiers,
  revokeLifetime,
} from '../lib/store/milestones';
import { approveLink, submitLink } from '../lib/store/razed-links';
import { monthKey, monthPeriod, syncLifetime, syncMonth } from '../lib/store/razed-snapshots';
import { wagerStateFor } from '../lib/store/wager';

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

await pool()!.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
await ready();

/* Razed, stubbed: the month's window gets `monthRows`, the walk's newest window
   gets the lifetime figures, and everything older is empty so the walk stops. */
process.env.RAZED_REFERRAL_KEY = 'smoke';
let monthRows: Array<{ username: string; wagered: string }> = [];
const lifetimeRows = [
  { username: 'ada_razed', wagered: '30000.00' },
  { username: 'lin_razed', wagered: '30000.00' },
];
const asked: string[] = [];
const month = monthKey();
globalThis.fetch = (async (input: string | URL) => {
  const url = new URL(String(input));
  const from = url.searchParams.get('from') ?? '';
  asked.push(`${from} -> ${url.searchParams.get('to')}`);
  const isMonth = from.startsWith(`${month}-01`);
  const isNewest = new Date(from.slice(0, 10)).getTime() > Date.now() - 46 * 86_400_000;
  const data = isMonth ? monthRows : isNewest ? lifetimeRows : [];
  return new Response(JSON.stringify({ data, total: data.length, last_page: 1 }), { status: 200 });
}) as typeof fetch;

const ada = await accounts.ensureUser({ discordId: 'd-ada', discordUsername: 'ada' });
const lin = await accounts.ensureUser({ discordId: 'd-lin', discordUsername: 'lin' });
await submitLink({ userId: ada.id, username: 'ada_razed', matchedWagered: 30000 });
await submitLink({ userId: lin.id, username: 'lin_razed', matchedWagered: 30000 });
await approveLink(ada.id, 'smoke');
await approveLink(lin.id, 'smoke');

const tiers = await listTiers();
const rookie = tiers.find((t) => t.threshold === 10000)!;
const hustler = tiers.find((t) => t.threshold === 25000)!;

/* -------------------------------------------------------------------------- */
section('the running month');

let state = await wagerStateFor(ada.id);
check('monthly by default', state.milestone.mode === 'monthly');
check('the cycle is this month', state.milestone.cycle === month);
check('no snapshot reads as unknown, not zero', state.milestone.wagered === null);

monthRows = [{ username: 'ada_razed', wagered: '12000.00' }];
const firstSync = await syncMonth();
check('the month syncs', firstSync.ok);
check(
  'it reads the 1st through today, to the last second',
  asked.at(-1)?.startsWith(`${month}-01 00:00:00 -> `) && asked.at(-1)?.endsWith('23:59:59'),
  asked.at(-1),
);

state = await wagerStateFor(ada.id);
check('the figure comes from the month', state.milestone.wagered === 12000);

const absent = await wagerStateFor(lin.id);
check('absent from the month is a real zero', absent.milestone.wagered === 0);

const lifetimeSync = await syncLifetime();
check('the lifetime walk still syncs', lifetimeSync.ok);
state = await wagerStateFor(ada.id);
check('lifetime does not leak into the month', state.milestone.wagered === 12000);
check('and the lifetime figure is still there', state.lifetime === 30000);

monthRows = [{ username: 'ada_razed', wagered: '13000.00' }];
await syncMonth();
const kept = await rows<{ n: number }>(
  'SELECT count(*)::int AS n FROM razed_snapshots WHERE period = $1',
  [monthPeriod(month)],
);
check('only the newest snapshot of a month is kept', kept[0].n === 1, String(kept[0].n));
check('and it is the one read', (await wagerStateFor(ada.id)).milestone.wagered === 13000);

const boards = await rows<{ n: number }>(
  `SELECT count(*)::int AS n FROM razed_snapshots WHERE period ~ '^[0-9]{4}-[0-9]{2}$'`,
);
check('nothing is filed where the badge rules look for frozen boards', boards[0].n === 0);

/* -------------------------------------------------------------------------- */
section('claiming once a month');

const claim = (userId: number, tierId: number, cycle: string, wagered: number) =>
  claimTier({ userId, tierId, cycle, wagered, razedApproved: true });

const first = await claim(ada.id, rookie.id, month, 13000);
check('a reached tier can be claimed', first.ok);
const again = await claim(ada.id, rookie.id, month, 13000);
check('not twice in a month', !again.ok && again.error === 'already-claimed');
const short = await claim(ada.id, hustler.id, month, 13000);
check('an unreached tier cannot', !short.ok && short.error === 'not-reached');

const nextMonth = '2099-01';
const reset = await claim(ada.id, rookie.id, nextMonth, 10000);
check('the same tier is claimable again next month', reset.ok);

const adaClaims = await claimsFor(ada.id);
const thisCycle = claimsForCycle(adaClaims, month);
check('a month only sees its own claims', thisCycle.length === 1);
const ladder = buildLadder(tiers, claimsForCycle(adaClaims, '2099-02'), 10000, true);
check(
  'a fresh month starts with the tier claimable',
  ladder.find((r) => r.tier.id === rookie.id)?.state === 'claimable',
);

/* -------------------------------------------------------------------------- */
section('the lifetime list');

check('nobody is on it to begin with', !(await isLifetimeMember(lin.id)));
check('a name resolves to one account', (await findMembersByHandle('LIN_RAZED'))[0]?.userId === lin.id);
check('an inexact name does not', (await findMembersByHandle('lin_raz')).length === 0);

check('adding reports it was new', await grantLifetime(lin.id, 'smoke'));
check('adding twice reports it was not', !(await grantLifetime(lin.id, 'smoke')));

state = await wagerStateFor(lin.id);
check('a member is on the lifetime ladder', state.milestone.mode === 'lifetime');
check('filed under the lifetime cycle', state.milestone.cycle === LIFETIME_CYCLE);
check('measured against their lifetime total', state.milestone.wagered === 30000);
check('with no reset date', state.milestone.resetsAt === null);

const listed = await listLifetimeMembers();
check('the list shows them with their figure', listed[0]?.wagered === 30000, JSON.stringify(listed));

const lifetimeClaim = await claim(lin.id, rookie.id, LIFETIME_CYCLE, 30000);
check('a member can claim', lifetimeClaim.ok);
const lifetimeAgain = await claim(lin.id, rookie.id, LIFETIME_CYCLE, 30000);
check('but only once', !lifetimeAgain.ok && lifetimeAgain.error === 'already-claimed');

// Claimed on a monthly ladder first, then added: that tier is already spent.
await grantLifetime(ada.id, 'smoke');
const spent = await claim(ada.id, rookie.id, LIFETIME_CYCLE, 30000);
check('a tier claimed on a monthly ladder is spent', !spent.ok && spent.error === 'already-claimed');
const unspent = await claim(ada.id, hustler.id, LIFETIME_CYCLE, 30000);
check('the rest of the ladder is still open', unspent.ok);

const asMember = buildLadder(tiers, claimsForCycle(await claimsFor(ada.id), LIFETIME_CYCLE), 30000, true);
check('the ladder shows it as claimed', asMember.find((r) => r.tier.id === rookie.id)?.state === 'pending');

// A rejected monthly claim is not a tier spent.
await write(`UPDATE milestone_claims SET status = 'rejected' WHERE user_id = $1 AND cycle = $2`, [
  ada.id,
  month,
]);
await write(`UPDATE milestone_claims SET status = 'rejected' WHERE user_id = $1 AND cycle = $2`, [
  ada.id,
  nextMonth,
]);
const afterReject = await claim(ada.id, rookie.id, LIFETIME_CYCLE, 30000);
check('a rejected claim does not spend the tier', afterReject.ok);

await revokeLifetime(lin.id);
state = await wagerStateFor(lin.id);
check('removal puts them back on the monthly ladder', state.milestone.mode === 'monthly');
check('and keeps their claims', (await claimsFor(lin.id)).length === 1);
const backOnMonthly = await claim(lin.id, rookie.id, month, 10000);
check('a monthly claim is open to them again', backOnMonthly.ok);

/* -------------------------------------------------------------------------- */
section('every claim, by month');

const cycles = await claimCycles();
check(
  'the newest month comes first and lifetime last',
  cycles[0]?.cycle === nextMonth && cycles.at(-1)?.cycle === LIFETIME_CYCLE,
  cycles.map((c) => c.cycle).join(','),
);

const thisMonth = cycles.find((c) => c.cycle === month);
check('a month counts its claims and members', thisMonth?.claims === 2 && thisMonth?.members === 2);
check('rejected money is kept apart', thisMonth?.rejected === rookie.reward);
check('pending money is kept apart', thisMonth?.pending === rookie.reward);

const inMonth = await claimsInCycle(month);
check('a month lists everyone in it', new Set(inMonth.map((c) => c.username)).size === 2);
check('and only that month', (await claimsInCycle(nextMonth)).length === 1);
check('with the Razed name to pay', inMonth.every((c) => c.razedUsername?.endsWith('_razed')));

console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
