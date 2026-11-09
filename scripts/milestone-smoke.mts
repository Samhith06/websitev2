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
  searchMembers,
} from '../lib/store/milestones';
import { approveLink, submitLink } from '../lib/store/razed-links';
import {
  LAST_30_DAYS_PERIOD,
  LAST_MONTH_PERIOD,
  monthKey,
  monthPeriod,
  syncBadgeWindows,
  syncLifetime,
  syncMonth,
} from '../lib/store/razed-snapshots';
import { evaluateBadges } from '../lib/store/badge-rules';
import { announceLeaderboard, chunkLines, ordinal } from '../lib/store/leaderboard-announce';
import { PeriodError, archivedPeriods, frozenPeriod, recordPastBoard } from '../lib/store/periods';
import { periodLabel } from '../lib/format';
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

const linaa = await accounts.ensureUser({ discordId: 'd-linaa', discordUsername: 'linaa' });
const inlin = await accounts.ensureUser({ discordId: 'd-inlin', discordUsername: 'inlin' });
const percent = await accounts.ensureUser({ discordId: 'd-pct', discordUsername: 'li%n' });
const found = (query: string) => searchMembers(query).then((all) => all.map((m) => m.userId));

check('one letter searches nothing', (await found('l')).length === 0);
check('part of a name finds it', (await found('inl')).includes(inlin.id));
check('part of a Razed name finds the account', (await found('lin_raz')).includes(lin.id));
check('the search ignores case', (await found('LINAA')).includes(linaa.id));
check('a Discord id finds the account', (await found('d-linaa'))[0] === linaa.id);
check('an exact name comes first', (await found('lin'))[0] === lin.id);
const startsFirst = await found('li');
check('a name starting with it beats one containing it',
  startsFirst.indexOf(linaa.id) < startsFirst.indexOf(inlin.id));
check('a % is searched for rather than matching everything',
  (await found('i%n')).join() === String(percent.id));
const linMatch = (await searchMembers('lin_razed'))[0];
check('a match carries its other names',
  linMatch?.username === 'lin' && linMatch?.razedUsername === 'lin_razed');
check('searching adds nobody', !(await isLifetimeMember(lin.id)));
check('a match says it is not on the list', linMatch?.onList === false);

check('adding reports it was new', await grantLifetime(lin.id, 'smoke'));
check('adding twice reports it was not', !(await grantLifetime(lin.id, 'smoke')));
check('a match says it is on the list', (await searchMembers('lin_razed'))[0]?.onList === true);

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

/* -------------------------------------------------------------------------- */
section('VIP, Champion and Podium');

/** Fresh members with approved links, so nothing above decides what these hold. */
const member = async (name: string) => {
  const user = await accounts.ensureUser({ discordId: `d-${name}`, discordUsername: name });
  await submitLink({ userId: user.id, username: `${name}_razed`, matchedWagered: 0 });
  await approveLink(user.id, 'smoke');
  return user;
};
const holds = async (userId: number, slug: string) =>
  (
    await rows(
      `SELECT 1 FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
        WHERE ub.user_id = $1 AND b.slug = $2`,
      [userId, slug],
    )
  ).length > 0;

const lastMonthOnly = await member('lastmonth');
const recentOnly = await member('recent');
const bothWindows = await member('bothwindows');
const justShort = await member('justshort');
const unapproved = await accounts.ensureUser({ discordId: 'd-pending', discordUsername: 'pending' });
await submitLink({ userId: unapproved.id, username: 'pending_razed', matchedWagered: 0 });

const report = async (slug: string) =>
  (await evaluateBadges()).rules.find((rule) => rule.slug === slug);

check('VIP says it has no data before the first sync', (await report('vip'))?.status === 'no-data');

// Razed, restubbed: answers by which window was asked for, and remembers it.
const windowsAsked: string[] = [];
const fixedNow = new Date('2026-03-15T12:34:56Z');
const windowStub = (async (input: string | URL) => {
  const url = new URL(String(input));
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  windowsAsked.push(`${from} -> ${to}`);
  const data = from.startsWith('2026-02-01')
    ? [
        { username: 'lastmonth_razed', wagered: '40000.00' },
        { username: 'BothWindows_Razed', wagered: '50000.00' },
        { username: 'justshort_razed', wagered: '39999.99' },
        { username: 'pending_razed', wagered: '90000.00' },
      ]
    : [
        { username: 'recent_razed', wagered: '41000.00' },
        { username: 'bothwindows_razed', wagered: '60000.00' },
        { username: 'justshort_razed', wagered: '39999.99' },
      ];
  return new Response(JSON.stringify({ data, total: data.length, last_page: 1 }), { status: 200 });
}) as typeof fetch;
globalThis.fetch = windowStub;

