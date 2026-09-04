import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { one, rows, tx, write } from '@/lib/db';
import { apply } from './coins';

/**
 * Raffles, with a draw anyone can check.
 *
 * The draw is the thing people are most suspicious of, so it is committed
 * before it can be influenced: a seed is generated when the raffle is created
 * and its hash published on the card immediately. When entries close, the
 * winner is picked by hashing that seed against the ordered entry ids, and the
 * seed itself is revealed. Anyone can then confirm the winner was determined by
 * a value fixed before anybody knew who had entered.
 */

export type RaffleStatus = 'draft' | 'open' | 'closed' | 'drawn';

export type Raffle = {
  id: number;
  slug: string;
  title: string;
  valueLabel: string;
  description: string;
  imageUrl: string | null;
  symbol: string;
  cost: number;
  maxEntries: number;
  status: RaffleStatus;
  opensAt: string;
  closesAt: string;
  drawSeedHash: string;
  /** Null until the draw — this is the half that proves the commitment. */
  drawSeed: string | null;
  winnerUserId: number | null;
  winnerUsername: string | null;
  drawnAt: string | null;
  entryCount: number;
};

type Row = {
  id: string;
  slug: string;
  title: string;
  value_label: string;
  description: string;
  image_url: string | null;
  symbol: string;
  cost: number;
  max_entries: number;
  status: RaffleStatus;
  opens_at: Date;
  closes_at: Date;
  draw_seed_hash: string;
  draw_seed: string | null;
  winner_user_id: string | null;
  winner_username: string | null;
  drawn_at: Date | null;
  entry_count: string;
};

function toRaffle(r: Row): Raffle {
  return {
    id: Number(r.id),
    slug: r.slug,
    title: r.title,
    valueLabel: r.value_label,
    description: r.description,
    imageUrl: r.image_url,
    symbol: r.symbol,
    cost: r.cost,
    maxEntries: r.max_entries,
    status: r.status,
    opensAt: r.opens_at.toISOString(),
    closesAt: r.closes_at.toISOString(),
    drawSeedHash: r.draw_seed_hash,
    drawSeed: r.draw_seed,
    winnerUserId: r.winner_user_id == null ? null : Number(r.winner_user_id),
    winnerUsername: r.winner_username,
    drawnAt: r.drawn_at?.toISOString() ?? null,
    entryCount: Number(r.entry_count),
  };
}

/* The seed is only selected once the raffle has been drawn. Before that it is
   returned as null so a stray SELECT * can never leak it early. */
const SELECT = `
  SELECT r.id::text, r.slug, r.title, r.value_label, r.description, r.image_url,
         r.symbol, r.cost, r.max_entries, r.status, r.opens_at, r.closes_at,
         r.draw_seed_hash,
         CASE WHEN r.seed_revealed_at IS NULL THEN NULL ELSE r.draw_seed END AS draw_seed,
         r.winner_user_id::text, u.discord_username AS winner_username, r.drawn_at,
         (SELECT COUNT(*) FROM raffle_entries e WHERE e.raffle_id = r.id)::text AS entry_count
    FROM raffles r
    LEFT JOIN users u ON u.id = r.winner_user_id`;

export async function openRaffles(): Promise<Raffle[]> {
  const result = await rows<Row>(
    `${SELECT} WHERE r.status = 'open' ORDER BY r.closes_at ASC`,
  );
  return result.map(toRaffle);
}

export async function drawnRaffles(limit = 12): Promise<Raffle[]> {
  const result = await rows<Row>(
    `${SELECT} WHERE r.status = 'drawn' ORDER BY r.drawn_at DESC LIMIT $1`,
    [limit],
  );
  return result.map(toRaffle);
}

export async function allRaffles(limit = 100): Promise<Raffle[]> {
  const result = await rows<Row>(`${SELECT} ORDER BY r.created_at DESC LIMIT $1`, [limit]);
  return result.map(toRaffle);
}

export async function raffleBySlug(slug: string): Promise<Raffle | null> {
  const row = await one<Row>(`${SELECT} WHERE r.slug = $1`, [slug]);
  return row ? toRaffle(row) : null;
}

