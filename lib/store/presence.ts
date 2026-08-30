import 'server-only';
import { one, rows, tx, write } from '@/lib/db';
import { apply } from './coins';
import { multiplierFor } from './accounts';

/**
 * Presence and the coin tick (Master Plan §3, §5).
 *
 * Kick's public API cannot tell us who is watching — there is no viewer roster
 * and no join/leave event, and the livestream endpoint returns an aggregate
 * count only. The single per-user live signal is `chat.message.sent`. So
 * presence is *inferred*: any chat message opens a 15-minute window, and a tick
 * pays only the people with an open one.
 *
 * The gate this file exists to enforce: **a window can only be opened for a
 * verified Kick link.** Coins for watching require a proven Kick account, so
 * `openWindow` takes a `userId` that only the webhook can produce — by looking
 * the chat sender's numeric Kick id up in `kick_links`.
 */

export const TICK_MINUTES = 3;
export const WINDOW_MINUTES = 15;
/** 20 consecutive ticks with no gap is one full hour of watching. */
export const HOUR_BONUS_TICKS = 20;
export const HOUR_BONUS = 10;
/** Per hour, per multiplier. At 1.5h/day this only ever catches an exploit. */
export const HOURLY_CEILING = 30;

/* -------------------------------------------------------------------------- */
/* Windows                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Opens or extends a window. Re-opening after a lapse resets the streak: the
 * hour bonus is for an unbroken hour, and quietly carrying a streak across a
 * gap would pay for time nobody was here.
 */
export async function openWindow(userId: number, source: 'chat' | 'drop' | 'heartbeat'): Promise<void> {
  await write(
    `INSERT INTO presence_windows (user_id, opened_at, expires_at, source, streak)
     VALUES ($1, now(), now() + ($2 || ' minutes')::interval, $3, 0)
     ON CONFLICT (user_id) DO UPDATE
       SET expires_at = now() + ($2 || ' minutes')::interval,
           source     = EXCLUDED.source,
           opened_at  = CASE
                          WHEN presence_windows.expires_at < now() THEN now()
                          ELSE presence_windows.opened_at
                        END,
           streak     = CASE
                          WHEN presence_windows.expires_at < now() THEN 0
                          ELSE presence_windows.streak
                        END`,
    [userId, String(WINDOW_MINUTES), source],
  );
}

export async function openWindowCount(): Promise<number> {
  const row = await one<{ n: string }>(
    'SELECT count(*)::text AS n FROM presence_windows WHERE expires_at > now()',
  );
  return Number(row?.n ?? 0);
}

/* -------------------------------------------------------------------------- */
/* Stream sessions                                                            */
/* -------------------------------------------------------------------------- */

export async function streamWentLive(title: string | null = null): Promise<void> {
  await write(
    `INSERT INTO stream_sessions (started_at, title) SELECT now(), $1
      WHERE NOT EXISTS (SELECT 1 FROM stream_sessions WHERE ended_at IS NULL)`,
    [title],
  );
  // A title can change mid-stream, so keep the open session current.
  if (title) {
    await write(`UPDATE stream_sessions SET title = $1 WHERE ended_at IS NULL`, [title]);
  }
}

/** Offline closes every window, so no tick can pay after the stream stops. */
export async function streamWentOffline(): Promise<void> {
  await tx(async (client) => {
    await client.query(
      'UPDATE stream_sessions SET ended_at = now() WHERE ended_at IS NULL',
    );
    await client.query('DELETE FROM presence_windows');
  });
}

export async function isStreamOpen(): Promise<boolean> {
  const row = await one<{ id: string }>(
    'SELECT id::text FROM stream_sessions WHERE ended_at IS NULL LIMIT 1',
  );
  return Boolean(row);
}

/* -------------------------------------------------------------------------- */
/* The tick                                                                   */
/* -------------------------------------------------------------------------- */

export type TickResult = {
  ran: boolean;
  reason?: 'not-live' | 'too-soon';
  paid: number;
  coins: number;
  bonuses: number;
};

type Candidate = {
  user_id: string;
  streak: number;
  gap_seconds: string | null;
  sub_active_until: Date | null;
  is_vip: boolean;
  earned_last_hour: string;
};

/**
 * One tick. Idempotent enough to be safe if the cron fires twice: the open
 * stream session row is locked and its `last_tick_at` is checked, so a second
 * call inside the interval is refused rather than paying twice.
 *
 * Frozen accounts are skipped — a chat ban freezes accrual for its duration —
 * and the join to `kick_links` is what makes verification a hard requirement
 * rather than a convention.
 */
