import 'server-only';
import type { PoolClient } from 'pg';
import { one, rows, tx } from '@/lib/db';
import type { LedgerEntry } from '@/lib/types';

/**
 * Every coin that exists moves through `apply` and nowhere else.
 *
 * The ledger is append-only and `coin_balances` is a cache written in the same
 * transaction as its ledger row, so the two can never disagree. Nothing outside
 * this file is allowed to UPDATE a balance — if it did, the ledger would stop
 * being the record of what happened and become a second opinion about it.
 *
 * `delta` is signed: +40 for a watch tick, −20 for a bet, +140 for the payout.
 * A round writes one row for the stake and one for the payout, so a player can
 * read what happened rather than a single netted figure.
 */

export type CoinKind =
  | 'watch' | 'bonus' | 'game' | 'redemption' | 'giveaway' | 'adjustment' | 'refund';

export type Movement = {
  userId: number;
  delta: number;
  kind: CoinKind;
  reason: string;
  refType?: string | null;
  refId?: string | null;
  multiplier?: number | null;
};

export type Balance = { balance: number; lifetimeEarned: number };

/**
 * Applies one movement inside a caller-supplied transaction.
 *
 * The `FOR UPDATE` row lock is the whole point: two requests spending the same
 * coins at the same moment queue behind each other instead of both reading the
 * same balance and both succeeding. It also means a balance can never go
 * negative — the CHECK constraint on the column is the backstop, this is the
 * thing that stops it being hit.
 */
export async function apply(client: PoolClient, movement: Movement): Promise<Balance> {
  await client.query(
    `INSERT INTO coin_balances (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [movement.userId],
  );
  const { rows: locked } = await client.query<{ balance: number; lifetime_earned: number }>(
    'SELECT balance, lifetime_earned FROM coin_balances WHERE user_id = $1 FOR UPDATE',
    [movement.userId],
  );
  const before = locked[0] ?? { balance: 0, lifetime_earned: 0 };

  const balance = before.balance + movement.delta;
  if (balance < 0) {
    throw new InsufficientCoins(before.balance, -movement.delta);
  }

  // "Lifetime earned" means coins the stream paid out, so a game payout does
  // not count towards it — otherwise a player could inflate the figure by
  // betting back and forth without ever having watched anything.
  const earned = movement.delta > 0 && (movement.kind === 'watch' || movement.kind === 'bonus')
    ? movement.delta
    : 0;
  const lifetimeEarned = before.lifetime_earned + earned;

  await client.query(
    `UPDATE coin_balances
        SET balance = $2, lifetime_earned = $3, updated_at = now()
      WHERE user_id = $1`,
    [movement.userId, balance, lifetimeEarned],
  );

  await client.query(
    `INSERT INTO coin_ledger
       (user_id, delta, kind, reason, ref_type, ref_id, multiplier, balance_after)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      movement.userId,
      movement.delta,
      movement.kind,
      movement.reason,
      movement.refType ?? null,
      movement.refId ?? null,
      movement.multiplier ?? null,
      balance,
    ],
  );

  return { balance, lifetimeEarned };
}

export class InsufficientCoins extends Error {
  constructor(readonly balance: number, readonly needed: number) {
    super(`Balance ${balance} cannot cover ${needed}.`);
    this.name = 'InsufficientCoins';
  }
}

/** A movement on its own, when there is no wider transaction to join. */
export async function record(movement: Movement): Promise<Balance> {
  return tx((client) => apply(client, movement));
}

export async function balanceOf(userId: number): Promise<Balance> {
  const row = await one<{ balance: number; lifetime_earned: number }>(
    'SELECT balance, lifetime_earned FROM coin_balances WHERE user_id = $1',
    [userId],
  );
  return { balance: row?.balance ?? 0, lifetimeEarned: row?.lifetime_earned ?? 0 };
}

export async function earnedSince(userId: number, since: Date): Promise<number> {
  const row = await one<{ total: string }>(
    `SELECT COALESCE(SUM(delta), 0)::text AS total
       FROM coin_ledger
      WHERE user_id = $1 AND delta > 0 AND kind IN ('watch', 'bonus')
        AND created_at >= $2`,
    [userId, since.toISOString()],
  );
  return Number(row?.total ?? 0);
}

type LedgerRow = {
  id: string;
  delta: number;
  kind: string;
  reason: string;
  multiplier: string | null;
  balance_after: number;
  created_at: Date;
};

export async function ledgerFor(userId: number, limit = 50): Promise<LedgerEntry[]> {
  const found = await rows<LedgerRow>(
    `SELECT id::text, delta, kind, reason, multiplier, balance_after, created_at
       FROM coin_ledger
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2`,
    [userId, limit],
  );

  return found.map(toLedgerEntry);
}

function toLedgerEntry(row: LedgerRow): LedgerEntry {
  return {
    id: row.id,
    createdAt: row.created_at.toISOString(),
    reason: row.reason,
    delta: row.delta,
    balance: row.balance_after,
    kind: (row.kind as LedgerEntry['kind']) ?? 'adjustment',
    detail: row.multiplier && Number(row.multiplier) !== 1 ? `${row.multiplier}× multiplier` : undefined,
  };
}

/**
 * One page of the ledger, with the total beside it.
 *
 * `ledgerFor` above deliberately has no offset: it answers "the last N", which
 * is what a summary card wants. Paging needs the count as well, so the page it
 * lands on can say how far through it is rather than guessing from a full
 * final page.
 */
export async function ledgerPageFor(
  userId: number,
  { limit, offset }: { limit: number; offset: number },
): Promise<{ entries: LedgerEntry[]; total: number }> {
  const [found, count] = await Promise.all([
    rows<LedgerRow>(
      `SELECT id::text, delta, kind, reason, multiplier, balance_after, created_at
         FROM coin_ledger
        WHERE user_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    ),
    // Counted as text: a bigint comes back as a string from pg, and Number()
    // on the count is safe where Number() on a balance sum would not be.
    one<{ total: string }>(
      'SELECT COUNT(*)::text AS total FROM coin_ledger WHERE user_id = $1',
      [userId],
    ),
  ]);

  return {
    entries: found.map(toLedgerEntry),
    total: Number(count?.total ?? 0),
  };
}

/** Admin's coin-flow card: minted by watching against destroyed by the edge. */
export async function coinFlow(since: Date): Promise<{ minted: number; destroyed: number }> {
  const row = await one<{ minted: string; destroyed: string }>(
    `SELECT
       COALESCE(SUM(delta) FILTER (WHERE kind IN ('watch', 'bonus')), 0)::text AS minted,
       COALESCE(-SUM(delta) FILTER (WHERE kind = 'game'), 0)::text            AS destroyed
     FROM coin_ledger
     WHERE created_at >= $1`,
    [since.toISOString()],
  );
  return { minted: Number(row?.minted ?? 0), destroyed: Number(row?.destroyed ?? 0) };
}
