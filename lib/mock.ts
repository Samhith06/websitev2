/**
 * The single mock-data file (UI Spec §0).
 *
 * Every screen through step 8 of the build order reads from here. When the
 * backend lands you change this module's exports to real queries — you do not
 * change forty components.
 *
 * Dates are generated relative to load, so countdowns, "4 minutes ago" and the
 * period clock all behave like the real thing while clicking through.
 */
import type {
  AuditEntry, Casino, Clip, FeedHealth, GameConfig, GameRound, Giveaway, LedgerEntry,
  Period, PrizeClaim, PrizeTier, RazedPlayer, Redemption, SeedPair, ShopItem,
  StreamState, VerificationState, Viewer,
} from './types';

const now = Date.now();
const mins = (n: number) => new Date(now + n * 60_000).toISOString();
const hours = (n: number) => mins(n * 60);
const days = (n: number) => hours(n * 24);

/* -------------------------------------------------------------------------- */
/* The two clocks                                                             */
/* -------------------------------------------------------------------------- */

/** Flip to false to see every offline state the spec calls for. */
export const IS_LIVE = true;

export const stream: StreamState = {
  live: IS_LIVE,
  title: 'BONUS HUNT OPENING — 20 BONUSES, $12K START',
  viewers: 1_284,
  startedAt: IS_LIVE ? mins(-97) : null,
  thumbUrl: '/brand/stream-thumb.svg',
  channel: 'mattyspinss',
  nextStreamAt: days(1),
  lastVodUrl: 'https://kick.com/mattyspinss',
  lastVodThumb: '/brand/stream-thumb.svg',
  lastVodTitle: 'Tuesday bonus hunt — the $48,000 Gates finish',
};

export const schedule = [
  { day: 'Tue', time: '8:00 PM', note: 'Bonus hunt', platform: 'Kick' },
  { day: 'Thu', time: '8:00 PM', note: 'Viewer slot picks', platform: 'Kick' },
  { day: 'Sat', time: '7:00 PM', note: 'Big bet Saturday', platform: 'Kick' },
];

/* -------------------------------------------------------------------------- */
/* The viewer                                                                 */
/* -------------------------------------------------------------------------- */

export const viewer: Viewer = {
  signedIn: true,
  discordId: '204812771230842881',
  discordUsername: 'reelchaser',
  avatarUrl: '/brand/avatar.svg',
  memberSince: days(-124),
  kick: { kickUserId: 8814422, kickUsername: 'reelchaser', verifiedAt: days(-118) },
  balance: 1_486,
  lifetimeEarned: 4_920,
  earnedThisWeek: 560,
  pendingRedemptions: 1,
  multiplier: { label: 'Sub bonus active', value: 2 },
  frozen: { frozen: false },
  role: 'member',
  games: {
    enabled: true,
    wageredToday: 120,
    netToday: -35,
    excludedUntil: null,
    sessionReminderMinutes: 60,
  },
};

/** Signed-out is a first-class state on the shop, giveaways and account (§28). */
export const signedOutViewer: Viewer = { ...viewer, signedIn: false };

export const verification: VerificationState = { status: 'linked', link: viewer.kick! };