/** How many entries one person holds in each open raffle. */
export async function entriesFor(userId: number): Promise<Map<number, number>> {
  const result = await rows<{ raffle_id: string; n: string }>(
    `SELECT raffle_id::text, COUNT(*)::text AS n
       FROM raffle_entries WHERE user_id = $1 GROUP BY raffle_id`,
    [userId],
  );
  return new Map(result.map((r) => [Number(r.raffle_id), Number(r.n)]));
}

export type EnterResult =
  | { ok: true; entries: number; balance: number }
  | {
      ok: false;
      error: 'not-open' | 'closed' | 'cap-reached' | 'insufficient-coins';
      detail?: string;
    };

/**
 * Enter a raffle.
 *
 * The per-person cap is counted inside the transaction rather than checked
 * beforehand, so two simultaneous taps cannot both pass a check that was true
 * when each of them read it. The coin debit and the entry row are the same
 * transaction: either both happen or neither does.
 */
export async function enterRaffle(input: {
  userId: number;
  raffleId: number;
}): Promise<EnterResult> {
  return tx(async (client) => {
    // FOR UPDATE on the raffle serialises entries to the same raffle, which is
    // what makes the cap count below trustworthy.
    const { rows: raffleRows } = await client.query<{
      id: string;
      cost: number;
      max_entries: number;
      status: RaffleStatus;
      closes_at: Date;
    }>(
      `SELECT id::text, cost, max_entries, status, closes_at
         FROM raffles WHERE id = $1 FOR UPDATE`,
      [input.raffleId],
    );
    const raffle = raffleRows[0];
    if (!raffle) return { ok: false, error: 'not-open' } as const;
    if (raffle.status !== 'open') return { ok: false, error: 'not-open' } as const;
    if (raffle.closes_at.getTime() <= Date.now()) return { ok: false, error: 'closed' } as const;

    const { rows: countRows } = await client.query<{ n: string }>(
      'SELECT COUNT(*)::text AS n FROM raffle_entries WHERE raffle_id = $1 AND user_id = $2',
      [input.raffleId, input.userId],
    );
    const held = Number(countRows[0]?.n ?? 0);
    if (held >= raffle.max_entries) return { ok: false, error: 'cap-reached' } as const;

    const { rows: balanceRows } = await client.query<{ balance: number }>(
      'SELECT balance FROM coin_balances WHERE user_id = $1',
      [input.userId],
    );
    const balance = balanceRows[0]?.balance ?? 0;
    if (raffle.cost > balance) {
      return { ok: false, error: 'insufficient-coins' } as const;
    }

    const { rows: entry } = await client.query<{ id: string }>(
      `INSERT INTO raffle_entries (raffle_id, user_id, cost)
       VALUES ($1, $2, $3) RETURNING id::text`,
      [input.raffleId, input.userId, raffle.cost],
    );

    let after = balance;
    // A free raffle takes the identical path with a cost of zero, and writes no
    // ledger row — there is no movement to record.
    if (raffle.cost > 0) {
      const result = await apply(client, {
        userId: input.userId,
        // Raffles are what giveaways were renamed to, so they keep the same
        // ledger kind — a member's coin history should not fork in the middle
        // because the feature changed its label.
        delta: -raffle.cost,
        kind: 'giveaway',
        reason: 'Raffle entry',
        refType: 'raffle_entry',
        refId: entry[0].id,
      });
      after = result.balance;
    }

    return { ok: true as const, entries: held + 1, balance: after };
  });
}

/* -------------------------------------------------------------------------- */
/* Admin                                                                      */
/* -------------------------------------------------------------------------- */