const synced = await syncBadgeWindows(fixedNow);
check('both windows sync', synced.length === 2 && synced.every((outcome) => outcome.ok));
check(
  'last month is the whole previous month, across a short February',
  windowsAsked[0] === '2026-02-01 00:00:00 -> 2026-02-28 23:59:59',
  windowsAsked[0],
);
check(
  'the rolling window is exactly the last 30 days',
  windowsAsked[1] === '2026-02-13 12:34:56 -> 2026-03-15 12:34:56',
  windowsAsked[1],
);
await syncBadgeWindows(fixedNow);
const windowSnapshots = await rows<{ n: number }>(
  `SELECT count(*)::int AS n FROM razed_snapshots WHERE period IN ($1, $2)`,
  [LAST_MONTH_PERIOD, LAST_30_DAYS_PERIOD],
);
check('only the newest of each window is kept', windowSnapshots[0].n === 2, String(windowSnapshots[0].n));
const januaryWindow: string[] = [];
globalThis.fetch = (async (input: string | URL) => {
  const url = new URL(String(input));
  januaryWindow.push(url.searchParams.get('from') ?? '');
  return new Response(JSON.stringify({ data: [], total: 0, last_page: 1 }), { status: 200 });
}) as typeof fetch;
const newYear = new Date('2026-01-10T00:00:00Z');
await syncBadgeWindows(newYear);
check('in January, last month is the December before', januaryWindow[0] === '2025-12-01 00:00:00', januaryWindow[0]);

// A failed read keeps the window's last good figures.
globalThis.fetch = windowStub;
await syncBadgeWindows(fixedNow);
globalThis.fetch = (async () => new Response('nope', { status: 400 })) as typeof fetch;
const failedWindows = await syncBadgeWindows(fixedNow);
check('a failed read is reported', failedWindows.every((outcome) => !outcome.ok));
globalThis.fetch = windowStub;

await evaluateBadges();
check('$40,000 last month earns VIP', await holds(lastMonthOnly.id, 'vip'));
check('$40,000 in the last 30 days earns VIP', await holds(recentOnly.id, 'vip'));
check('both at once earns it once, whatever the name case', await holds(bothWindows.id, 'vip'));
check('a cent short does not', !(await holds(justShort.id, 'vip')));
check('an unapproved link does not', !(await holds(unapproved.id, 'vip')));
check('the description says so', (await rows<{ description: string }>(
  `SELECT description FROM badges WHERE slug = 'vip'`,
))[0]?.description === '$40,000 last month or in the last 30 days');

// Two frozen boards, the winner of each different, and the older written second.
const champNew = await member('champnew');
const secondNew = await member('secondnew');
const thirdNew = await member('thirdnew');
const fourthNew = await member('fourthnew');
const champOld = await member('champold');
const podiumOld = await member('podiumold');

check('Champion says it has no data with no frozen board', (await report('champion'))?.status === 'no-data');

const frozenBoard = async (type: string, starts: string, ends: string, names: string[]) => {
  const standings = names.map((name, index) => ({ rank: index + 1, username: `${name}_razed` }));
  await write(
    `INSERT INTO lb_periods (type, starts_at, ends_at, status, frozen_standings, frozen_at)
     VALUES ($1, $2, $3, 'frozen', $4::jsonb, now())`,
    [type, starts, ends, JSON.stringify(standings)],
  );
};
await frozenBoard('monthly', '2026-02-01', '2026-03-01', ['champnew', 'secondnew', 'thirdnew', 'fourthnew']);
await frozenBoard('monthly', '2026-01-01', '2026-02-01', ['champold', 'podiumold']);
await frozenBoard('weekly', '2026-03-02', '2026-03-09', ['podiumold']);