export const ledger: LedgerEntry[] = [
  { id: 'l1', createdAt: mins(-6), reason: 'Watched 1h 37m', session: { seconds: 5_820, ticks: 32 }, delta: 64, balance: 1_486, kind: 'watch' },
  { id: 'l2', createdAt: hours(-3), reason: 'Keno — 3 of 6 hits', detail: '2.94× on 20', delta: 39, balance: 1_422, kind: 'game' },
  { id: 'l3', createdAt: hours(-4), reason: 'Keno — 1 of 6 hits', detail: '0× on 20', delta: -20, balance: 1_383, kind: 'game' },
  { id: 'l4', createdAt: days(-1), reason: 'Weekly giveaway entry', detail: 'PS5 Bundle — 1 entry', delta: -50, balance: 1_403, kind: 'giveaway' },
  { id: 'l5', createdAt: days(-1), reason: 'Full hour bonus', delta: 20, balance: 1_453, kind: 'bonus' },
  { id: 'l6', createdAt: days(-2), reason: 'Watched 1h 28m', session: { seconds: 5_280, ticks: 29 }, delta: 58, balance: 1_433, kind: 'watch' },
  { id: 'l7', createdAt: days(-3), reason: 'Custom chat colour, 14 days', delta: -200, balance: 1_375, kind: 'redemption' },
  { id: 'l8', createdAt: days(-4), reason: 'Moderator adjustment', delta: 100, balance: 1_575, kind: 'adjustment', moderator: 'Sarah (mod) — "missed ticks during the 14 Aug outage"' },
  { id: 'l9', createdAt: days(-5), reason: 'Refund — Signed card deck', detail: 'Out of stock', delta: 1_000, balance: 1_475, kind: 'refund' },
];

/* -------------------------------------------------------------------------- */
/* Razed — leaderboards                                                       */
/* -------------------------------------------------------------------------- */

export const razed: Casino = {
  id: 'razed',
  name: 'Razed',
  slug: 'razed',
  referralCode: 'MATTYSPINS',
  affiliateUrl: 'https://razed.com/?ref=Mattyspins',
  offer: '200% up to $1,000 on your first deposit, plus 100 free spins',
  offerDetail: 'Wagering requirements apply. Sign up under the code and every dollar you wager counts towards the weekly board automatically.',
};

export const feedHealth: FeedHealth = { lastSyncAt: mins(-4), status: 'healthy', code: '200 OK' };

const weeklyRows = [
  { rank: 1, maskedUsername: 'wag*****r', username: 'wagerkingr', wagered: 184_920, prize: 2_000, movement: 0 },
  { rank: 2, maskedUsername: 'spi****ty', username: 'spinsanity', wagered: 141_380, prize: 1_000, movement: 2 },
  { rank: 3, maskedUsername: 'nol***ck', username: 'nolimitluck', wagered: 128_540, prize: 600, movement: -1 },
  { rank: 4, maskedUsername: 'gat****op', username: 'gatesofolymp', wagered: 96_210, prize: 400, movement: 1 },
  { rank: 5, maskedUsername: 'ree****er', username: 'reelchaser', wagered: 88_470, prize: 400, movement: -2 },
  { rank: 6, maskedUsername: 'bon****er', username: 'bonusbuyer', wagered: 71_930, prize: 400, movement: 0 },
  { rank: 7, maskedUsername: 'tum****ad', username: 'tumblemad', wagered: 64_115, prize: 400, movement: 3 },
  { rank: 8, maskedUsername: 'sug***sh', username: 'sugarrush', wagered: 52_680, prize: 400, movement: -1 },
  { rank: 9, maskedUsername: 'dea****ck', username: 'deadluck', wagered: 41_240, prize: 400, movement: null },
  { rank: 10, maskedUsername: 'big****ny', username: 'bigmoneybunny', wagered: 33_905, prize: 400, movement: 1 },
];

export const weeklyPeriod: Period = {
  id: 'w-2026-35',
  type: 'weekly',
  startsAt: days(-4),
  endsAt: days(3),
  status: 'open',
  pot: 6_000,
  rows: weeklyRows,
};

export const monthlyPeriod: Period = {
  id: 'm-2026-08',
  type: 'monthly',
  startsAt: days(-28),
  endsAt: days(2),
  status: 'open',
  pot: 15_000,
  rows: weeklyRows.map((r) => ({
    ...r,
    wagered: Math.round(r.wagered * 4.2),
    prize: Math.round(r.prize * 2.5),
  })),
};

/** A frozen period drives the claim flow and the "verifying" banner (§28). */
export const frozenPeriod: Period = {
  id: 'w-2026-34',
  type: 'weekly',
  startsAt: days(-11),
  endsAt: days(-4),
  status: 'frozen',
  pot: 6_000,
  rows: weeklyRows.map((r) => ({ ...r, movement: null })),
  claimedRanks: { 1: 'paid', 3: 'pending' },
};

