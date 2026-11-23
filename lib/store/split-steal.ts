import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { one, rows, tx, write } from '@/lib/db';
import { shortBy, type WagerGate } from './wager-gate';

/**
 * Split or Steal, played on the website. The rules are written out in
 * db/migrations/026_split_or_steal.sql; this file is their only enforcer.
 *
 * Choices are secret until a pair is revealed. Every read here masks them —
 * for the public, for the opponent and for staff — except a player's own
 * choice, shown back to them. A stray query can therefore never leak a
 * choice before the reveal.
 *
 * The draw is committed like a raffle's: the seed's hash is public from the
 * moment the event opens, the pairs come from shuffling the entries (ordered
 * by id) with that seed, and the seed is revealed when the pairs are drawn.
 */

/** Dollars wagered under the code this leaderboard period, to enter. */
export const SPLIT_STEAL_WAGER_MIN = 200;

/** Why someone cannot enter, in words for them. */
export function entryRefusal(gate: Extract<WagerGate, { ok: false }>): string {
  const need = `Split or Steal needs $${gate.min} wagered under code MATTYSPINS this leaderboard period.`;
  switch (gate.reason) {
    case 'short':
      return `You haven't wagered enough to take part in this game. ${need} You're at $${(gate.wagered ?? 0).toFixed(2)}, so $${shortBy(gate).toFixed(2)} to go.`;
    case 'no-link':
      return `Link your Razed account on your profile so we can check your wager. ${need}`;
    case 'link-pending':
      return 'Your Razed link is waiting on a mod. You can enter once it is approved.';
    case 'no-period':
      return 'Entries open once a leaderboard period is running.';
    case 'unavailable':
      return 'We could not check your wager with Razed just now. Try again in a few minutes.';
  }
}

export type SsStatus = 'open' | 'choosing' | 'finished' | 'cancelled';
export type Choice = 'split' | 'steal';

export class SplitStealError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SplitStealError';
  }
}

export type SsEvent = {
  id: number;
  title: string;
  prize: number;
  pairs: number;
  status: SsStatus;
  drawSeedHash: string;
  /** Null until the pairs are drawn. */
  drawSeed: string | null;
  createdAt: string;
  drawnAt: string | null;
  finishedAt: string | null;
  entryCount: number;
};

type EventRow = {
  id: string;
  title: string;
  prize: string;
  pairs: number;
  status: SsStatus;
  draw_seed_hash: string;
  draw_seed: string | null;
  created_at: Date;
  drawn_at: Date | null;
  finished_at: Date | null;
  entry_count: string;
};

const EVENT_SELECT = `
  SELECT e.id::text, e.title, e.prize::text, e.pairs, e.status, e.draw_seed_hash,
         CASE WHEN e.seed_revealed_at IS NULL THEN NULL ELSE e.draw_seed END AS draw_seed,
         e.created_at, e.drawn_at, e.finished_at,
         (SELECT COUNT(*) FROM split_steal_entries x WHERE x.event_id = e.id)::text AS entry_count
    FROM split_steal_events e`;

function toEvent(r: EventRow): SsEvent {
  return {
    id: Number(r.id),
    title: r.title,
    prize: Number(r.prize),
    pairs: r.pairs,
    status: r.status,
    drawSeedHash: r.draw_seed_hash,
    drawSeed: r.draw_seed,
    createdAt: r.created_at.toISOString(),
    drawnAt: r.drawn_at?.toISOString() ?? null,
    finishedAt: r.finished_at?.toISOString() ?? null,
    entryCount: Number(r.entry_count),
  };
}

/** The event taking entries or choices, if there is one. */
export async function liveEvent(): Promise<SsEvent | null> {
  const row = await one<EventRow>(`${EVENT_SELECT} WHERE e.status IN ('open', 'choosing') LIMIT 1`);
  return row ? toEvent(row) : null;
}