export async function createRaffle(input: {
  slug: string;
  title: string;
  valueLabel: string;
  description?: string;
  imageUrl?: string | null;
  symbol?: string;
  cost: number;
  maxEntries: number;
  closesAt: string;
}): Promise<Raffle> {
  // Committed here and nowhere else: the hash goes public immediately, the
  // seed stays unread until the draw.
  const seed = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(seed).digest('hex');

  const row = await one<Row>(
    `WITH inserted AS (
       INSERT INTO raffles
         (slug, title, value_label, description, image_url, symbol,
          cost, max_entries, closes_at, draw_seed, draw_seed_hash, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'open')
       RETURNING *
     )
     SELECT i.id::text, i.slug, i.title, i.value_label, i.description, i.image_url,
            i.symbol, i.cost, i.max_entries, i.status, i.opens_at, i.closes_at,
            i.draw_seed_hash, NULL::text AS draw_seed,
            NULL::text AS winner_user_id, NULL::text AS winner_username,
            NULL::timestamptz AS drawn_at, '0' AS entry_count
       FROM inserted i`,
    [
      input.slug,
      input.title,
      input.valueLabel,
      input.description ?? '',
      input.imageUrl ?? null,
      input.symbol ?? '✦',
      input.cost,
      input.maxEntries,
      input.closesAt,
      seed,
      hash,
    ],
  );
  return toRaffle(row!);
}

export type DrawResult =
  | { ok: true; winnerUserId: number; winnerUsername: string; seed: string; entryCount: number }
  | { ok: false; error: 'not-found' | 'already-drawn' | 'no-entries' };

/**
 * Draw a winner from the committed seed.
 *
 * The selection is `sha256(seed + ':' + raffleId)` reduced over the entry
 * count, against entries ordered by id. Both halves are then public — the seed
 * is revealed and the entry order is a matter of record — so the result can be
 * recomputed by anybody. Nothing random is drawn at this moment; the winner was
 * fixed the instant the raffle was created.
 */
export async function drawRaffle(raffleId: number, by: string): Promise<DrawResult> {
  return tx(async (client) => {
    const { rows: raffleRows } = await client.query<{
      id: string;
      status: RaffleStatus;
      draw_seed: string;
    }>('SELECT id::text, status, draw_seed FROM raffles WHERE id = $1 FOR UPDATE', [raffleId]);
    const raffle = raffleRows[0];
    if (!raffle) return { ok: false, error: 'not-found' } as const;
    if (raffle.status === 'drawn') return { ok: false, error: 'already-drawn' } as const;

    const { rows: entries } = await client.query<{ id: string; user_id: string; username: string }>(
      `SELECT e.id::text, e.user_id::text, u.discord_username AS username
         FROM raffle_entries e JOIN users u ON u.id = e.user_id
        WHERE e.raffle_id = $1
        ORDER BY e.id ASC`,
      [raffleId],
    );
    if (entries.length === 0) return { ok: false, error: 'no-entries' } as const;

    const digest = createHash('sha256').update(`${raffle.draw_seed}:${raffleId}`).digest();
    // Read 6 bytes as an integer — comfortably inside Number's safe range and
    // far more entropy than any plausible entry count needs.
    const value = digest.readUIntBE(0, 6);
    const index = value % entries.length;
    const winner = entries[index];

    await client.query(
      `UPDATE raffles
          SET status = 'drawn', winner_user_id = $2, winner_entry_id = $3,
              drawn_at = now(), seed_revealed_at = now()
        WHERE id = $1`,
      [raffleId, Number(winner.user_id), Number(winner.id)],
    );

    await client.query(
      `INSERT INTO audit_log (admin_name, action, target, detail)
       VALUES ($1, 'raffle.drawn', $2, $3)`,
      [by, String(raffleId), JSON.stringify({ winner: winner.username, entries: entries.length })],
    );

    return {
      ok: true as const,
      winnerUserId: Number(winner.user_id),
      winnerUsername: winner.username,
      seed: raffle.draw_seed,
      entryCount: entries.length,
    };
  });
}

export async function setRaffleStatus(raffleId: number, status: RaffleStatus): Promise<void> {
  await write('UPDATE raffles SET status = $2 WHERE id = $1', [raffleId, status]);
}

export async function markDelivered(raffleId: number): Promise<void> {
  await write('UPDATE raffles SET delivered_at = now() WHERE id = $1', [raffleId]);
}