export async function runTick(): Promise<TickResult> {
  return tx(async (client) => {
    const { rows: session } = await client.query<{ id: string; last_tick_at: Date | null }>(
      `SELECT id::text, last_tick_at FROM stream_sessions
        WHERE ended_at IS NULL
        FOR UPDATE`,
    );
    if (!session[0]) return { ran: false, reason: 'not-live', paid: 0, coins: 0, bonuses: 0 } as const;

    const last = session[0].last_tick_at;
    if (last && Date.now() - last.getTime() < TICK_MINUTES * 60_000 * 0.9) {
      return { ran: false, reason: 'too-soon', paid: 0, coins: 0, bonuses: 0 } as const;
    }

    const { rows: candidates } = await client.query<Candidate>(
      `SELECT p.user_id::text,
              p.streak,
              EXTRACT(EPOCH FROM (now() - p.last_tick_at))::text AS gap_seconds,
              s.sub_active_until,
              COALESCE(s.is_vip, false) AS is_vip,
              COALESCE((
                SELECT SUM(l.delta) FROM coin_ledger l
                 WHERE l.user_id = p.user_id
                   AND l.kind IN ('watch', 'bonus')
                   AND l.created_at >= now() - interval '1 hour'
              ), 0)::text AS earned_last_hour
         FROM presence_windows p
         JOIN kick_links k ON k.user_id = p.user_id
         JOIN users     u ON u.id = p.user_id
    LEFT JOIN sub_state s ON s.user_id = p.user_id
        WHERE p.expires_at > now()
          AND u.status = 'active'
        ORDER BY p.user_id
        FOR UPDATE OF p`,
    );

    let paid = 0;
    let coinsAwarded = 0;
    let bonuses = 0;

    for (const candidate of candidates) {
      const userId = Number(candidate.user_id);
      const multiplier = multiplierFor({
        subActiveUntil: candidate.sub_active_until ? candidate.sub_active_until.toISOString() : null,
        isVip: candidate.is_vip,
      }).value;

      // A gap longer than one and a half intervals means a tick was missed, so
      // the run towards the hour bonus starts again.
      const gap = candidate.gap_seconds === null ? null : Number(candidate.gap_seconds);
      const continuous = gap !== null && gap <= TICK_MINUTES * 60 * 1.5;
      const streak = continuous ? candidate.streak + 1 : 1;

      const ceiling = Math.round(HOURLY_CEILING * multiplier);
      const alreadyEarned = Number(candidate.earned_last_hour);
      let award = Math.round(1 * multiplier);
      const bonusDue = streak >= HOUR_BONUS_TICKS;
      if (bonusDue) award += Math.round(HOUR_BONUS * multiplier);

      // The ceiling trims the award rather than skipping it, so somebody at the
      // limit still sees their streak advance.
      const headroom = Math.max(0, ceiling - alreadyEarned);
      award = Math.min(award, headroom);

      await client.query(
        `UPDATE presence_windows
            SET streak = $2, last_tick_at = now()
          WHERE user_id = $1`,
        [userId, bonusDue ? 0 : streak],
      );

      if (award <= 0) continue;

      if (bonusDue) {
        bonuses += 1;
        await apply(client, {
          userId,
          delta: award,
          kind: 'bonus',
          reason: 'Full hour watched',
          multiplier,
        });
      } else {
        await apply(client, {
          userId,
          delta: award,
          kind: 'watch',
          reason: `Watching — ${TICK_MINUTES} minute tick`,
          multiplier,
        });
      }
      paid += 1;
      coinsAwarded += award;
    }

    await client.query(
      `UPDATE stream_sessions
          SET tick_count = tick_count + 1, last_tick_at = now()
        WHERE id = $1`,
      [session[0].id],
    );

    return { ran: true, paid, coins: coinsAwarded, bonuses };
  });
}

/** Admin's feed card: how many people are currently earning. */
export async function earnersNow(): Promise<number> {
  const row = await one<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM presence_windows p
       JOIN kick_links k ON k.user_id = p.user_id
      WHERE p.expires_at > now()`,
  );
  return Number(row?.n ?? 0);
}

export async function lastTickAt(): Promise<string | null> {
  const row = await one<{ last_tick_at: Date | null }>(
    'SELECT last_tick_at FROM stream_sessions ORDER BY started_at DESC LIMIT 1',
  );
  return row?.last_tick_at ? row.last_tick_at.toISOString() : null;
}

/** Housekeeping so the two append-heavy tables do not grow without bound. */
export async function pruneOldEvents(): Promise<void> {
  await rows(`DELETE FROM kick_events WHERE received_at < now() - interval '3 days'`);
  await rows(`DELETE FROM presence_windows WHERE expires_at < now() - interval '1 day'`);
}
