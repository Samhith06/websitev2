import 'server-only';
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { one, rows, tx } from '@/lib/db';
import {
  CHAT_MIN_POINTS,
  CHAT_POOL,
  CHAT_PRIZES,
  CHAT_RULES,
  CHAT_TIMEZONE,
  chatPrizeFor,
  judgeChatMessage,
  type ChatVerdict,
} from '@/lib/chat-score';
import { apply } from './coins';

/**
 * The weekly chat leaderboard: counting messages, reading the board, and
 * paying the top ten when a week ends. The rules themselves live in
 * `lib/chat-score.ts`.
 *
 * Only a verified Kick link can score, for the same reason only one can earn
 * watch coins: the webhook is the one thing that can tie a chat message to an
 * account here, and a prize has to have somewhere to go.
 */

/** This week's Monday on stream time, as a date. */
const WEEK_SQL = `(date_trunc('week', now() AT TIME ZONE '${CHAT_TIMEZONE}'))::date`;

/** Ties go to whoever got there first, then to the older account. */
const BOARD_ORDER = 'a.points DESC, a.last_counted_at ASC NULLS LAST, a.user_id ASC';

export type ChatWeek = {
  /** YYYY-MM-DD, the Monday the week starts on. */
  weekStart: string;
  startsAt: string;
  endsAt: string;
};

export type ChatRow = {
  rank: number;
  userId: number;
  name: string;
  points: number;
  /** Every message seen during a live stream, counted or not. */
  messages: number;
  prize: number;
};

export type PastChatWeek = {
  weekStart: string;
  settledAt: string;
  pool: number;
  paid: number;
  standings: Array<{ rank: number; name: string; points: number; prize: number }>;
};

/* -------------------------------------------------------------------------- */
/* Counting                                                                   */
/* -------------------------------------------------------------------------- */

export type CountOutcome = ChatVerdict | { counts: false; reason: 'offline' | 'frozen' };

/**
 * Judge one chat message from a linked viewer and, if it passes, add a point.
 *
 * The row is locked for the decision, so two messages from the same person
 * arriving together cannot both slip inside the cooldown.
 */
