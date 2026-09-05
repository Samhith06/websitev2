import 'server-only';
import { one, rows } from '@/lib/db';
import { TICK_MINUTES } from './presence';

/**
 * One member, assembled for the staff detail screen.
 *
 * Every other read in `lib/store` answers one question for one screen. This
 * answers "who is this person", which is a different job: a mod looking at a
 * suspicious account, or at somebody asking why a payout has not landed, needs
 * the watch time, the wager, the coins and the plays *side by side* — the
 * answer is almost always in the disagreement between two of them, and chasing
 * it across five screens is how the disagreement gets missed.
 *
 * The aggregates live here rather than being summed in the page because they
 * are sums over a whole history. Pulling ten thousand ledger rows into a server
 * component to add them up would work today and stop working quietly.
 */

/* -------------------------------------------------------------------------- */
/* Watching                                                                   */
/* -------------------------------------------------------------------------- */

export type WatchStats = {
  /** Paid ticks, which is the only honest unit of watch time we hold. */
  ticks: number;
  minutes: number;
  hours: number;
  /** Coins from watching, and the hour bonuses separately. */
  watchCoins: number;
  bonusCoins: number;
  bonuses: number;
  /** Distinct UTC days with at least one paid tick. */
  daysActive: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
};

/**
 * Watch time from ticks, never from coins.
 *
 * The profile screens divide watch coins by the tick rate, which is right at a
 * 1× multiplier and overstates a VIP by two and a half times — they earn 2.5
 * coins for the same three minutes. Counting the rows instead is correct for
 * everybody, and this is the screen where somebody is deciding whether a
 * number looks wrong.
 */