await evaluateBadges();
check('the last board’s winner is Champion', await holds(champNew.id, 'champion'));
check('and on the Podium too', await holds(champNew.id, 'podium'));
check('second is not Champion', !(await holds(secondNew.id, 'champion')));
check('second is on the Podium', await holds(secondNew.id, 'podium'));
check('third is on the Podium', await holds(thirdNew.id, 'podium'));
check('fourth is not', !(await holds(fourthNew.id, 'podium')));
check('an older board’s winner earns nothing from it', !(await holds(champOld.id, 'champion')));
check('nor an older board’s runner-up', !(await holds(podiumOld.id, 'podium')));
check('a newer weekly board is not the last leaderboard', !(await holds(podiumOld.id, 'champion')));

// A past month recorded after the fact: results only, nothing owed.
const pastWinner = await member('pastwinner');
const pastBoard = {
  startsAt: '2025-12-01T00:00:00.000Z',
  endsAt: '2025-12-31T23:59:59.000Z',
  standings: [
    { rank: 1, username: 'pastwinner_razed', maskedUsername: 'past****', wagered: 9000, prize: 0 },
  ] as never,
  createdBy: 'smoke',
};
await recordPastBoard(pastBoard);
const archivedBoard = (await archivedPeriods()).find((p) => p.startsAt === pastBoard.startsAt);
check('a past month goes in the archive', archivedBoard != null);
check('as a whole calendar month', periodLabel(archivedBoard!.startsAt, archivedBoard!.endsAt) === 'December 2025');
check('with no prize tiers', archivedBoard!.tiers.length === 0);
const stillFrozen = await frozenPeriod();
check('it is not the board awaiting payout', stillFrozen?.startsAt !== pastBoard.startsAt);
await evaluateBadges();
check('an older past month does not outrank the last board', !(await holds(pastWinner.id, 'champion')));

let overlapRefused = false;
try {
  await recordPastBoard({ ...pastBoard, startsAt: '2025-12-15T00:00:00.000Z', endsAt: '2026-01-14T23:59:59.000Z' });
} catch (error) {
  overlapRefused = error instanceof PeriodError;
}
check('a month a board already covers is refused', overlapRefused);

// The sweep still only awards.
await write(
  `INSERT INTO lb_periods (type, starts_at, ends_at, status, frozen_standings, frozen_at)
   VALUES ('monthly', '2026-03-01', '2026-04-01', 'frozen', $1::jsonb, now())`,
  [JSON.stringify([{ rank: 1, username: 'champold_razed' }])],
);
await evaluateBadges();
check('the next board’s winner becomes Champion', await holds(champOld.id, 'champion'));
check('and the last one keeps theirs', await holds(champNew.id, 'champion'));

/* -------------------------------------------------------------------------- */
section('Discord leaderboard updates');

const WEBHOOK = 'https://discord.com/api/webhooks/1/abc';
const noonBoard = new Date();
noonBoard.setUTCHours(12, 0, 0, 0);
const day = (offset: number, hour = 12) => {
  const date = new Date(noonBoard.getTime() + offset * 86_400_000);
  date.setUTCHours(hour);
  return date;
};

await write(`UPDATE lb_periods SET status = 'archived' WHERE status = 'open'`);
const openBoard = await rows<{ id: string }>(
  `INSERT INTO lb_periods (type, starts_at, ends_at, status)
   VALUES ('monthly', $1, $2, 'open') RETURNING id::text`,
  [day(-10).toISOString(), day(10).toISOString()],
);
await write(`INSERT INTO prize_tiers (period_id, rank_from, rank_to, amount) VALUES ($1, 1, 1, 1000)`, [
  openBoard[0].id,
]);

let boardNow: Array<[string, string]> = [];
let razedAsked = 0;
let razedFails = false;
let webhookFails = false;
const posts: Array<Record<string, unknown>> = [];
globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
  const target = String(input);
  if (target.startsWith(WEBHOOK)) {
    if (webhookFails) return new Response('no', { status: 500 });
    posts.push(JSON.parse(String(init?.body)));
    return new Response(null, { status: 204 });
  }
  razedAsked += 1;
  if (razedFails) return new Response('no', { status: 400 });
  const data = boardNow.map(([username, wagered]) => ({ username, wagered }));
  return new Response(JSON.stringify({ data, total: data.length, last_page: 1 }), { status: 200 });
}) as typeof fetch;

