import 'server-only';
import { one, rows, tx, write } from '@/lib/db';
import type { Period, PeriodStatus, PrizeTier } from '@/lib/types';

/**
 * Leaderboard periods and their prize tiers (Master Plan §7).
 *
 * Two rules shape this file:
 *
 *   • **A period is a decision, not a clock.** Its dates are set by hand and
 *     stored, because they are what gets sent to Razed as `from`/`to`. The
 *     previous version derived them from the server's boot time, so the window
 *     moved on every deploy — a board nobody can defend if a result is queried.
 *
 *   • **The pot is derived, never stored.** It is summed from the tiers, so the
 *     advertised prize pool can never disagree with what the tiers actually pay
 *     out. The old hardcoded $6,000 sat next to tiers totalling $6,400, which is
 *     exactly the drift this prevents.
 */

export type PeriodType = 'weekly' | 'monthly';

export type StoredPeriod = {
  id: number;
  type: PeriodType;
  startsAt: string;
  endsAt: string;
  status: PeriodStatus;
  lockedAt: string | null;
  tiers: PrizeTier[];
  /** Summed from the tiers. */
  pot: number;
};

type PeriodRow = {
  id: string;
  type: string;
  starts_at: Date;
  ends_at: Date;
  status: string;
  locked_at: Date | null;
};

type TierRow = {
  id: string;
  period_id: string;
  rank_from: number;
  rank_to: number;
  amount: number;
  currency: string;
};

function toTier(row: TierRow): PrizeTier {
  return {
    id: row.id,
    rankFrom: row.rank_from,
    rankTo: row.rank_to,
    amount: row.amount,
    currency: row.currency,
  };
}

/** A range tier pays every rank inside it, so the pot counts each one. */
export function potOf(tiers: PrizeTier[]): number {
  return tiers.reduce((total, t) => total + (t.rankTo - t.rankFrom + 1) * t.amount, 0);
}

function toPeriod(row: PeriodRow, tiers: PrizeTier[]): StoredPeriod {
  return {
    id: Number(row.id),
    type: row.type === 'monthly' ? 'monthly' : 'weekly',
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    status: row.status as PeriodStatus,
    lockedAt: row.locked_at ? row.locked_at.toISOString() : null,
    tiers,
    pot: potOf(tiers),
  };
}

const PERIOD_COLUMNS = 'id::text, type, starts_at, ends_at, status, locked_at';

async function tiersFor(periodIds: number[]): Promise<Map<number, PrizeTier[]>> {
  const map = new Map<number, PrizeTier[]>();
  if (periodIds.length === 0) return map;

  const found = await rows<TierRow>(
    `SELECT id::text, period_id::text, rank_from, rank_to, amount, currency
       FROM prize_tiers
      WHERE period_id = ANY($1::bigint[])
      ORDER BY rank_from`,
    [periodIds],
  );
  for (const row of found) {
    const key = Number(row.period_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(toTier(row));
  }
  return map;
}

async function hydrate(periodRows: PeriodRow[]): Promise<StoredPeriod[]> {
  const tiers = await tiersFor(periodRows.map((r) => Number(r.id)));
  return periodRows.map((r) => toPeriod(r, tiers.get(Number(r.id)) ?? []));
}

/** Everything, newest first — the admin list and the public archive. */
export async function listPeriods(limit = 50): Promise<StoredPeriod[]> {
  return hydrate(
    await rows<PeriodRow>(
      `SELECT ${PERIOD_COLUMNS} FROM lb_periods ORDER BY starts_at DESC LIMIT $1`,
      [limit],
    ),
  );
}

export async function periodById(id: number): Promise<StoredPeriod | null> {
  const row = await one<PeriodRow>(`SELECT ${PERIOD_COLUMNS} FROM lb_periods WHERE id = $1`, [id]);
  return row ? (await hydrate([row]))[0] : null;
}

/** The board a visitor sees for a type: the open one, else the most recent. */
export async function currentPeriod(type: PeriodType): Promise<StoredPeriod | null> {
  const row = await one<PeriodRow>(
    `SELECT ${PERIOD_COLUMNS} FROM lb_periods
      WHERE type = $1
      ORDER BY (status = 'open') DESC, starts_at DESC
      LIMIT 1`,
    [type],
  );
  return row ? (await hydrate([row]))[0] : null;
}

export async function frozenPeriod(): Promise<StoredPeriod | null> {
  const row = await one<PeriodRow>(
    `SELECT ${PERIOD_COLUMNS} FROM lb_periods
      WHERE status = 'frozen' ORDER BY ends_at DESC LIMIT 1`,
  );
  return row ? (await hydrate([row]))[0] : null;
}

export async function archivedPeriods(limit = 24): Promise<StoredPeriod[]> {
  return hydrate(
    await rows<PeriodRow>(
      `SELECT ${PERIOD_COLUMNS} FROM lb_periods
        WHERE status IN ('paid', 'archived')
        ORDER BY ends_at DESC LIMIT $1`,
      [limit],
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                     */
/* -------------------------------------------------------------------------- */

export class PeriodError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PeriodError';
  }
}

/**
 * Creates a period, optionally copying the tiers from the last one of its type
 * so a weekly board is one form submission rather than five.
 */
export async function createPeriod(input: {
  type: PeriodType;
  startsAt: string;
  endsAt: string;
  copyTiersFromLast?: boolean;
  createdBy?: string;
}): Promise<StoredPeriod> {
  const starts = new Date(input.startsAt);
  const ends = new Date(input.endsAt);
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) {
    throw new PeriodError('Both dates are required.');
  }
  if (ends <= starts) {
    throw new PeriodError('The end of a period has to come after its start.');
  }

  return tx(async (client) => {
    const open = await client.query(
      `SELECT id FROM lb_periods WHERE type = $1 AND status = 'open'`,
      [input.type],
    );
    if (open.rows.length) {
      throw new PeriodError(
        `There is already an open ${input.type} board. Freeze it before opening the next one.`,
      );
    }

    const { rows: created } = await client.query<PeriodRow>(
      `INSERT INTO lb_periods (type, starts_at, ends_at, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING ${PERIOD_COLUMNS}`,
      [input.type, starts.toISOString(), ends.toISOString(), input.createdBy ?? null],
    );
    const period = created[0];

    if (input.copyTiersFromLast) {
      await client.query(
        `INSERT INTO prize_tiers (period_id, rank_from, rank_to, amount, currency, updated_by)
         SELECT $1, rank_from, rank_to, amount, currency, $2
           FROM prize_tiers
          WHERE period_id = (
            SELECT p.id FROM lb_periods p
             WHERE p.type = $3 AND p.id <> $1
             ORDER BY p.starts_at DESC LIMIT 1
          )`,
        [period.id, input.createdBy ?? null, input.type],
      );
    }

    const { rows: tierRows } = await client.query<TierRow>(
      `SELECT id::text, period_id::text, rank_from, rank_to, amount, currency
         FROM prize_tiers WHERE period_id = $1 ORDER BY rank_from`,
      [period.id],
    );
    return toPeriod(period, tierRows.map(toTier));
  });
}

export async function updatePeriodDates(
  id: number,
  startsAt: string,
  endsAt: string,
): Promise<void> {
  const starts = new Date(startsAt);
  const ends = new Date(endsAt);
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) {
    throw new PeriodError('Both dates are required.');
  }
  if (ends <= starts) throw new PeriodError('The end of a period has to come after its start.');

  const period = await periodById(id);
  if (!period) throw new PeriodError('That period no longer exists.');
  if (period.status !== 'open') {
    // A frozen board is the record of what was competed for. Moving its dates
    // afterwards would change the question people had already answered.
    throw new PeriodError('A period that is no longer open cannot have its dates changed.');
  }

  await write(`UPDATE lb_periods SET starts_at = $2, ends_at = $3 WHERE id = $1`, [
    id,
    starts.toISOString(),
    ends.toISOString(),
  ]);
}

