import 'server-only';
import type { PoolClient } from 'pg';
import { one } from '@/lib/db';

/**
 * Per-account rate limits.
 *
 * A flood test fired 25 rounds from one account in 1.7 seconds and every one
 * was accepted — roughly 880 a minute. Nothing about that is a human. Left
 * alone it lets a script hammer the database, drown the anomaly filters admin
 * uses to spot exactly this, and farm variance against the max-win cap.
 *
 * The counters are derived from rows that already exist — `game_rounds` for
 * play, `verification_codes` for codes — rather than a bucket table. That means
 * no new state to keep consistent, no eviction to get wrong, and the limit
 * survives a restart and applies across instances, which an in-memory counter
 * would not. Both queries hit an index that is already there.
 */

/**
 * Rounds per minute. Keno's reveal alone takes about 1.3 seconds, so a person
 * playing flat out lands somewhere near 40. Sixty leaves that untouched while
 * cutting a script by roughly fifteen times.
 */
export const ROUNDS_PER_MINUTE = 60;

/** Verification codes per hour. Each is single-use and lasts ten minutes. */
export const CODES_PER_HOUR = 10;

export type RateLimited = { ok: false; error: 'rate-limited'; detail: string; retryAfter: number };

/**
 * Checked inside the round's own transaction, so two requests arriving together
 * cannot both read a count taken before either of them inserted.
 */
export async function roundsInLastMinute(client: PoolClient, userId: number): Promise<number> {
  const { rows } = await client.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM game_rounds
      WHERE user_id = $1 AND created_at > now() - interval '1 minute'`,
    [userId],
  );
  return Number(rows[0]?.n ?? 0);
}

export function tooManyRounds(): RateLimited {
  return {
    ok: false,
    error: 'rate-limited',
    detail:
      `That is more than ${ROUNDS_PER_MINUTE} rounds in a minute. ` +
      'Give it a moment — the limit is there to keep the games responsive for everybody.',
    retryAfter: 30,
  };
}

export async function codesInLastHour(userId: number): Promise<number> {
  const row = await one<{ n: string }>(
    `SELECT count(*)::text AS n FROM verification_codes
      WHERE user_id = $1 AND created_at > now() - interval '1 hour'`,
    [userId],
  );
  return Number(row?.n ?? 0);
}

export function tooManyCodes(): RateLimited {
  return {
    ok: false,
    error: 'rate-limited',
    detail:
      `That is ${CODES_PER_HOUR} codes in an hour. Each one lasts ten minutes — ` +
      'type the last one in Matty’s chat, or wait a little before asking for another.',
    retryAfter: 600,
  };
}