const take = () => posts.splice(0).map((p) => p.content as string).filter(Boolean);
const beforeDaily = day(0, 12);

delete process.env.DISCORD_LEADERBOARD_WEBHOOK_URL;
boardNow = [['alexander', '500'], ['benjamin', '400'], ['christopher', '300']];
await announceLeaderboard(beforeDaily);
check('with no webhook nothing is posted and Razed is not asked', posts.length === 0 && razedAsked === 0);

process.env.DISCORD_LEADERBOARD_WEBHOOK_URL = 'https://example.com/steal';
await announceLeaderboard(beforeDaily);
check('a non-Discord address is ignored', posts.length === 0 && razedAsked === 0);

process.env.DISCORD_LEADERBOARD_WEBHOOK_URL = WEBHOOK;
process.env.LEADERBOARD_DAILY_HOUR_UTC = '18';

const firstLook = await announceLeaderboard(beforeDaily);
check('the first look only records the order', firstLook.climbs === 0 && posts.length === 0);

await announceLeaderboard(beforeDaily);
check('no change posts nothing', posts.length === 0);

boardNow = [['alexander', '500'], ['christopher', '450'], ['benjamin', '400']];
const climbed = await announceLeaderboard(beforeDaily);
const climbText = take().join('\n');
check('a climb is announced once', climbed.climbs === 1);
check(
  'saying who passed whom, and the new place',
  climbText.includes('just passed **benj\\*\\*\\*\\***') && climbText.includes('**2nd**'),
  climbText,
);
check('names are masked with the stars escaped', climbText.includes('chri\\*\\*\\*'), climbText);
check('real names are not sent', !climbText.includes('christopher') && !climbText.includes('benjamin'));
await announceLeaderboard(beforeDaily);
check('and not repeated', posts.length === 0);

boardNow = [['newcomer', '900'], ['alexander', '500'], ['christopher', '450'], ['benjamin', '400']];
await announceLeaderboard(beforeDaily);
const entered = take().join('\n');
check('a newcomer straight into first passes everyone', entered.includes('**1st**') && entered.includes('alex'), entered);

webhookFails = true;
boardNow = [['alexander', '950'], ['newcomer', '900'], ['christopher', '450'], ['benjamin', '400']];
const failedPost = await announceLeaderboard(beforeDaily);
check('a failed post does not throw', failedPost.climbs === 0);
webhookFails = false;
const retried = await announceLeaderboard(beforeDaily);
check('and is retried next run', retried.climbs === 1 && take().length === 1);

razedFails = true;
await announceLeaderboard(beforeDaily);
razedFails = false;
const afterOutage = await announceLeaderboard(beforeDaily);
check('a Razed failure does not look like everyone dropped out', afterOutage.climbs === 0 && posts.length === 0);

check('before the daily hour there is no card', !(await announceLeaderboard(day(0, 17))).standings);
const daily = await announceLeaderboard(day(0, 18));
check('after it the standings are posted', daily.standings === true);
const card = posts.splice(0)[0] as { embeds: Array<Record<string, any>>; allowed_mentions: unknown };
check('as a card with the top places', card.embeds[0].fields.length === 4);
check('with a medal and the prize for first', /🥇/.test(card.embeds[0].fields[0].name) && /🏆 \$1,000/.test(card.embeds[0].fields[0].value), JSON.stringify(card.embeds[0].fields[0]));
check('and mentions switched off', JSON.stringify(card.allowed_mentions) === '{"parse":[]}');
check('only once a day', !(await announceLeaderboard(day(0, 20))).standings && posts.length === 0);
check('and again the next day', (await announceLeaderboard(day(1, 19))).standings === true);
posts.splice(0);

check('a board that has ended posts nothing', (await announceLeaderboard(day(11))).standings === false && posts.length === 0);

const manyLines = Array.from({ length: 60 }, (_, i) => `line ${i} `.padEnd(100, 'x'));
const chunks = chunkLines('heading', manyLines);
check('long updates are split within Discord’s limit', chunks.length > 1 && chunks.every((c) => c.length <= 2000));
check('with nothing lost', chunks.join('\n').split('\n').length === 61);
check('ordinals read correctly', ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd'].join() ===
  [1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal).join());

console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