export async function countChatMessage(userId: number, content: string): Promise<CountOutcome> {
  const verdict = judgeChatMessage(content);
  const hash = verdict.counts
    ? createHash('sha256').update(verdict.key).digest('hex').slice(0, 16)
    : null;

  return tx(async (client) => {
    const { rows: state } = await client.query<{ week: string; live: boolean; active: boolean }>(
      `SELECT ${WEEK_SQL}::text AS week,
              EXISTS (SELECT 1 FROM stream_sessions WHERE ended_at IS NULL) AS live,
              EXISTS (SELECT 1 FROM users WHERE id = $1 AND status = 'active') AS active`,
      [userId],
    );
    const { week, live, active } = state[0];
    // Off stream nothing is recorded at all: the board is for chatting while Matty is live.
    if (!live) return { counts: false, reason: 'offline' } as const;
    if (!active) return { counts: false, reason: 'frozen' } as const;

    await client.query(
      `INSERT INTO chat_activity (week_start, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [week, userId],
    );
    const { rows: found } = await client.query<{
      recent_keys: string[];
      since_last: number | null;
      same_hour: boolean;
      hour_points: number;
    }>(
      `SELECT recent_keys,
              EXTRACT(EPOCH FROM (now() - last_counted_at))::float8 AS since_last,
              (hour_start IS NOT NULL AND hour_start = date_trunc('hour', now())) AS same_hour,
              hour_points
         FROM chat_activity
        WHERE week_start = $1 AND user_id = $2
        FOR UPDATE`,
      [week, userId],
    );
    const row = found[0];

    const outcome: CountOutcome = !verdict.counts
      ? verdict
      : row.since_last !== null && row.since_last < CHAT_RULES.cooldownSeconds
        ? { counts: false, reason: 'cooldown' }
        : row.recent_keys.includes(hash!)
          ? { counts: false, reason: 'duplicate' }
          : row.same_hour && row.hour_points >= CHAT_RULES.hourlyCap
            ? { counts: false, reason: 'hourly-cap' }
            : verdict;

    if (!outcome.counts) {
      await client.query(
        `UPDATE chat_activity SET messages = messages + 1 WHERE week_start = $1 AND user_id = $2`,
        [week, userId],
      );
      return outcome;
    }

    await client.query(
      `UPDATE chat_activity
          SET messages        = messages + 1,
              points          = points + 1,
              last_counted_at = now(),
              recent_keys     = (ARRAY[$3::text] || recent_keys)[1:$4::int],
              hour_points     = CASE WHEN $5::boolean THEN hour_points + 1 ELSE 1 END,
              hour_start      = date_trunc('hour', now())
        WHERE week_start = $1 AND user_id = $2`,
      [week, userId, hash, CHAT_RULES.recentMemory, row.same_hour],
    );
    return outcome;
  });
}

/* -------------------------------------------------------------------------- */
/* Reading                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The week running now. Worked out by Postgres so it agrees with the counter
 * to the second, with a UTC fallback for a deployment with no database.
 */
export async function currentChatWeek(): Promise<ChatWeek> {
  const row = await one<{ week: string; starts_at: Date; ends_at: Date }>(
    `SELECT w::text AS week,
            (w::timestamp AT TIME ZONE '${CHAT_TIMEZONE}')       AS starts_at,
            ((w + 7)::timestamp AT TIME ZONE '${CHAT_TIMEZONE}') AS ends_at
       FROM (SELECT ${WEEK_SQL} AS w) x`,
  );
  if (row) {
    return { weekStart: row.week, startsAt: row.starts_at.toISOString(), endsAt: row.ends_at.toISOString() };
  }
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const end = new Date(start.getTime() + 7 * 86_400_000);
  return { weekStart: start.toISOString().slice(0, 10), startsAt: start.toISOString(), endsAt: end.toISOString() };
}

type BoardRow = { user_id: string; kick_username: string; points: number; messages: number };

const BOARD_SQL = `
  SELECT a.user_id::text, k.kick_username, a.points, a.messages
    FROM chat_activity a
    JOIN kick_links k ON k.user_id = a.user_id
    JOIN users      u ON u.id = a.user_id AND u.status = 'active'
   WHERE a.week_start = $1 AND a.points > 0
   ORDER BY ${BOARD_ORDER}
   LIMIT $2`;

function toRows(found: BoardRow[]): ChatRow[] {
  return found.map((r, i) => ({
    rank: i + 1,
    userId: Number(r.user_id),
    name: r.kick_username,
    points: r.points,
    messages: r.messages,
    prize: chatPrizeFor(i + 1, r.points),
  }));
}

export async function chatBoard(weekStart: string, limit = 50): Promise<ChatRow[]> {
  return toRows(await rows<BoardRow>(BOARD_SQL, [weekStart, limit]));
}

/** Chatters on the board and points scored this week, for the stat strip. */
export async function chatWeekTotals(weekStart: string): Promise<{ chatters: number; points: number }> {
  const row = await one<{ chatters: string; points: string }>(
    `SELECT count(*)::text AS chatters, COALESCE(SUM(a.points), 0)::text AS points
       FROM chat_activity a
       JOIN kick_links k ON k.user_id = a.user_id
       JOIN users      u ON u.id = a.user_id AND u.status = 'active'
      WHERE a.week_start = $1 AND a.points > 0`,
    [weekStart],
  );
  return { chatters: Number(row?.chatters ?? 0), points: Number(row?.points ?? 0) };
}

export type ChatStanding = {
  rank: number | null;
  points: number;
  messages: number;
  hourPoints: number;
  /** Seconds until the next message can count, 0 if it can now. */
  cooldownLeft: number;
};

/** Where one viewer stands this week, for the "you" card. */
export async function chatStandingFor(userId: number, weekStart: string): Promise<ChatStanding> {
  const row = await one<{
    points: number;
    messages: number;
    hour_points: number;
    since_last: number | null;
    rank: string | null;
  }>(
    `SELECT a.points, a.messages,
            CASE WHEN a.hour_start = date_trunc('hour', now()) THEN a.hour_points ELSE 0 END AS hour_points,
            EXTRACT(EPOCH FROM (now() - a.last_counted_at))::float8 AS since_last,
            CASE WHEN a.points > 0 THEN (
              SELECT count(*) + 1 FROM chat_activity b
                JOIN kick_links k ON k.user_id = b.user_id
                JOIN users      u ON u.id = b.user_id AND u.status = 'active'
               WHERE b.week_start = a.week_start AND b.points > 0
                 AND (b.points > a.points
                      OR (b.points = a.points AND (b.last_counted_at < a.last_counted_at
                          OR (b.last_counted_at = a.last_counted_at AND b.user_id < a.user_id))))
            )::text END AS rank
       FROM chat_activity a
      WHERE a.week_start = $1 AND a.user_id = $2`,
    [weekStart, userId],
  );
  if (!row) return { rank: null, points: 0, messages: 0, hourPoints: 0, cooldownLeft: 0 };
  return {
    rank: row.rank === null ? null : Number(row.rank),
    points: row.points,
    messages: row.messages,
    hourPoints: row.hour_points,
    cooldownLeft:
      row.since_last === null ? 0 : Math.max(0, Math.ceil(CHAT_RULES.cooldownSeconds - row.since_last)),
  };
}

export async function pastChatWeeks(limit = 8): Promise<PastChatWeek[]> {
  const found = await rows<{
    week: string;
    settled_at: Date;
    pool: number;
    paid: number;
    standings: PastChatWeek['standings'];
  }>(
    `SELECT week_start::text AS week, settled_at, pool, paid, standings
       FROM chat_weeks ORDER BY week_start DESC LIMIT $1`,
    [limit],
  );
  return found.map((r) => ({
    weekStart: r.week,
    settledAt: r.settled_at.toISOString(),
    pool: r.pool,
    paid: r.paid,
    standings: (r.standings ?? []).map(({ rank, name, points, prize }) => ({ rank, name, points, prize })),
  }));
}

/** Weeks that have ended with activity but no payout yet — for staff. */
export async function unsettledChatWeeks(): Promise<string[]> {
  const found = await rows<{ week: string }>(
    `SELECT DISTINCT a.week_start::text AS week
       FROM chat_activity a
      WHERE a.week_start < ${WEEK_SQL}
        AND NOT EXISTS (SELECT 1 FROM chat_weeks w WHERE w.week_start = a.week_start)
      ORDER BY 1`,
  );
  return found.map((r) => r.week);
}

/* -------------------------------------------------------------------------- */
/* Paying out                                                                 */
/* -------------------------------------------------------------------------- */

export type SettledChatWeek = { weekStart: string; winners: number; paid: number };

/**
 * Pay every finished week that has not been paid. Safe to call as often as
 * anyone likes: the `chat_weeks` row is claimed inside the payout transaction,
 * so a week that is already claimed is skipped rather than paid again.
 */
export async function settleFinishedChatWeeks(by = 'auto'): Promise<SettledChatWeek[]> {
  const settled: SettledChatWeek[] = [];
  for (const week of await unsettledChatWeeks()) {
    const result = await tx((client) => settleWeek(client, week, by));
    if (result) settled.push(result);
  }
  return settled;
}

async function settleWeek(client: PoolClient, week: string, by: string): Promise<SettledChatWeek | null> {
  const { rows: claimed } = await client.query(
    `INSERT INTO chat_weeks (week_start, settled_by, pool) VALUES ($1, $2, $3)
     ON CONFLICT (week_start) DO NOTHING RETURNING week_start`,
    [week, by, CHAT_POOL],
  );
  if (claimed.length === 0) return null;

  const { rows: top } = await client.query<BoardRow>(BOARD_SQL, [week, CHAT_PRIZES.length]);
  const standings = toRows(top).filter((r) => r.points >= CHAT_MIN_POINTS);

  let paid = 0;
  for (const row of standings) {
    await apply(client, {
      userId: row.userId,
      delta: row.prize,
      kind: 'giveaway',
      reason: `Chat leaderboard — #${row.rank} for the week of ${weekLabel(week)}`,
      refType: 'chat_week',
      refId: week,
    });
    paid += row.prize;
  }

  await client.query(
    `UPDATE chat_weeks SET paid = $2, standings = $3 WHERE week_start = $1`,
    [
      week,
      paid,
      JSON.stringify(
        standings.map((r) => ({ rank: r.rank, userId: r.userId, name: r.name, points: r.points, prize: r.prize })),
      ),
    ],
  );
  return { weekStart: week, winners: standings.length, paid };
}

/** "17 Nov" for a YYYY-MM-DD Monday. */
export function weekLabel(weekStart: string): string {
  return new Date(`${weekStart}T00:00:00Z`).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  });
}
