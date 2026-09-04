import 'server-only';
import { one, rows, tx } from '@/lib/db';
import { fetchRazedLeaderboard, type RazedResult } from '@/lib/razed';

/**
 * Razed wager data, snapshotted.
 *
 * The blueprint left one question open: whether Razed exposes a lifetime
 * total. Verified against the live API, the answer is **no** — the referral
 * endpoint takes a from/to window and refuses anything wider than 45 days:
 *
 *   422 {"errors":{"to":["The date range must not exceed 45 days."]}}
 *
 * But it does answer for *past* windows, which is the part that saves the
 * feature. Lifetime is therefore reconstructed by walking backwards in 45-day
 * chunks and summing per username, so wagering done long before this site
 * launched still counts and no existing high roller starts the ladder at zero.
 *
 * The walk stops after a run of empty windows rather than at a hardcoded start
 * date, so it discovers when the referral code began producing data instead of
 * being told — and it cannot silently miss history if that date is wrong.
 *
 * Snapshots are appended, never overwritten. A partial or malformed sync
 * leaves the previous one intact, so the site keeps showing the last good
 * figures with a "last synced" timestamp rather than an empty leaderboard.
 */

/** Razed's hard limit on a single query. */
const MAX_WINDOW_DAYS = 45;

/** Stop once this many consecutive windows come back empty. */
const EMPTY_RUN_TO_STOP = 3;

/** A backstop so a bad clock cannot walk the API for ever. */
const MAX_WINDOWS = 60;

export const LIFETIME_PERIOD = 'lifetime';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type Snapshot = {
  id: number;
  period: string;
  fetchedAt: string;
  rowCount: number;
};

export type SyncOutcome =
  | { ok: true; snapshot: Snapshot; rowCount: number }
  | { ok: false; reason: string; detail: string };

/**
 * Pull one window and append it.
 *
 * A failed fetch writes nothing at all. The previous snapshot staying put is
 * the entire reason this is append-only, and half-writing a bad page would
 * throw that away.
 */
export async function syncPeriod(period: string, from: string, to: string): Promise<SyncOutcome> {
  const result: RazedResult = await fetchRazedLeaderboard({ from, to, top: 1000 });
  if (!result.ok) {
    return { ok: false, reason: result.reason, detail: result.detail };
  }
  return storeSnapshot(period, { from, to }, result.rows);
}

/**
 * Append one snapshot and its flattened rows, in a single transaction.
 *
 * The raw window metadata is kept alongside so a bad sync can be diagnosed
 * rather than guessed at — for the lifetime walk that is how many windows were
 * read, which is the thing you want to know when a total looks wrong.
 */
async function storeSnapshot(
  period: string,
  meta: Record<string, unknown>,
  rows: Array<{ username: string; wagered: number }>,
): Promise<SyncOutcome> {
  return tx(async (client) => {
    const { rows: inserted } = await client.query<{
      id: string;
      period: string;
      fetched_at: Date;
      row_count: number;
    }>(
      `INSERT INTO razed_snapshots (period, row_count, payload)
       VALUES ($1, $2, $3)
       RETURNING id::text, period, fetched_at, row_count`,
      [period, rows.length, JSON.stringify({ ...meta, rows })],
    );
    const snapshotId = Number(inserted[0].id);

    // One multi-row insert rather than a loop: a busy month is several hundred
    // usernames and this runs on a schedule.
    if (rows.length > 0) {
      const values: unknown[] = [];
      const tuples = rows.map((row, i) => {
        values.push(snapshotId, row.username, row.wagered);
        return `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`;
      });
      await client.query(
        `INSERT INTO razed_wagers (snapshot_id, username, wagered)
         VALUES ${tuples.join(', ')}
         ON CONFLICT (snapshot_id, username) DO NOTHING`,
        values,
      );
    }

    return {
      ok: true as const,
      rowCount: rows.length,
      snapshot: {
        id: snapshotId,
        period: inserted[0].period,
        fetchedAt: inserted[0].fetched_at.toISOString(),
        rowCount: inserted[0].row_count,
      },
    };
  });
}

/**
 * Rebuild the lifetime totals.
 *
 * Walks backwards in 45-day windows, summing each username's wagering, and
 * stops once three consecutive windows come back empty — the referral code has
 * a start date and past it there is nothing to find.
 *
 * A failure part-way through aborts without writing. Storing a partial walk
 * would publish a lifetime total that is quietly too low, and someone would
 * claim a milestone against it — the one outcome worse than not syncing.
 */
