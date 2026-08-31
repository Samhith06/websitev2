import 'server-only';
import { one, rows, tx, write } from '@/lib/db';
import { InsufficientCoins, apply } from './coins';
import type { Redemption, ShopItem, ShopCategory } from '@/lib/types';

/**
 * The coin shop (Master Plan §8).
 *
 * The rule that shapes every function here: **coins move and the redemption is
 * written in one transaction, or neither happens.** A redemption without a
 * debit is a free item; a debit without a redemption is theft. Both are the
 * kind of bug that surfaces as an argument about money, so the database settles
 * it rather than the application.
 *
 * Stock is decremented with a conditional UPDATE rather than a read-then-write,
 * so two people buying the last hoodie at the same moment cannot both get it.
 */

export type StoredItem = ShopItem & {
  needsReview: boolean;
  cooldownDays: number | null;
};

type ItemRow = {
  id: string;
  name: string;
  description: string;
  cost: number;
  category: string;
  stock: number | null;
  cooldown_days: number | null;
  needs_review: boolean;
  active: boolean;
  cooldown_remaining: number | null;
};

function toItem(row: ItemRow): StoredItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    cost: row.cost,
    category: row.category as ShopCategory,
    stock: row.stock,
    cooldownDaysRemaining: row.cooldown_remaining ?? undefined,
    active: row.active,
    needsReview: row.needs_review,
    cooldownDays: row.cooldown_days,
  };
}

const ITEM_COLUMNS = `i.id::text, i.name, i.description, i.cost, i.category, i.stock,
                      i.cooldown_days, i.needs_review, i.active`;

/**
 * The catalogue as one viewer sees it, including how long they personally have
 * left on any cooldown — computed in SQL rather than fetched separately, so the
 * page is one round trip.
 */
export async function listItems(userId: number | null): Promise<StoredItem[]> {
  const found = await rows<ItemRow>(
    `SELECT ${ITEM_COLUMNS},
            CASE
              WHEN i.cooldown_days IS NULL OR $1::bigint IS NULL THEN NULL
              ELSE GREATEST(0, i.cooldown_days - FLOOR(EXTRACT(EPOCH FROM (now() - COALESCE((
                SELECT max(r.created_at) FROM redemptions r
                 WHERE r.user_id = $1 AND r.item_id = i.id AND r.status <> 'rejected'
              ), now() - (i.cooldown_days || ' days')::interval))) / 86400))::int
            END AS cooldown_remaining
       FROM shop_items i
      WHERE i.active
      ORDER BY i.sort_order, i.cost`,
    [userId],
  );
  return found.map(toItem);
}

export async function allItems(): Promise<StoredItem[]> {
  const found = await rows<ItemRow>(
    `SELECT ${ITEM_COLUMNS}, NULL::int AS cooldown_remaining
       FROM shop_items i ORDER BY i.sort_order, i.cost`,
  );
  return found.map(toItem);
}

export class ShopError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShopError';
  }
}

export type RedeemResult =
  | { ok: true; redemption: Redemption; balance: number; needsReview: boolean }
  | { ok: false; error: string };

/**
 * Buying one thing.
 *
 * Everything that could refuse the purchase is checked inside the transaction,
 * against rows locked for the duration, so nothing can change underneath it
 * between the check and the debit.
 */
