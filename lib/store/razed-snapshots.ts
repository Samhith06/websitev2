import 'server-only';
import { one, rows, tx } from '@/lib/db';
import { fetchRazedLeaderboard, type RazedResult } from '@/lib/razed';

/**
 * Razed wager data, snapshotted.
 *
 * The blueprint left one question open: whether Razed exposes a lifetime
 * total. It does not expose one directly — the referral endpoint takes a
 * from/to window — but a window is enough, because a `from` earlier than the
 * channel existed returns everything. That is what LIFETIME_FROM is, and it
 * means the milestone ladder counts wagering done long before this site
 * launched rather than starting every existing high roller at zero.
 *
 * Snapshots are appended, never overwritten. A partial or malformed sync
 * leaves the previous one intact, so the site keeps showing the last good
 * figures with a "last synced" timestamp rather than an empty leaderboard.
 */

/** Earlier than the referral code existed, so the window is effectively "all". */
const LIFETIME_FROM = '2020-01-01';
export const LIFETIME_PERIOD = 'lifetime';

function today(): string {
  return new Date().toISOString().slice(0, 10);
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
  const result: RazedResult = await fetchRazedLeaderboard({ from, to, top: 500 });
  if (!result.ok) {
    return { ok: false, reason: result.reason, detail: result.detail };
  }

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
      [period, result.rows.length, JSON.stringify({ from, to, rows: result.rows })],
    );
    const snapshotId = Number(inserted[0].id);

    // One multi-row insert rather than a loop: a busy month is several hundred
    // usernames and this runs every ten minutes.
    if (result.rows.length > 0) {
      const values: unknown[] = [];
      const tuples = result.rows.map((row, i) => {
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
      rowCount: result.rows.length,
      snapshot: {
        id: snapshotId,
        period: inserted[0].period,
        fetchedAt: inserted[0].fetched_at.toISOString(),
        rowCount: inserted[0].row_count,
      },
    };
  });
}

export async function syncLifetime(): Promise<SyncOutcome> {
  return syncPeriod(LIFETIME_PERIOD, LIFETIME_FROM, today());
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
