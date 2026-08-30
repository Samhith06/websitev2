/**
 * What is left of the mock-data file (UI Spec §0).
 *
 * Accounts, coins, the ledger, game rounds, clips and the audit log used to be
 * here. They are database rows now — `lib/store/*` — and the leaderboard comes
 * from Razed at request time.
 *
 * What remains is the material with no table behind it yet: the stream state
 * and schedule, Razed's period definitions and prize tiers, the shop catalogue,
 * and the game configs. Each of those is the next piece of work in its own
 * area, and each is honest about it rather than pretending to be live.
 *
 * Dates are generated relative to load, so countdowns and the period clock
 * behave like the real thing while clicking through.
 */
import type {
  LeaderboardRow, Casino, GameConfig, Giveaway,
  Period, PrizeClaim, PrizeTier, Redemption, ShopItem, StreamState,
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

/*
 * The viewer, the ledger, clips, big wins, rounds, the audit log and every
 * admin counter used to live here as mock data. They are rows now — see
 * `lib/store/*` — and this file keeps only what genuinely has no table yet:
 * the stream state, the schedule, Razed's periods and prize tiers, the shop
 * catalogue, and the game configs.
 */

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


/**
 * The board is supplied by Razed at request time (see `lib/razed.ts`). Nothing
 * is invented here: with no key configured the page says the feed is
 * unavailable rather than showing players who do not exist.
 */
const weeklyRows: LeaderboardRow[] = [];

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

/** Frozen boards are kept forever. None have closed yet. */
export const archivedPeriods: Period[] = [];

export const prizeTiers: PrizeTier[] = [
  { id: 't1', rankFrom: 1, rankTo: 1, amount: 2_000, currency: 'USD' },
  { id: 't2', rankFrom: 2, rankTo: 2, amount: 1_000, currency: 'USD' },
  { id: 't3', rankFrom: 3, rankTo: 3, amount: 600, currency: 'USD' },
  { id: 't4', rankFrom: 4, rankTo: 10, amount: 400, currency: 'USD' },
];

/** A claim appears once a period freezes and someone claims a position. */
export const activeClaim: PrizeClaim | null = null;


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

/** Real redemptions arrive with the shop and the database. */
export const redemptions: Redemption[] = [];

/** Draws Matty opens from admin. None running yet. */
export const giveaways: Giveaway[] = [];

/** Winner rows are permanent records. None exist yet, so none are shown. */
export const pastGiveaways: Giveaway[] = [];

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

/* -------------------------------------------------------------------------- */
/* Admin                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * `null` means "we do not have this figure yet" and the interface says so.
 * Zero would be a claim, and a wrong one.
 */
export const siteStats: {
  weeklyPrizePool: number | null;
  membersEarning: number | null;
  paidOutToDate: number | null;
} = {
  weeklyPrizePool: null,
  membersEarning: null,
  paidOutToDate: null,
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