export async function redeem(userId: number, itemId: number): Promise<RedeemResult> {
  try {
    return await tx<RedeemResult>(async (client) => {
      const { rows: found } = await client.query<{
        id: string; name: string; cost: number; stock: number | null;
        cooldown_days: number | null; needs_review: boolean; active: boolean;
      }>(
        `SELECT id::text, name, cost, stock, cooldown_days, needs_review, active
           FROM shop_items WHERE id = $1 FOR UPDATE`,
        [itemId],
      );
      const item = found[0];
      if (!item) return { ok: false, error: 'That item no longer exists.' };
      if (!item.active) return { ok: false, error: `${item.name} is not available right now.` };
      if (item.stock !== null && item.stock <= 0) {
        return { ok: false, error: `${item.name} is out of stock.` };
      }

      if (item.cooldown_days !== null) {
        const { rows: last } = await client.query<{ days: string }>(
          `SELECT FLOOR(EXTRACT(EPOCH FROM (now() - max(created_at))) / 86400)::text AS days
             FROM redemptions
            WHERE user_id = $1 AND item_id = $2 AND status <> 'rejected'`,
          [userId, itemId],
        );
        const since = last[0]?.days === null ? null : Number(last[0]?.days);
        if (since !== null && Number.isFinite(since) && since < item.cooldown_days) {
          const left = item.cooldown_days - since;
          return {
            ok: false,
            error: `You can buy ${item.name} again in ${left} day${left === 1 ? '' : 's'}.`,
          };
        }
      }

      // The debit throws InsufficientCoins rather than returning, and that
      // rolls the whole thing back — the redemption below never lands.
      const balance = await apply(client, {
        userId,
        delta: -item.cost,
        kind: 'redemption',
        reason: `Shop — ${item.name}`,
        refType: 'shop_item',
        refId: item.id,
      });

      if (item.stock !== null) {
        // Conditional, so the last one cannot be sold twice.
        const { rowCount } = await client.query(
          `UPDATE shop_items SET stock = stock - 1 WHERE id = $1 AND stock > 0`,
          [itemId],
        );
        if (!rowCount) throw new ShopError(`${item.name} sold out a moment ago.`);
      }

      const status = item.needs_review ? 'pending' : 'fulfilled';
      const { rows: created } = await client.query<{ id: string; created_at: Date }>(
        `INSERT INTO redemptions (user_id, item_id, item_name, cost, status, handled_at)
         VALUES ($1, $2, $3, $4, $5, CASE WHEN $5 = 'fulfilled' THEN now() ELSE NULL END)
         RETURNING id::text, created_at`,
        [userId, itemId, item.name, item.cost, status],
      );

      return {
        ok: true,
        needsReview: item.needs_review,
        balance: balance.balance,
        redemption: {
          id: created[0].id,
          itemName: item.name,
          cost: item.cost,
          status: status as Redemption['status'],
          createdAt: created[0].created_at.toISOString(),
        },
      };
    });
  } catch (error) {
    if (error instanceof InsufficientCoins) {
      return { ok: false, error: `Not enough coins — you are ${error.needed - error.balance} MC short.` };
    }
    if (error instanceof ShopError) return { ok: false, error: error.message };
    console.error('[shop] redeem failed', error);
    return { ok: false, error: 'That purchase could not be completed. No coins were taken.' };
  }
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

type RedemptionRow = {
  id: string;
  item_name: string;
  cost: number;
  status: string;
  reason: string | null;
  handled_by: string | null;
  created_at: Date;
  member: string | null;
};

function toRedemption(row: RedemptionRow): Redemption {
  return {
    id: row.id,
    itemName: row.item_name,
    cost: row.cost,
    status: row.status as Redemption['status'],
    createdAt: row.created_at.toISOString(),
    handledBy: row.handled_by ?? undefined,
    reason: row.reason ?? undefined,
    member: row.member ?? undefined,
  };
}

export async function redemptionsFor(userId: number, limit = 20): Promise<Redemption[]> {
  const found = await rows<RedemptionRow>(
    `SELECT id::text, item_name, cost, status, reason, handled_by, created_at, NULL AS member
       FROM redemptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit],
  );
  return found.map(toRedemption);
}

export async function pendingCountFor(userId: number): Promise<number> {
  const row = await one<{ n: string }>(
    `SELECT count(*)::text AS n FROM redemptions WHERE user_id = $1 AND status = 'pending'`,
    [userId],
  );
  return Number(row?.n ?? 0);
}

/** The moderator queue, newest last so the oldest is dealt with first. */
export async function queue(status: string | null = 'pending', limit = 100): Promise<Redemption[]> {
  const found = await rows<RedemptionRow>(
    `SELECT r.id::text, r.item_name, r.cost, r.status, r.reason, r.handled_by, r.created_at,
            u.discord_username AS member
       FROM redemptions r
       JOIN users u ON u.id = r.user_id
      ${status ? 'WHERE r.status = $2' : ''}
      ORDER BY r.created_at ASC
      LIMIT $1`,
    status ? [limit, status] : [limit],
  );
  return found.map(toRedemption);
}

export async function pendingCount(): Promise<number> {
  const row = await one<{ n: string }>(
    `SELECT count(*)::text AS n FROM redemptions WHERE status = 'pending'`,
  );
  return Number(row?.n ?? 0);
}

/* -------------------------------------------------------------------------- */
/* Moderation                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Rejecting refunds the coins in the same transaction that changes the status,
 * and restores the stock. A member whose redemption was rejected must not also
 * be out of pocket — the shop already promises exactly that.
 */
export async function resolveRedemption(input: {
  id: number;
  status: 'approved' | 'fulfilled' | 'rejected';
  handledBy: string;
  reason?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.status === 'rejected' && !input.reason?.trim()) {
    return { ok: false, error: 'A rejection needs a reason — the member is told what it says.' };
  }

  return tx(async (client) => {
    const { rows: found } = await client.query<{
      user_id: string; item_id: string; item_name: string; cost: number; status: string;
    }>(
      `SELECT user_id::text, item_id::text, item_name, cost, status
         FROM redemptions WHERE id = $1 FOR UPDATE`,
      [input.id],
    );
    const redemption = found[0];
    if (!redemption) return { ok: false, error: 'That redemption no longer exists.' } as const;
    if (redemption.status === 'rejected' || redemption.status === 'fulfilled') {
      return { ok: false, error: `This one is already ${redemption.status}.` } as const;
    }

    await client.query(
      `UPDATE redemptions SET status = $2, handled_by = $3, handled_at = now(), reason = $4
        WHERE id = $1`,
      [input.id, input.status, input.handledBy, input.reason ?? null],
    );

    if (input.status === 'rejected') {
      await apply(client, {
        userId: Number(redemption.user_id),
        delta: redemption.cost,
        kind: 'refund',
        reason: `Refund — ${redemption.item_name}`,
        refType: 'redemption',
        refId: String(input.id),
      });
      await client.query(
        `UPDATE shop_items SET stock = stock + 1 WHERE id = $1 AND stock IS NOT NULL`,
        [redemption.item_id],
      );
    }

    return { ok: true } as const;
  });
}

/* -------------------------------------------------------------------------- */
/* Admin item management                                                      */
/* -------------------------------------------------------------------------- */

export async function upsertItem(input: {
  id?: number | null;
  name: string;
  description: string;
  cost: number;
  category: ShopCategory;
  stock: number | null;
  cooldownDays: number | null;
  needsReview: boolean;
  active: boolean;
}): Promise<void> {
  if (!input.name.trim()) throw new ShopError('An item needs a name.');
  if (!Number.isFinite(input.cost) || input.cost <= 0) {
    throw new ShopError('An item has to cost something.');
  }

  if (input.id) {
    await write(
      `UPDATE shop_items
          SET name = $2, description = $3, cost = $4, category = $5, stock = $6,
              cooldown_days = $7, needs_review = $8, active = $9, updated_at = now()
        WHERE id = $1`,
      [input.id, input.name.trim(), input.description.trim(), Math.round(input.cost),
       input.category, input.stock, input.cooldownDays, input.needsReview, input.active],
    );
  } else {
    await write(
      `INSERT INTO shop_items (name, description, cost, category, stock, cooldown_days, needs_review, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [input.name.trim(), input.description.trim(), Math.round(input.cost), input.category,
       input.stock, input.cooldownDays, input.needsReview, input.active],
    );
  }
}