/** The live event, or else the most recently finished one, for the public page. */
export async function featuredEvent(): Promise<SsEvent | null> {
  const row = await one<EventRow>(
    `${EVENT_SELECT}
      WHERE e.status <> 'cancelled'
      ORDER BY (e.status IN ('open', 'choosing')) DESC, e.created_at DESC
      LIMIT 1`,
  );
  return row ? toEvent(row) : null;
}

export async function recentEvents(limit = 10): Promise<SsEvent[]> {
  const found = await rows<EventRow>(`${EVENT_SELECT} ORDER BY e.created_at DESC LIMIT $1`, [limit]);
  return found.map(toEvent);
}

/* -------------------------------------------------------------------------- */
/* Outcomes                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * What each side of a pair wins. Both split: half each. One steals: they take
 * it all. Both steal: nothing. Someone who never chose forfeits, and an
 * opponent who did choose takes the full prize, whatever they picked.
 */
export function outcome(prize: number, a: Choice | null, b: Choice | null): [number, number] {
  if (!a && !b) return [0, 0];
  if (!a) return [0, prize];
  if (!b) return [prize, 0];
  if (a === 'split' && b === 'split') {
    const half = Math.floor(prize * 50) / 100;
    return [half, half];
  }
  if (a === 'steal' && b === 'steal') return [0, 0];
  return a === 'steal' ? [prize, 0] : [0, prize];
}

/* -------------------------------------------------------------------------- */
/* Pairs                                                                      */
/* -------------------------------------------------------------------------- */

export type SsSide = {
  userId: number;
  username: string;
  /** Whether they have locked in. Public from the start: it is not the choice. */
  locked: boolean;
  /** The choice: only once the pair is revealed, or to the player themselves. */
  choice: Choice | null;
  /** What they won; null until revealed. */
  payout: number | null;
};

export type SsPair = {
  id: number;
  position: number;
  a: SsSide;
  b: SsSide;
  revealed: boolean;
  paidAt: string | null;
};

type PairRow = {
  id: string;
  position: number;
  a_user_id: string;
  b_user_id: string;
  a_name: string;
  b_name: string;
  a_choice: Choice | null;
  b_choice: Choice | null;
  revealed_at: Date | null;
  paid_at: Date | null;
};

/**
 * An event's pairs, as `viewerId` may see them. Pass null for the public and
 * for staff: neither sees a choice before its pair is revealed.
 */
