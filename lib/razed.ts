import 'server-only';
import { maskUsername } from './format';
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
 * Razed's own ceiling on `top`, verified against the live API:
 *
 *   422 {"errors":{"top":["The top must not be greater than 100."]}}
 *
 * So a busy month cannot be read in one request, and asking for more is a hard
 * failure rather than a silent truncation. `fetchRazedLeaderboard` pages
 * instead.
 */
const MAX_TOP = 100;

/**
 * How many pages we are willing to walk before deciding something is wrong.
 * Ten thousand referred accounts in one window would be a wonderful problem
 * and is still worth refusing to loop over.
 */
const MAX_PAGES = 100;

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

/**
 * Masking happens here, on the server. The browser never sees a full name.
 *
 * There is one masking rule for the whole site and it lives in `lib/format`;
 * this is the alias so the board and the profile can never drift into
 * showing the same person two different ways.
 */
export const mask = maskUsername;

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

/**
 * Reads a whole window, paging until Razed says there is no more.
 *
 * `top` is capped at 100 by the API, so a busy month genuinely needs several
 * requests. Walking the pages here rather than returning a truncated board is
 * the difference between an accurate leaderboard and one that quietly stops at
 * position 100 — which nobody would notice until the person in 101st place did.
 *
 * A failure on any page abandons the whole window rather than returning what
 * was gathered so far. A partial board is worse than a stated failure: it looks
 * complete, and the ranks below the break are all wrong.
 */
export async function fetchRazedLeaderboard({
  from,
  to,
  top = MAX_TOP,
}: {
  from: string;
  to: string;
  /** Rows to read in total. Requests are still paged at 100 apiece. */
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

  const perPage = Math.min(top, MAX_TOP);
  const collected: Array<{ username: string; wagered: number }> = [];
  let total = 0;
  let page = 1;
  let lastPage = 1;

  try {
    do {
      const url = new URL(ENDPOINT);
      url.searchParams.set('referral_code', REFERRAL_CODE);
      url.searchParams.set('from', from);
      url.searchParams.set('to', to);
      url.searchParams.set('top', String(perPage));
      url.searchParams.set('page', String(page));

      const response = await fetch(url, {
        headers: { 'X-Referral-Key': key, accept: 'application/json' },
        // Poll every ten minutes rather than on every page view.
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

      collected.push(...parsed.rows.map((r) => ({ username: r.username, wagered: r.wagered })));
      total = parsed.total;
      lastPage = parsed.pages;
      page += 1;
    } while (page <= lastPage && page <= MAX_PAGES && collected.length < top);

    // Ranked once, over everything gathered, rather than per page — otherwise
    // every page would restart the numbering at 1.
    collected.sort((a, b) => b.wagered - a.wagered);
    const rows: RazedRow[] = collected
      .slice(0, top)
      .map((row, index) => ({ rank: index + 1, username: row.username, wagered: row.wagered }));

    return {
      ok: true,
      rows,
      fetchedAt,
      returned: rows.length,
      total,
      truncated: rows.length < total,
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
