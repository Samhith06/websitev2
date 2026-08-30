import 'server-only';
import type { FeedHealth, LeaderboardRow } from './types';

/**
 * The Razed referral leaderboard (Master Plan §6).
 *
 *   GET https://api.razed.com/player/api/v1/referrals/leaderboard
 *   Header: X-Referral-Key: <secret>
 *   Params: referral_code, from, to, top
 *
 * Two rules this file exists to enforce:
 *
 *   • **The key never leaves the server.** It is read from the environment
 *     here, in a server-only module. The browser talks to our own routes and
 *     never to Razed.
 *
 *   • **Silence is never mistaken for zero.** If the call fails we say so and
 *     show the last figures we had, because a leaderboard that quietly renders
 *     an empty board during a close finish is how you get accused of rigging.
 *
 * VERIFIED against a real response. The three things §6 asked us to confirm:
 *
 *   1. **Row shape** is `{ username, referred_by_code, wagered }` and nothing
 *      else. There is no rank field — rows arrive sorted by wagered descending
 *      and rank is that position. `wagered` is a *string* carrying 18 decimal
 *      places, so it is parsed rather than used directly.
 *   2. **`to` is inclusive.** A single-day window (`from` = `to`) returns that
 *      day's wagering, and two halves of a month sum to the whole.
 *   3. **`top` does exceed 25** — it maps to `per_page`, and `top=100` returned
 *      all 33 rows on one page.
 *
 * The response is paginated (`current_page`, `last_page`, `per_page`, `total`).
 * We ask for one large page rather than walking pages, and if `last_page` is
 * ever greater than 1 the result says so, because a board silently missing its
 * tail is worse than one that admits it is truncated.
 */

const ENDPOINT = 'https://api.razed.com/player/api/v1/referrals/leaderboard';
const REFERRAL_CODE = 'Mattyspins';

/**
 * Deliberately well above the 25 the plan mentions. 25 is what the *page*
 * shows; this is what we read, so admin can see everyone who qualified and the
 * board is never truncated without us knowing.
 */
const DEFAULT_TOP = 100;

export type RazedResult =
  | {
      ok: true;
      rows: RazedRow[];
      fetchedAt: string;
      /** How many rows we are showing. */
      returned: number;
      /** How many Razed says exist for the window — larger means truncated. */
      total: number;
      /** True when a further page exists that we did not read. */
      truncated: boolean;
    }
  | { ok: false; reason: 'no-key' | 'http' | 'network' | 'shape'; detail: string; fetchedAt: string };

export type RazedRow = {
  rank: number;
  username: string;
  wagered: number;
};

/** Masking happens here, on the server. The browser never sees a full name. */
export function mask(username: string): string {
  if (username.length <= 4) return `${username.slice(0, 1)}***`;
  const keepFront = Math.min(3, username.length - 2);
  return `${username.slice(0, keepFront)}${'*'.repeat(Math.max(3, username.length - keepFront - 1))}${username.slice(-1)}`;
}

/**
 * Turns Razed's payload into our own rows.
 *
 * The field names are now known, so this reads them directly and treats a
 * missing one as a shape failure rather than papering over it. Being loud here
 * is the point: if Razed changes the response, the board must say it cannot be
 * read, not quietly render as empty.
 *
 * Rank is derived from the sort rather than trusted from the payload — there is
 * no rank field, and re-sorting locally means the numbering can never disagree
 * with the wagered column printed beside it.
 */
function normalise(payload: unknown): { rows: RazedRow[]; total: number; pages: number } | null {
  const body = payload as Record<string, unknown> | null;
  if (!body || !Array.isArray(body.data)) return null;

  const parsed: Array<{ username: string; wagered: number }> = [];
  for (const entry of body.data) {
    const row = entry as Record<string, unknown>;
    if (typeof row.username !== 'string') return null;

    // `wagered` arrives as a string with eighteen decimal places.
    const wagered = Number(row.wagered);
    if (!Number.isFinite(wagered)) return null;

    parsed.push({ username: row.username, wagered });
  }

  parsed.sort((a, b) => b.wagered - a.wagered);

  return {
    rows: parsed.map((row, index) => ({ rank: index + 1, username: row.username, wagered: row.wagered })),
    total: Number(body.total ?? parsed.length),
    pages: Number(body.last_page ?? 1),
  };
}

export async function fetchRazedLeaderboard({
  from,
  to,
  top = DEFAULT_TOP,
}: {
  from: string;
  to: string;
  top?: number;
}): Promise<RazedResult> {
  const fetchedAt = new Date().toISOString();
  const key = process.env.RAZED_REFERRAL_KEY;

  if (!key) {
    return {
      ok: false,
      reason: 'no-key',
      detail: 'RAZED_REFERRAL_KEY is not set, so the board has nothing to read.',
      fetchedAt,
    };
  }

  const url = new URL(ENDPOINT);
  url.searchParams.set('referral_code', REFERRAL_CODE);
  url.searchParams.set('from', from);
  url.searchParams.set('to', to);
  url.searchParams.set('top', String(top));

  try {
    const response = await fetch(url, {
      headers: { 'X-Referral-Key': key, accept: 'application/json' },
      // Poll every ten minutes (§6) rather than on every page view.
      next: { revalidate: 600 },
    });

    if (!response.ok) {
      return {
        ok: false,
        reason: 'http',
        detail: `Razed returned ${response.status} ${response.statusText}.`,
        fetchedAt,
      };
    }

    const parsed = normalise(await response.json());
    if (!parsed) {
      return {
        ok: false,
        reason: 'shape',
        detail: 'Razed responded, but the payload did not match the shape we read.',
        fetchedAt,
      };
    }

    return {
      ok: true,
      rows: parsed.rows,
      fetchedAt,
      returned: parsed.rows.length,
      total: parsed.total,
      truncated: parsed.pages > 1,
    };
  } catch (error) {
    return {
      ok: false,
      reason: 'network',
      detail: error instanceof Error ? error.message : 'The request to Razed failed.',
      fetchedAt,
    };
  }
}

/**
 * Attaches prize money to the ranked rows. Prizes are Matty's own tiers, not
 * anything Razed knows about.
 */
export function toBoardRows(
  rows: RazedRow[],
  prizeFor: (rank: number) => number,
): LeaderboardRow[] {
  return rows.map((row) => ({
    rank: row.rank,
    maskedUsername: mask(row.username),
    wagered: row.wagered,
    prize: prizeFor(row.rank),
    // Movement needs two snapshots to compare; it stays null until the poller
    // is storing them (§6).
    movement: null,
  }));
}

export function healthFrom(result: RazedResult): FeedHealth {
  if (result.ok) {
    return { lastSyncAt: result.fetchedAt, status: 'healthy', code: '200 OK' };
  }
  return {
    lastSyncAt: result.fetchedAt,
    status: result.reason === 'no-key' ? 'stale' : 'failing',
    code: result.detail,
  };
}