export async function pairsOf(event: SsEvent, viewerId: number | null): Promise<SsPair[]> {
  const found = await rows<PairRow>(
    `SELECT p.id::text, p.position, p.a_user_id::text, p.b_user_id::text,
            ua.discord_username AS a_name, ub.discord_username AS b_name,
            p.a_choice, p.b_choice, p.revealed_at, p.paid_at
       FROM split_steal_pairs p
       JOIN users ua ON ua.id = p.a_user_id
       JOIN users ub ON ub.id = p.b_user_id
      WHERE p.event_id = $1
      ORDER BY p.position ASC`,
    [event.id],
  );

  return found.map((r) => {
    const revealed = r.revealed_at != null;
    const [payA, payB] = outcome(event.prize, r.a_choice, r.b_choice);
    const side = (userId: string, name: string, choice: Choice | null, pay: number): SsSide => ({
      userId: Number(userId),
      username: name,
      locked: choice != null,
      choice: revealed || (viewerId != null && Number(userId) === viewerId) ? choice : null,
      payout: revealed ? pay : null,
    });
    return {
      id: Number(r.id),
      position: r.position,
      a: side(r.a_user_id, r.a_name, r.a_choice, payA),
      b: side(r.b_user_id, r.b_name, r.b_choice, payB),
      revealed,
      paidAt: r.paid_at?.toISOString() ?? null,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Entries                                                                    */
/* -------------------------------------------------------------------------- */

export type SsEntry = { userId: number; username: string; wagered: number; createdAt: string };

export async function entriesOf(eventId: number): Promise<SsEntry[]> {
  const found = await rows<{ user_id: string; username: string; wagered: string; created_at: Date }>(
    `SELECT x.user_id::text, u.discord_username AS username, x.wagered::text, x.created_at
       FROM split_steal_entries x JOIN users u ON u.id = x.user_id
      WHERE x.event_id = $1
      ORDER BY x.id ASC`,
    [eventId],
  );
  return found.map((r) => ({
    userId: Number(r.user_id),
    username: r.username,
    wagered: Number(r.wagered),
    createdAt: r.created_at.toISOString(),
  }));
}

export async function hasEntered(eventId: number, userId: number): Promise<boolean> {
  const row = await one<{ n: number }>(
    'SELECT 1 AS n FROM split_steal_entries WHERE event_id = $1 AND user_id = $2',
    [eventId, userId],
  );
  return Boolean(row);
}

/**
 * Enter the open event. The wager check happens before this, in the action,
 * because it is a network call; the event is locked here so an entry cannot
 * land after the draw has started.
 */
export async function enterEvent(eventId: number, userId: number, wagered: number): Promise<void> {
  await tx(async (client) => {
    const { rows: found } = await client.query<{ status: SsStatus }>(
      'SELECT status FROM split_steal_events WHERE id = $1 FOR UPDATE',
      [eventId],
    );
    if (!found[0] || found[0].status !== 'open') throw new SplitStealError('Entries for this event have closed.');
    await client.query(
      `INSERT INTO split_steal_entries (event_id, user_id, wagered) VALUES ($1, $2, $3)
       ON CONFLICT (event_id, user_id) DO NOTHING`,
      [eventId, userId, wagered],
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Choosing                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Lock in a choice. Final: the update only lands on an empty side of a pair
 * that has not been revealed, so a second tap, or a tap after the reveal,
 * changes nothing.
 */
export async function lockChoice(eventId: number, userId: number, choice: Choice): Promise<void> {
  await tx(async (client) => {
    const { rows: ev } = await client.query<{ status: SsStatus }>(
      'SELECT status FROM split_steal_events WHERE id = $1 FOR UPDATE',
      [eventId],
    );
    if (!ev[0] || ev[0].status !== 'choosing') throw new SplitStealError('Choices are not open right now.');

    const { rows: pair } = await client.query<{
      id: string;
      side: 'a' | 'b';
      chosen: Choice | null;
      revealed: boolean;
    }>(
      `SELECT id::text,
              CASE WHEN a_user_id = $2 THEN 'a' ELSE 'b' END AS side,
              CASE WHEN a_user_id = $2 THEN a_choice ELSE b_choice END AS chosen,
              revealed_at IS NOT NULL AS revealed
         FROM split_steal_pairs
        WHERE event_id = $1 AND (a_user_id = $2 OR b_user_id = $2)
        FOR UPDATE`,
      [eventId, userId],
    );
    const mine = pair[0];
    if (!mine) throw new SplitStealError('You were not drawn in this event.');
    if (mine.revealed) throw new SplitStealError('Your pair has already been revealed.');
    if (mine.chosen) throw new SplitStealError('You have already locked in your choice.');

    const col = mine.side === 'a' ? 'a' : 'b';
    await client.query(
      `UPDATE split_steal_pairs SET ${col}_choice = $2, ${col}_chosen_at = now() WHERE id = $1`,
      [mine.id, choice],
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Staff                                                                      */
/* -------------------------------------------------------------------------- */

export async function createEvent(input: {
  title: string;
  prize: number;
  pairs: number;
  by: string;
}): Promise<SsEvent> {
  if (await liveEvent()) throw new SplitStealError('A Split or Steal event is already running. Finish or cancel it first.');
  const seed = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(seed).digest('hex');
  try {
    await write(
      `INSERT INTO split_steal_events (title, prize, pairs, draw_seed, draw_seed_hash, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [input.title, input.prize, input.pairs, seed, hash, input.by],
    );
  } catch (error) {
    // The one-live index: someone else opened one at the same moment.
    if ((error as { code?: string }).code === '23505') {
      throw new SplitStealError('A Split or Steal event is already running. Finish or cancel it first.');
    }
    throw error;
  }
  return (await liveEvent())!;
}

/** A Fisher–Yates shuffle driven by the committed seed, so anyone can replay it. */
function seededShuffle<T>(items: T[], seed: string, eventId: number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const digest = createHash('sha256').update(`${seed}:${eventId}:${i}`).digest();
    const j = digest.readUIntBE(0, 6) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Close entries and draw the pairs. Returns how many pairs, and how many missed out. */
export async function drawPairs(eventId: number): Promise<{ pairs: number; entrants: number; left: number }> {
  return tx(async (client) => {
    const { rows: ev } = await client.query<{ status: SsStatus; pairs: number; draw_seed: string }>(
      'SELECT status, pairs, draw_seed FROM split_steal_events WHERE id = $1 FOR UPDATE',
      [eventId],
    );
    if (!ev[0]) throw new SplitStealError('That event could not be found.');
    if (ev[0].status !== 'open') throw new SplitStealError('The pairs have already been drawn.');

    const { rows: entries } = await client.query<{ user_id: string }>(
      'SELECT user_id::text FROM split_steal_entries WHERE event_id = $1 ORDER BY id ASC',
      [eventId],
    );
    if (entries.length < 2) throw new SplitStealError('At least 2 people need to enter before the pairs can be drawn.');

    const count = Math.min(ev[0].pairs, Math.floor(entries.length / 2));
    const order = seededShuffle(entries, ev[0].draw_seed, eventId);
    for (let i = 0; i < count; i++) {
      await client.query(
        `INSERT INTO split_steal_pairs (event_id, position, a_user_id, b_user_id) VALUES ($1, $2, $3, $4)`,
        [eventId, i + 1, Number(order[2 * i].user_id), Number(order[2 * i + 1].user_id)],
      );
    }
    await client.query(
      `UPDATE split_steal_events
          SET status = 'choosing', drawn_at = now(), seed_revealed_at = now()
        WHERE id = $1`,
      [eventId],
    );
    return { pairs: count, entrants: entries.length, left: entries.length - count * 2 };
  });
}

/**
 * Reveal one pair, or every pair still hidden. Once the last is revealed the
 * event is finished.
 */
export async function revealPairs(
  eventId: number,
  pairId: number | 'all',
): Promise<{ revealed: number; finished: boolean }> {
  return tx(async (client) => {
    const { rows: ev } = await client.query<{ status: SsStatus }>(
      'SELECT status FROM split_steal_events WHERE id = $1 FOR UPDATE',
      [eventId],
    );
    if (!ev[0] || ev[0].status !== 'choosing') throw new SplitStealError('There is nothing to reveal in this event.');

    const result =
      pairId === 'all'
        ? await client.query(
            'UPDATE split_steal_pairs SET revealed_at = now() WHERE event_id = $1 AND revealed_at IS NULL',
            [eventId],
          )
        : await client.query(
            'UPDATE split_steal_pairs SET revealed_at = now() WHERE event_id = $1 AND id = $2 AND revealed_at IS NULL',
            [eventId, pairId],
          );

    const { rows: left } = await client.query<{ n: string }>(
      'SELECT COUNT(*)::text AS n FROM split_steal_pairs WHERE event_id = $1 AND revealed_at IS NULL',
      [eventId],
    );
    const finished = Number(left[0].n) === 0;
    if (finished) {
      await client.query(
        `UPDATE split_steal_events SET status = 'finished', finished_at = now() WHERE id = $1`,
        [eventId],
      );
    }
    return { revealed: result.rowCount ?? 0, finished };
  });
}

export async function markPairPaid(pairId: number, paid: boolean): Promise<void> {
  await write(
    `UPDATE split_steal_pairs SET paid_at = CASE WHEN $2 THEN now() ELSE NULL END
      WHERE id = $1 AND revealed_at IS NOT NULL`,
    [pairId, paid],
  );
}

export async function cancelEvent(eventId: number): Promise<void> {
  const done = await write(
    `UPDATE split_steal_events SET status = 'cancelled', finished_at = now()
      WHERE id = $1 AND status IN ('open', 'choosing') RETURNING id`,
    [eventId],
  );
  if (done.length === 0) throw new SplitStealError('That event is not running.');
}