export const archivedPeriods: Period[] = [
  { id: 'w-2026-33', type: 'weekly', startsAt: days(-18), endsAt: days(-11), status: 'archived', pot: 6_000, rows: weeklyRows },
  { id: 'w-2026-32', type: 'weekly', startsAt: days(-25), endsAt: days(-18), status: 'archived', pot: 5_000, rows: weeklyRows },
  { id: 'm-2026-07', type: 'monthly', startsAt: days(-59), endsAt: days(-28), status: 'archived', pot: 12_000, rows: weeklyRows },
  { id: 'w-2026-31', type: 'weekly', startsAt: days(-32), endsAt: days(-25), status: 'archived', pot: 5_000, rows: weeklyRows },
];

export const prizeTiers: PrizeTier[] = [
  { id: 't1', rankFrom: 1, rankTo: 1, amount: 2_000, currency: 'USD' },
  { id: 't2', rankFrom: 2, rankTo: 2, amount: 1_000, currency: 'USD' },
  { id: 't3', rankFrom: 3, rankTo: 3, amount: 600, currency: 'USD' },
  { id: 't4', rankFrom: 4, rankTo: 10, amount: 400, currency: 'USD' },
];

export const activeClaim: PrizeClaim | null = {
  id: 'c1',
  reference: 'MS-CLM-4471',
  periodLabel: 'Weekly board, 15–22 Aug',
  rank: 3,
  amount: 600,
  claimedUsername: 'nolimitluck',
  status: 'verifying',
  createdAt: hours(-19),
};

export const razedPlayers: RazedPlayer[] = weeklyRows.map((r, i) => ({
  rank: r.rank,
  username: r.username!,
  wagered: r.wagered,
  coins: [1_486, 920, 3_140, 0, 1_486, 610, 0, 2_205, 44, 780][i],
  matched: [3, 6].includes(i) ? null : { discord: `${r.username}#${1000 + i}` },
  flag: i === 8 ? 'Alt cluster — 3 accounts, one IP hash' : undefined,
  lastSeenInChat: i === 3 ? null : mins(-(i + 1) * 27),
}));

export const razedReturnedCount = 25;

/* -------------------------------------------------------------------------- */
/* Clips and big wins                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Empty until Matty's real clips are added. Kick has no public clips endpoint,
 * so those are pasted in from admin; YouTube and Instagram sync automatically
 * but land as drafts until a moderator publishes them (Master Plan §10).
 */
export const clips: Clip[] = [
  /**
   * A real clip from kick.com/mattyspinss/clips. Kick has no public clips
   * endpoint (Master Plan §10), so these are added by hand: the clip URL gives
   * the id, and the id gives both the player embed and the thumbnail.
   *
   *   page   kick.com/<channel>/clips/<id>
   *   embed  player.kick.com/<channel>?clip=<id>
   *   thumb  clips.kick.com/clips/60/<id>/thumbnail.webp
   */
  {
    id: 'clip_01M0NBWS4MYE20NF4Z6QQW79J6',
    kind: 'clip',
    source: 'kick',
    url: 'https://kick.com/mattyspinss/clips/clip_01M0NBWS4MYE20NF4Z6QQW79J6',
    embedUrl: 'https://player.kick.com/mattyspinss?clip=clip_01M0NBWS4MYE20NF4Z6QQW79J6',
    thumbUrl: 'https://clips.kick.com/clips/60/clip_01M0NBWS4MYE20NF4Z6QQW79J6/thumbnail.webp',
    title: '3000 Bonus Bingo! 1200 leaderboard',
    aspect: '16:9',
    durationSeconds: 90,
    views: 6,
    occurredAt: days(-7),
    status: 'published',
  },
];