async function watchStats(userId: number): Promise<WatchStats> {
  const row = await one<{
    ticks: string;
    bonuses: string;
    watch_coins: string;
    bonus_coins: string;
    days_active: string;
    first_at: Date | null;
    last_at: Date | null;
  }>(
    `SELECT COUNT(*) FILTER (WHERE kind = 'watch')::text                           AS ticks,
            COUNT(*) FILTER (WHERE kind = 'bonus')::text                           AS bonuses,
            COALESCE(SUM(delta) FILTER (WHERE kind = 'watch'), 0)::text            AS watch_coins,
            COALESCE(SUM(delta) FILTER (WHERE kind = 'bonus'), 0)::text            AS bonus_coins,
            COUNT(DISTINCT date_trunc('day', created_at AT TIME ZONE 'UTC'))::text AS days_active,
            MIN(created_at)                                                        AS first_at,
            MAX(created_at)                                                        AS last_at
       FROM coin_ledger
      WHERE user_id = $1 AND kind IN ('watch', 'bonus')`,
    [userId],
  );

  const ticks = Number(row?.ticks ?? 0);
  const minutes = ticks * TICK_MINUTES;
  return {
    ticks,
    minutes,
    hours: minutes / 60,
    watchCoins: Number(row?.watch_coins ?? 0),
    bonusCoins: Number(row?.bonus_coins ?? 0),
    bonuses: Number(row?.bonuses ?? 0),
    daysActive: Number(row?.days_active ?? 0),
    firstSeenAt: row?.first_at?.toISOString() ?? null,
    lastSeenAt: row?.last_at?.toISOString() ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Coins                                                                      */
/* -------------------------------------------------------------------------- */

export type CoinKindTotal = {
  kind: string;
  /** In and out are kept apart: a netted game row hides the volume entirely. */
  inCoins: number;
  outCoins: number;
  entries: number;
};

async function coinTotals(userId: number): Promise<CoinKindTotal[]> {
  const found = await rows<{
    kind: string;
    in_coins: string;
    out_coins: string;
    entries: string;
  }>(
    `SELECT kind,
            COALESCE(SUM(delta) FILTER (WHERE delta > 0), 0)::text  AS in_coins,
            COALESCE(-SUM(delta) FILTER (WHERE delta < 0), 0)::text AS out_coins,
            COUNT(*)::text                                          AS entries
       FROM coin_ledger
      WHERE user_id = $1
      GROUP BY kind
      ORDER BY kind`,
    [userId],
  );
  return found.map((r) => ({
    kind: r.kind,
    inCoins: Number(r.in_coins),
    outCoins: Number(r.out_coins),
    entries: Number(r.entries),
  }));
}

/* -------------------------------------------------------------------------- */
/* Games                                                                      */
/* -------------------------------------------------------------------------- */

export type GameTotals = {
  rounds: number;
  wagered: number;
  returned: number;
  /** Returned minus wagered — negative is the house ahead, which is normal. */
  net: number;
  biggestBet: number;
  biggestWin: number;
  bestMultiplier: number;
  firstAt: string | null;
  lastAt: string | null;
};

export type GameBreakdown = GameTotals & { game: string };

type TotalsRow = Record<string, string | Date | null>;

function shapeTotals(r: TotalsRow | null): GameTotals {
  const wagered = Number(r?.wagered ?? 0);
  const returned = Number(r?.returned ?? 0);
  return {
    rounds: Number(r?.rounds ?? 0),
    wagered,
    returned,
    net: returned - wagered,
    biggestBet: Number(r?.biggest_bet ?? 0),
    biggestWin: Number(r?.biggest_win ?? 0),
    bestMultiplier: Number(r?.best_multiplier ?? 0),
    firstAt: r?.first_at instanceof Date ? r.first_at.toISOString() : null,
    lastAt: r?.last_at instanceof Date ? r.last_at.toISOString() : null,
  };
}

async function gameTotals(
  userId: number,
): Promise<{ overall: GameTotals; byGame: GameBreakdown[] }> {
  const [totals, perGame] = await Promise.all([
    one<TotalsRow>(
      `SELECT COUNT(*)::text                     AS rounds,
              COALESCE(SUM(bet), 0)::text        AS wagered,
              COALESCE(SUM(payout), 0)::text     AS returned,
              COALESCE(MAX(bet), 0)::text        AS biggest_bet,
              COALESCE(MAX(payout), 0)::text     AS biggest_win,
              COALESCE(MAX(multiplier), 0)::text AS best_multiplier,
              MIN(created_at)                    AS first_at,
              MAX(created_at)                    AS last_at
         FROM game_rounds
        WHERE user_id = $1`,
      [userId],
    ),
    rows<TotalsRow>(
      `SELECT game,
              COUNT(*)::text                     AS rounds,
              COALESCE(SUM(bet), 0)::text        AS wagered,
              COALESCE(SUM(payout), 0)::text     AS returned,
              COALESCE(MAX(bet), 0)::text        AS biggest_bet,
              COALESCE(MAX(payout), 0)::text     AS biggest_win,
              COALESCE(MAX(multiplier), 0)::text AS best_multiplier,
              MIN(created_at)                    AS first_at,
              MAX(created_at)                    AS last_at
         FROM game_rounds
        WHERE user_id = $1
        GROUP BY game
        ORDER BY SUM(bet) DESC`,
      [userId],
    ),
  ]);

  return {
    overall: shapeTotals(totals),
    byGame: perGame.map((r) => ({ game: String(r.game), ...shapeTotals(r) })),
  };
}

/**
 * Blackjack lives in its own table because a hand spans several requests, so it
 * is absent from `game_rounds` and would vanish silently from a "total wagered"
 * that only read the one table.
 */
export type BlackjackTotals = {
  rounds: number;
  open: number;
  staked: number;
  returned: number;
  net: number;
  lastAt: string | null;
};

async function blackjackTotals(userId: number): Promise<BlackjackTotals> {
  const row = await one<{
    rounds: string;
    open: string;
    staked: string;
    returned: string;
    last_at: Date | null;
  }>(
    `SELECT COUNT(*)::text                                   AS rounds,
            COUNT(*) FILTER (WHERE settled_at IS NULL)::text AS open,
            COALESCE(SUM(staked), 0)::text                   AS staked,
            COALESCE(SUM(returned), 0)::text                 AS returned,
            MAX(created_at)                                  AS last_at
       FROM blackjack_rounds
      WHERE user_id = $1`,
    [userId],
  );
  const staked = Number(row?.staked ?? 0);
  const returned = Number(row?.returned ?? 0);
  return {
    rounds: Number(row?.rounds ?? 0),
    open: Number(row?.open ?? 0),
    staked,
    returned,
    net: returned - staked,
    lastAt: row?.last_at?.toISOString() ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Raffles                                                                    */
/* -------------------------------------------------------------------------- */

export type RaffleEntryRow = {
  raffleId: number;
  title: string;
  status: string;
  entries: number;
  spent: number;
  won: boolean;
  lastEnteredAt: string;
};

async function raffleEntries(userId: number): Promise<RaffleEntryRow[]> {
  const found = await rows<{
    raffle_id: string;
    title: string;
    status: string;
    entries: string;
    spent: string;
    won: boolean;
    last_at: Date;
  }>(
    `SELECT r.id::text                    AS raffle_id,
            r.title,
            r.status,
            COUNT(e.id)::text             AS entries,
            COALESCE(SUM(e.cost), 0)::text AS spent,
            (r.winner_user_id = $1)       AS won,
            MAX(e.created_at)             AS last_at
       FROM raffle_entries e
       JOIN raffles r ON r.id = e.raffle_id
      WHERE e.user_id = $1
      GROUP BY r.id, r.title, r.status, r.winner_user_id
      ORDER BY MAX(e.created_at) DESC`,
    [userId],
  );
  return found.map((r) => ({
    raffleId: Number(r.raffle_id),
    title: r.title,
    status: r.status,
    entries: Number(r.entries),
    spent: Number(r.spent),
    won: Boolean(r.won),
    lastEnteredAt: r.last_at.toISOString(),
  }));
}

/* -------------------------------------------------------------------------- */
/* The staff trail                                                            */
/* -------------------------------------------------------------------------- */

export type StaffAction = {
  id: number;
  actor: string;
  action: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
};

/**
 * Every staff action taken against this account.
 *
 * `target` is written as the bare user id by the admin actions, so this is an
 * exact match rather than a search. An account whose history is four
 * adjustments and a freeze is a different account from one with nothing on it,
 * and that is precisely what a mod opening this screen is here to find out.
 */
async function staffActions(userId: number, limit = 50): Promise<StaffAction[]> {
  const found = await rows<{
    id: string;
    admin_name: string;
    action: string;
    detail: Record<string, unknown> | null;
    created_at: Date;
  }>(
    `SELECT id::text, admin_name, action, detail, created_at
       FROM audit_log
      WHERE target = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [String(userId), limit],
  );
  return found.map((r) => ({
    id: Number(r.id),
    actor: r.admin_name,
    action: r.action,
    detail: r.detail,
    createdAt: r.created_at.toISOString(),
  }));
}

/* -------------------------------------------------------------------------- */
/* Presence                                                                   */
/* -------------------------------------------------------------------------- */

export type PresenceNow = {
  open: boolean;
  openedAt: string | null;
  expiresAt: string | null;
  source: string | null;
  streak: number;
  lastTickAt: string | null;
};

async function presenceNow(userId: number): Promise<PresenceNow> {
  const row = await one<{
    opened_at: Date;
    expires_at: Date;
    source: string;
    streak: number;
    last_tick_at: Date | null;
  }>(
    `SELECT opened_at, expires_at, source, streak, last_tick_at
       FROM presence_windows WHERE user_id = $1`,
    [userId],
  );
  if (!row) {
    return {
      open: false,
      openedAt: null,
      expiresAt: null,
      source: null,
      streak: 0,
      lastTickAt: null,
    };
  }
  return {
    open: row.expires_at.getTime() > Date.now(),
    openedAt: row.opened_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    source: row.source,
    streak: row.streak,
    lastTickAt: row.last_tick_at?.toISOString() ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* The dossier                                                                */
/* -------------------------------------------------------------------------- */

export type MemberActivity = {
  watch: WatchStats;
  coinTotals: CoinKindTotal[];
  games: GameTotals;
  gamesByGame: GameBreakdown[];
  blackjack: BlackjackTotals;
  raffles: RaffleEntryRow[];
  staffActions: StaffAction[];
  presence: PresenceNow;
};

/**
 * The seven reads above, run together.
 *
 * Sequentially that is seven round trips on a page that already makes a dozen;
 * in parallel it is one. They touch different tables and none depends on
 * another's result, so there is nothing to serialise them for.
 */
export async function memberActivity(userId: number): Promise<MemberActivity> {
  const [watch, totals, games, blackjack, raffles, actions, presence] = await Promise.all([
    watchStats(userId),
    coinTotals(userId),
    gameTotals(userId),
    blackjackTotals(userId),
    raffleEntries(userId),
    staffActions(userId),
    presenceNow(userId),
  ]);

  return {
    watch,
    coinTotals: totals,
    games: games.overall,
    gamesByGame: games.byGame,
    blackjack,
    raffles,
    staffActions: actions,
    presence,
  };
}
