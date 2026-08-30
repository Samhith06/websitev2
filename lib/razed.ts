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
 * NOT YET VERIFIED against a real response. §6 lists three things to confirm
 * with one real call, and until that happens `normalise` below is a tolerant
 * guess at the field names rather than a mapping anyone has checked:
 *   1. the exact field names on each row;
 *   2. whether `to` is inclusive, and what timezone the boundaries use;
 *   3. whether `top` accepts more than 25.
 */

const ENDPOINT = 'https://api.razed.com/player/api/v1/referrals/leaderboard';
const REFERRAL_CODE = 'Mattyspins';

export type RazedResult =
  | { ok: true; rows: RazedRow[]; fetchedAt: string; returned: number }
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
 * Pulls whatever shape Razed actually returns into our own. Deliberately
 * forgiving about names, and deliberately loud when it finds nothing it
 * recognises — a silent empty board is the failure mode worth avoiding.
 */
function normalise(payload: unknown): RazedRow[] | null {
  const container = payload as Record<string, unknown> | unknown[] | null;
  if (!container) return null;

  const list: unknown[] | null = Array.isArray(container)
    ? container
    : (['data', 'results', 'leaderboard', 'referrals', 'players'] as const)
        .map((k) => (container as Record<string, unknown>)[k])
        .find((v): v is unknown[] => Array.isArray(v)) ?? null;

  if (!list) return null;

  const rows: RazedRow[] = [];
  list.forEach((entry, index) => {
    const row = entry as Record<string, unknown>;
    const username =
      (row.username ?? row.user_name ?? row.name ?? row.player ?? row.displayName) as string | undefined;
    const wageredRaw =
      (row.wagered ?? row.wager ?? row.total_wagered ?? row.amount ?? row.volume) as
        | string
        | number
        | undefined;

    if (typeof username !== 'string') return;
    const wagered = typeof wageredRaw === 'string' ? Number(wageredRaw) : wageredRaw;
    if (!Number.isFinite(wagered)) return;

    rows.push({
      rank: Number(row.rank ?? row.position ?? index + 1),
      username,
      wagered: wagered as number,
    });
  });

  return rows.length ? rows.sort((a, b) => a.rank - b.rank) : null;
}

export async function fetchRazedLeaderboard({
  from,
  to,
  top = 25,
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

    const rows = normalise(await response.json());
    if (!rows) {
      return {
        ok: false,
        reason: 'shape',
        detail: 'Razed responded, but no row in it matched a shape we recognise.',
        fetchedAt,
      };
    }

    return { ok: true, rows, fetchedAt, returned: rows.length };
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
