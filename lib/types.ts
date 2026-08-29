/** Shapes mirror the data model in the Master Plan §13, trimmed to what the UI reads. */

export type StreamState = {
  live: boolean;
  title: string;
  viewers: number;
  startedAt: string | null;
  thumbUrl: string;
  channel: string;
  nextStreamAt: string;
  lastVodUrl: string;
  lastVodThumb: string;
  lastVodTitle: string;
};

export type Multiplier = { label: string; value: number };

export type Viewer = {
  signedIn: boolean;
  discordId: string;
  discordUsername: string;
  avatarUrl: string;
  memberSince: string;
  kick: KickLink | null;
  balance: number;
  lifetimeEarned: number;
  earnedThisWeek: number;
  pendingRedemptions: number;
  multiplier: Multiplier;
  frozen: { frozen: boolean; reason?: string; until?: string };
  role: 'member' | 'mod' | 'owner';
  games: PlayLimits;
};

export type KickLink = {
  kickUserId: number;
  kickUsername: string;
  verifiedAt: string;
};

export type VerificationState =
  | { status: 'unlinked' }
  | { status: 'waiting'; code: string; expiresAt: string }
  | { status: 'expired'; code: string }
  | { status: 'linked'; link: KickLink };

export type PlayLimits = {
  enabled: boolean;
  /** Kept for the session summary and the honest "net today" figure — it is a
   *  running total, not a cap. There is no daily wager limit. */
  wageredToday: number;
  netToday: number;
  excludedUntil: string | null;
  sessionReminderMinutes: number;
};

export type LedgerEntry = {
  id: string;
  createdAt: string;
  reason: string;
  detail?: string;
  /** Watch-tick rows aggregate by session and expand to the raw entries on click. */
  session?: { seconds: number; ticks: number };
  delta: number;
  balance: number;
  kind: 'watch' | 'bonus' | 'redemption' | 'adjustment' | 'game' | 'giveaway' | 'refund';
  moderator?: string;
};

export type PeriodStatus = 'open' | 'final-hour' | 'frozen' | 'paid' | 'archived';

export type LeaderboardRow = {
  rank: number;
  maskedUsername: string;
  username?: string;
  wagered: number;
  prize: number;
  movement: number | null;
};

export type Period = {
  id: string;
  type: 'weekly' | 'monthly';
  startsAt: string;
  endsAt: string;
  status: PeriodStatus;
  pot: number;
  rows: LeaderboardRow[];
  claimedRanks?: Record<number, 'pending' | 'paid'>;
};

export type FeedHealth = {
  lastSyncAt: string;
  status: 'healthy' | 'stale' | 'failing';
  code: string;
};

export type ClipSource = 'kick' | 'youtube' | 'instagram' | 'x';

export type Clip = {
  id: string;
  kind: 'clip' | 'big_win';
  source: ClipSource;
  url: string;
  embedUrl: string;
  thumbUrl: string;
  title: string;
  /** Aspect is a data field, not a constant (§23). */
  aspect: '16:9' | '9:16';
  durationSeconds: number;
  views?: number;
  occurredAt: string;
  pinned?: boolean;
  status: 'draft' | 'published';
  /** Big wins only. The multiplier is derived from these two, never stored. */
  slotName?: string;
  bet?: number;
  payout?: number;
};

export type ShopCategory = 'entries' | 'discord' | 'merch' | 'stream';

export type ShopItem = {
  id: string;
  name: string;
  description: string;
  cost: number;
  category: ShopCategory;
  stock: number | null;
  cooldownDaysRemaining?: number;
  active: boolean;
};

export type Redemption = {
  id: string;
  itemName: string;
  cost: number;
  status: 'pending' | 'approved' | 'fulfilled' | 'rejected';
  createdAt: string;
  handledBy?: string;
  reason?: string;
  fulfilmentData?: Record<string, string>;
  member?: string;
};

export type Giveaway = {
  id: string;
  title: string;
  prize: string;
  entryCost: number;
  maxEntriesPerUser: number;
  totalEntries: number;
  yourEntries: number;
  opensAt: string;
  drawsAt: string;
  serverSeedHash: string;
  serverSeed?: string;
  winnerMasked?: string;
  drawnAt?: string;
};

export type Casino = {
  id: string;
  name: string;
  slug: string;
  referralCode: string;
  affiliateUrl: string;
  offer: string;
  offerDetail: string;
};

export type GameSlug = 'keno' | 'dice' | 'limbo' | 'blackjack' | 'baccarat';

export type GameConfig = {
  slug: GameSlug;
  name: string;
  description: string;
  /** Key art for the lobby card. Falls back to a drawn preview when absent. */
  imageUrl?: string;
  enabled: boolean;
  comingSoon?: boolean;
  rtp: number;
  minBet: number;
  maxBet: number;
  maxWin: number;
};

export type GameRound = {
  id: string;
  player: string;
  game: GameSlug;
  bet: number;
  multiplier: number;
  payout: number;
  nonce: number;
  serverSeedHash: string;
  clientSeed: string;
  createdAt: string;
};

export type SeedPair = {
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  previousServerSeed?: string;
  previousServerSeedHash?: string;
};

export type AuditEntry = {
  id: string;
  admin: string;
  action: string;
  target: string;
  createdAt: string;
};

export type RazedPlayer = {
  rank: number;
  username: string;
  wagered: number;
  coins: number;
  matched: { discord: string } | null;
  flag?: string;
  lastSeenInChat: string | null;
};

export type PrizeTier = {
  id: string;
  rankFrom: number;
  rankTo: number;
  amount: number;
  currency: string;
};

export type PrizeClaim = {
  id: string;
  reference: string;
  periodLabel: string;
  rank: number;
  amount: number;
  claimedUsername: string;
  status: 'submitted' | 'verifying' | 'approved' | 'paid' | 'rejected';
  createdAt: string;
  reason?: string;
};