export async function syncLifetime(): Promise<SyncOutcome> {
  const totals = new Map<string, { username: string; wagered: number }>();
  let windows = 0;
  let emptyRun = 0;
  let end = new Date(`${today()}T00:00:00Z`);

  while (windows < MAX_WINDOWS && emptyRun < EMPTY_RUN_TO_STOP) {
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (MAX_WINDOW_DAYS - 1));

    const result = await fetchRazedLeaderboard({
      from: isoDay(start),
      to: isoDay(end),
      top: 1000,
    });

    if (!result.ok) {
      // `no-key` is a configuration problem, not a transient one, so it is
      // reported as-is rather than retried across sixty windows.
      return { ok: false, reason: result.reason, detail: result.detail };
    }

    if (result.rows.length === 0) emptyRun += 1;
    else emptyRun = 0;

    for (const row of result.rows) {
      const key = row.username.toLowerCase();
      const existing = totals.get(key);
      if (existing) existing.wagered += row.wagered;
      else totals.set(key, { username: row.username, wagered: row.wagered });
    }

    windows += 1;
    end = new Date(start);
    end.setUTCDate(end.getUTCDate() - 1);
  }

  const rows = [...totals.values()].sort((a, b) => b.wagered - a.wagered);
  return storeSnapshot(LIFETIME_PERIOD, { windows, through: today() }, rows);
}

export async function latestSnapshot(period: string): Promise<Snapshot | null> {
  const row = await one<{ id: string; period: string; fetched_at: Date; row_count: number }>(
    `SELECT id::text, period, fetched_at, row_count
       FROM razed_snapshots
      WHERE period = $1
      ORDER BY fetched_at DESC
      LIMIT 1`,
    [period],
  );
  return row
    ? {
        id: Number(row.id),
        period: row.period,
        fetchedAt: row.fetched_at.toISOString(),
        rowCount: row.row_count,
      }
    : null;
}

/**
 * Lifetime wagered for one Razed username, from the newest lifetime snapshot.
 *
 * Returns null — not zero — when there is no snapshot to read. A zero would
 * render as "you have wagered nothing", which is a different and wrong claim
 * from "we have not managed to ask Razed yet".
 */
export async function lifetimeWagered(username: string | null): Promise<number | null> {
  if (!username) return null;
  const row = await one<{ wagered: string }>(
    `SELECT w.wagered::text
       FROM razed_wagers w
       JOIN razed_snapshots s ON s.id = w.snapshot_id
      WHERE s.period = $1 AND lower(w.username) = lower($2)
      ORDER BY s.fetched_at DESC
      LIMIT 1`,
    [LIFETIME_PERIOD, username],
  );
  if (!row) {
    // Present in no snapshot means they have not wagered under the code, which
    // is a real zero — but only if we actually have a snapshot to be absent
    // from.
    const snapshot = await latestSnapshot(LIFETIME_PERIOD);
    return snapshot ? 0 : null;
  }
  return Number(row.wagered);
}

/** Whether a username appears in the referral data at all, for link submission. */
export async function wageredForUsername(username: string): Promise<number | null> {
  return lifetimeWagered(username);
}

/** The newest lifetime snapshot as rows, for the admin "Razed wagerers" screen. */
export async function latestWagerRows(
  period = LIFETIME_PERIOD,
  limit = 250,
): Promise<Array<{ username: string; wagered: number }>> {
  const result = await rows<{ username: string; wagered: string }>(
    `SELECT w.username, w.wagered::text
       FROM razed_wagers w
      WHERE w.snapshot_id = (
        SELECT id FROM razed_snapshots WHERE period = $1 ORDER BY fetched_at DESC LIMIT 1
      )
      ORDER BY w.wagered DESC
      LIMIT $2`,
    [period, limit],
  );
  return result.map((r) => ({ username: r.username, wagered: Number(r.wagered) }));
}

export type FeedHealth = {
  lastSyncAt: string | null;
  /** Anything older than an hour is worth shouting about. */
  stale: boolean;
};

export async function feedHealth(period = LIFETIME_PERIOD): Promise<FeedHealth> {
  const snapshot = await latestSnapshot(period);
  if (!snapshot) return { lastSyncAt: null, stale: true };
  const ageMs = Date.now() - new Date(snapshot.fetchedAt).getTime();
  return { lastSyncAt: snapshot.fetchedAt, stale: ageMs > 60 * 60 * 1000 };
}