export const bigWins: Clip[] = [
  { id: 'b1', kind: 'big_win', source: 'kick', url: 'https://kick.com/mattyspinss', embedUrl: '', thumbUrl: '/brand/win-1.svg', title: 'The one that paid for the whole hunt', aspect: '16:9', durationSeconds: 88, slotName: 'Gates of Olympus', bet: 20, payout: 48_620, occurredAt: days(-6), pinned: true, status: 'published' },
  { id: 'b2', kind: 'big_win', source: 'youtube', url: 'https://youtube.com/@MattySpinss', embedUrl: '', thumbUrl: '/brand/win-2.svg', title: 'Max win on the last bonus', aspect: '16:9', durationSeconds: 104, slotName: 'Sugar Rush 1000', bet: 40, payout: 200_000, occurredAt: days(-21), pinned: true, status: 'published' },
  { id: 'b3', kind: 'big_win', source: 'instagram', url: 'https://instagram.com/mattyspinss', embedUrl: '', thumbUrl: '/brand/win-3.svg', title: 'Bought it, hated it, then this', aspect: '9:16', durationSeconds: 47, slotName: 'Le Bandit', bet: 10, payout: 21_400, occurredAt: days(-9), pinned: true, status: 'published' },
  { id: 'b4', kind: 'big_win', source: 'kick', url: 'https://kick.com/mattyspinss', embedUrl: '', thumbUrl: '/brand/win-4.svg', title: 'Three retriggers deep', aspect: '16:9', durationSeconds: 132, slotName: 'Wanted Dead or a Wild', bet: 25, payout: 62_500, occurredAt: days(-33), status: 'published' },
  { id: 'b5', kind: 'big_win', source: 'kick', url: 'https://kick.com/mattyspinss', embedUrl: '', thumbUrl: '/brand/win-5.svg', title: 'The quietest 4,000× you will ever see', aspect: '16:9', durationSeconds: 71, slotName: 'San Quentin', bet: 5, payout: 20_000, occurredAt: days(-41), status: 'published' },
  { id: 'b6', kind: 'big_win', source: 'youtube', url: 'https://youtube.com/@MattySpinss', embedUrl: '', thumbUrl: '/brand/win-6.svg', title: 'Chat called it a dead spin', aspect: '16:9', durationSeconds: 59, slotName: 'Fruit Party', bet: 15, payout: 18_300, occurredAt: days(-52), status: 'published' },
];

/* -------------------------------------------------------------------------- */
/* Shop and giveaways                                                         */
/* -------------------------------------------------------------------------- */

export const shopItems: ShopItem[] = [
  { id: 's1', name: 'Weekly giveaway entry', description: "One entry into this week's draw. Enter as many times as the cap allows.", cost: 50, category: 'entries', stock: null, active: true },
  { id: 's2', name: 'Monthly draw entry', description: 'One entry into the monthly prize draw. Bigger pot, longer odds.', cost: 150, category: 'entries', stock: null, active: true },
  { id: 's3', name: 'Custom chat colour', description: 'Your name in the colour of your choice in Discord for 14 days.', cost: 200, category: 'discord', stock: null, cooldownDaysRemaining: 12, active: true },
  { id: 's4', name: 'Shoutout on stream', description: 'Matty reads your message out live. Keep it clean and he will read it.', cost: 350, category: 'stream', stock: 8, active: true },
  { id: 's5', name: 'High Roller role', description: 'The gold Discord role and its channels for 30 days.', cost: 500, category: 'discord', stock: null, active: true },
  { id: 's6', name: 'Pick the next slot', description: 'You choose what he opens next. One pick, taken live.', cost: 750, category: 'stream', stock: 3, active: true },
  { id: 's7', name: 'Signed card deck', description: 'A deck signed by Matty, posted anywhere he can legally post it.', cost: 1_000, category: 'merch', stock: 0, active: true },
  { id: 's8', name: 'MattySpins hoodie', description: 'Heavyweight, embroidered mark. Sizes S to XXL.', cost: 1_250, category: 'merch', stock: 14, active: true },
];