/**
 * Freezing locks the ranks. It is deliberately a button rather than a clock:
 * the moment a board closes is the moment prizes are owed, and that should be
 * something a person did, at a time recorded, not something that happened.
 */
export async function setPeriodStatus(id: number, status: PeriodStatus): Promise<void> {
  await write(
    `UPDATE lb_periods
        SET status = $2,
            locked_at = CASE WHEN $2 = 'frozen' AND locked_at IS NULL THEN now() ELSE locked_at END
      WHERE id = $1`,
    [id, status],
  );
}

export async function upsertTier(input: {
  periodId: number;
  tierId?: number | null;
  rankFrom: number;
  rankTo: number;
  amount: number;
  currency?: string;
  updatedBy?: string;
}): Promise<void> {
  if (!Number.isInteger(input.rankFrom) || input.rankFrom < 1) {
    throw new PeriodError('The first rank has to be 1 or higher.');
  }
  if (!Number.isInteger(input.rankTo) || input.rankTo < input.rankFrom) {
    throw new PeriodError('The last rank cannot come before the first.');
  }
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw new PeriodError('An amount cannot be negative.');
  }

  try {
    if (input.tierId) {
      await write(
        `UPDATE prize_tiers
            SET rank_from = $2, rank_to = $3, amount = $4, currency = $5,
                updated_by = $6, updated_at = now()
          WHERE id = $1`,
        [input.tierId, input.rankFrom, input.rankTo, Math.round(input.amount),
         input.currency ?? 'USD', input.updatedBy ?? null],
      );
    } else {
      await write(
        `INSERT INTO prize_tiers (period_id, rank_from, rank_to, amount, currency, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [input.periodId, input.rankFrom, input.rankTo, Math.round(input.amount),
         input.currency ?? 'USD', input.updatedBy ?? null],
      );
    }
  } catch (error) {
    // The exclusion constraint is the real check; this turns it into English.
    if (error instanceof Error && /prize_tiers_no_overlap/.test(error.message)) {
      throw new PeriodError(
        `Ranks ${input.rankFrom}–${input.rankTo} overlap a tier that already exists. ` +
        'A rank can only be paid once.',
      );
    }
    throw error;
  }
}

export async function deleteTier(tierId: number): Promise<void> {
  await write('DELETE FROM prize_tiers WHERE id = $1', [tierId]);
}

/** What a rank is worth on a given period. */
export function prizeForRank(tiers: PrizeTier[], rank: number): number {
  return tiers.find((t) => rank >= t.rankFrom && rank <= t.rankTo)?.amount ?? 0;
}

/** The shape the public board components already expect. */
export function toUiPeriod(period: StoredPeriod, rows: Period['rows']): Period {
  return {
    id: String(period.id),
    type: period.type,
    startsAt: period.startsAt,
    endsAt: period.endsAt,
    status: period.status,
    pot: period.pot,
    rows,
  };
}