export const redemptions: Redemption[] = [
  { id: 'r1', itemName: 'MattySpins hoodie', cost: 1_250, status: 'pending', createdAt: hours(-5), member: 'reelchaser', fulfilmentData: { Size: 'L', Address: '14 Rothwell Street, Manchester M14 6PQ' } },
  { id: 'r2', itemName: 'Shoutout on stream', cost: 350, status: 'pending', createdAt: hours(-9), member: 'tumblemad', fulfilmentData: { Message: 'Say hello to my brother Danny, he swears you are rigged' } },
  { id: 'r3', itemName: 'Pick the next slot', cost: 750, status: 'pending', createdAt: hours(-14), member: 'sugarrush', fulfilmentData: { Slot: 'Wanted Dead or a Wild' } },
  { id: 'r4', itemName: 'Custom chat colour', cost: 200, status: 'fulfilled', createdAt: days(-3), handledBy: 'Sarah (mod)', member: 'reelchaser' },
  { id: 'r5', itemName: 'Signed card deck', cost: 1_000, status: 'rejected', createdAt: days(-5), handledBy: 'Sarah (mod)', reason: 'Out of stock — coins refunded in full', member: 'reelchaser' },
];

export const giveaways: Giveaway[] = [
  {
    id: 'g1', title: 'Weekly draw', prize: 'PS5 Bundle + $250 Razed credit', entryCost: 50, maxEntriesPerUser: 10,
    totalEntries: 1_842, yourEntries: 3, opensAt: days(-4), drawsAt: days(3),
    serverSeedHash: 'a3f5c81e9b2d47a0c6e8f1b3d5a7c9e2f4b6d8a0c2e4f6b8d0a2c4e6f8b0d2a4',
  },
  {
    id: 'g2', title: 'Monthly draw', prize: '$2,000 cash', entryCost: 150, maxEntriesPerUser: 6,
    totalEntries: 946, yourEntries: 0, opensAt: days(-28), drawsAt: days(2),
    serverSeedHash: 'e7b1d4f8a2c6e0b4d8f2a6c0e4b8d2f6a0c4e8b2d6f0a4c8e2b6d0f4a8c2e6b0',
  },
];

export const pastGiveaways: Giveaway[] = [
  { id: 'pg1', title: 'Weekly draw', prize: 'Steam Deck OLED', entryCost: 50, maxEntriesPerUser: 10, totalEntries: 1_640, yourEntries: 2, opensAt: days(-11), drawsAt: days(-4), drawnAt: days(-4), winnerMasked: 'spi****ty', serverSeedHash: 'b8d2f6a0c4e8b2d6f0a4c8e2b6d0f4a8c2e6b0d4f8a2c6e0b4d8f2a6c0e4b8d2', serverSeed: '7f3a9c2e5b8d1f4a7c0e3b6d9f2a5c8e1b4d7f0a3c6e9b2d5f8a1c4e7b0d3f6a' },
  { id: 'pg2', title: 'Weekly draw', prize: '$500 Razed credit', entryCost: 50, maxEntriesPerUser: 10, totalEntries: 1_205, yourEntries: 0, opensAt: days(-18), drawsAt: days(-11), drawnAt: days(-11), winnerMasked: 'dea****ck', serverSeedHash: 'c4e8b2d6f0a4c8e2b6d0f4a8c2e6b0d4f8a2c6e0b4d8f2a6c0e4b8d2f6a0c4e8', serverSeed: '2e5b8d1f4a7c0e3b6d9f2a5c8e1b4d7f0a3c6e9b2d5f8a1c4e7b0d3f6a9c2e5b' },
  { id: 'pg3', title: 'Monthly draw', prize: 'Gaming chair + $500', entryCost: 150, maxEntriesPerUser: 6, totalEntries: 812, yourEntries: 1, opensAt: days(-59), drawsAt: days(-28), drawnAt: days(-28), winnerMasked: 'bon****er', serverSeedHash: 'd6f0a4c8e2b6d0f4a8c2e6b0d4f8a2c6e0b4d8f2a6c0e4b8d2f6a0c4e8b2d6f0', serverSeed: '8d1f4a7c0e3b6d9f2a5c8e1b4d7f0a3c6e9b2d5f8a1c4e7b0d3f6a9c2e5b8d1f' },
];

/* -------------------------------------------------------------------------- */
/* Games                                                                      */
/* -------------------------------------------------------------------------- */

export const gameConfigs: GameConfig[] = [
  { slug: 'keno', name: 'Keno', description: 'Pick up to ten of forty. Ten are drawn. Four risk levels change the shape of the paytable, not the edge.', imageUrl: '/brand/Keno.webp', enabled: true, rtp: 0.99, minBet: 10, maxBet: 100, maxWin: 20_000 },
  { slug: 'dice', name: 'Dice', description: 'Slide a target, call over or under. The payout follows the chance exactly.', imageUrl: '/brand/Dice.webp', enabled: true, rtp: 0.99, minBet: 10, maxBet: 100, maxWin: 20_000 },
  { slug: 'limbo', name: 'Limbo', description: 'Name a multiplier and see whether the round beats it. Nothing else to decide.', imageUrl: '/brand/Limbo.webp', enabled: true, rtp: 0.99, minBet: 10, maxBet: 100, maxWin: 20_000 },
  { slug: 'blackjack', name: 'Blackjack', description: 'Coming after fairness has run in public for a month.', enabled: false, comingSoon: true, rtp: 0.99, minBet: 10, maxBet: 100, maxWin: 20_000 },
  { slug: 'baccarat', name: 'Baccarat', description: 'Coming after fairness has run in public for a month.', enabled: false, comingSoon: true, rtp: 0.99, minBet: 10, maxBet: 100, maxWin: 20_000 },
];

/** Owner-only kill switch (§38). Flip to see the lobby's replacement message. */
export const gamesKilled = false;

export const seedPair: SeedPair = {
  serverSeedHash: '9c1f7a3e5b8d2f6a0c4e8b2d6f0a4c8e2b6d0f4a8c2e6b0d4f8a2c6e0b4d8f2a',
  clientSeed: 'reelchaser-2026',
  nonce: 47,
  previousServerSeed: '4a7c0e3b6d9f2a5c8e1b4d7f0a3c6e9b2d5f8a1c4e7b0d3f6a9c2e5b8d1f4a7c',
  previousServerSeedHash: '1f4a7c0e3b6d9f2a5c8e1b4d7f0a3c6e9b2d5f8a1c4e7b0d3f6a9c2e5b8d1f4a',
};

export const biggestHitsToday: GameRound[] = [
  { id: 'h1', player: 'tum****ad', game: 'limbo', bet: 100, multiplier: 214.5, payout: 21_450, nonce: 12, serverSeedHash: seedPair.serverSeedHash, clientSeed: 'tumble-9', createdAt: hours(-1) },
  { id: 'h2', player: 'sug***sh', game: 'keno', bet: 80, multiplier: 134.37, payout: 10_749, nonce: 88, serverSeedHash: seedPair.serverSeedHash, clientSeed: 'sugar-1', createdAt: hours(-2) },
  { id: 'h3', player: 'nol***ck', game: 'limbo', bet: 100, multiplier: 49.5, payout: 4_950, nonce: 31, serverSeedHash: seedPair.serverSeedHash, clientSeed: 'nolimit-4', createdAt: hours(-3) },
  { id: 'h4', player: 'ree****er', game: 'dice', bet: 50, multiplier: 24.5, payout: 1_225, nonce: 47, serverSeedHash: seedPair.serverSeedHash, clientSeed: 'reelchaser-2026', createdAt: hours(-4) },
  { id: 'h5', player: 'bon****er', game: 'keno', bet: 40, multiplier: 26.19, payout: 1_047, nonce: 5, serverSeedHash: seedPair.serverSeedHash, clientSeed: 'bonus-7', createdAt: hours(-5) },
];

/* -------------------------------------------------------------------------- */
/* Admin                                                                      */
/* -------------------------------------------------------------------------- */

export const auditLog: AuditEntry[] = [
  { id: 'a1', admin: 'Sarah (mod)', action: 'Approved redemption', target: 'Custom chat colour — reelchaser', createdAt: mins(-22) },
  { id: 'a2', admin: 'Matty (owner)', action: 'Published big win', target: 'Gates of Olympus — 2,431×', createdAt: hours(-2) },
  { id: 'a3', admin: 'Sarah (mod)', action: 'Rejected redemption', target: 'Signed card deck — out of stock, refunded', createdAt: hours(-4) },
  { id: 'a4', admin: 'Matty (owner)', action: 'Edited prize tiers', target: 'Weekly period w-2026-36 (next)', createdAt: hours(-7) },
  { id: 'a5', admin: 'Sarah (mod)', action: 'Coin adjustment +100', target: 'reelchaser — "missed ticks during the 14 Aug outage"', createdAt: days(-1) },
  { id: 'a6', admin: 'Matty (owner)', action: 'Froze period', target: 'Weekly period w-2026-34', createdAt: days(-4) },
  { id: 'a7', admin: 'Sarah (mod)', action: 'Froze earning', target: 'deadluck — "alt cluster under review"', createdAt: days(-4) },
  { id: 'a8', admin: 'Matty (owner)', action: 'Updated keno paytable', target: 'High risk, 6 picks', createdAt: days(-5) },
  { id: 'a9', admin: 'Matty (owner)', action: 'Marked paid', target: 'w-2026-33 rank 1 — $2,000 by bank transfer', createdAt: days(-6) },
  { id: 'a10', admin: 'Sarah (mod)', action: 'Matched Razed player', target: 'wagerkingr → wagerkingr#1000', createdAt: days(-6) },
];

export const adminStats = {
  coinsMintedThisWeek: 184_200,
  coinsDestroyedThisWeek: 4_120,
  activeEarners: 612,
  redemptionQueue: 3,
  roundsToday: 4_880,
  wageredToday: 96_400,
};

export const siteStats = {
  weeklyPrizePool: 6_000,
  membersEarning: 3_412,
  paidOutToDate: 128_500,
};

export const socials = [
  { platform: 'Kick', handle: 'kick.com/mattyspinss', url: 'https://kick.com/mattyspinss' },
  { platform: 'YouTube', handle: '@MattySpinss', url: 'https://youtube.com/@MattySpinss' },
  { platform: 'Instagram', handle: '@mattyspinss', url: 'https://instagram.com/mattyspinss' },
  { platform: 'X', handle: '@mattyspinsslots', url: 'https://x.com/mattyspinsslots' },
];

export const discordInvite = 'https://discord.gg/mattyspins';

/**
 * Matty's portrait. Everything that shows him reads it from here, so replacing
 * the photograph is a one-line change.
 */
export const portraitUrl = '/brand/Mattyimage.webp';

/**
 * Built from Matty's own description of himself, in his voice, at the 120–150
 * words the spec asks for. Worth him reading before launch — the first
 * paragraph is his own line, the rest is written from it.
 */
export const aboutCopy = [
  'I’m MattySpins, a UK-based gaming creator building a community around slots, crypto casinos and live entertainment. I’m all about sharing the wins, the losses and the best opportunities I find with my community.',
  'The losses part matters. Anyone can post a 5,000× and say nothing for a fortnight. You see the sessions that go nowhere too, because a highlight reel with the bad nights cut out is not a real picture of what this is.',
  'The board here comes straight out of Razed, so nobody has to take my word for what anybody wagered. Coins are the other half: turn up, talk in chat, and you earn them. You cannot buy them and I would not sell them if you asked. Spend them on entries, on Discord perks, on picking what I open next.',
  'If you only ever watch and never sign up, that is completely fine by me. Pull up a chair.',
];
