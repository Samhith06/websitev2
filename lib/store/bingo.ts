import 'server-only';
import { randomInt } from 'node:crypto';
import type { PoolClient } from 'pg';
import { one, rows, tx, write } from '@/lib/db';
import { cellLabel, completedLines, isProfit } from '@/lib/bingo';
import { apply } from './coins';
import { matchSlot } from './slots';

/**
 * Slot bingo, run on this site (see migration 016 for the rules).
 *
 * The draw is made here, server-side, with a CSPRNG — never in the browser —
 * so what chat sees on stream is what the site decided. Coins move once, when
 * the card ends, through `apply` like every other coin on the site; until
 * then a result can still be corrected.
 */

export type BingoStatus = 'running' | 'finished';
export type TurnStatus = 'playing' | 'won' | 'lost' | 'skipped';
export type EntryStatus = 'waiting' | 'playing' | 'won' | 'lost' | 'skipped';

export type BingoCard = {
  id: number;
  title: string;
  size: number;
  squarePrize: number;
  status: BingoStatus;
  requestsOpen: boolean;
  result: 'bingo' | 'stopped' | null;
  createdAt: string;
  finishedAt: string | null;
};

export type BingoTurn = {
  id: number;
  position: number;
  kickUserId: string;
  kickUsername: string;
  slotName: string;
  provider: string;
  imageUrl: string | null;
  status: TurnStatus;
  buyCost: number | null;
  payout: number | null;
  paid: number;
  drawnAt: string;
  resolvedAt: string | null;
};

export type BingoEntry = {
  id: number;
  kickUserId: string;
  kickUsername: string;
  query: string;
  slotName: string | null;
  provider: string | null;
  imageUrl: string | null;
  status: EntryStatus;
  createdAt: string;
  /** Whether this chatter has a verified Kick link — only they can be paid. */
  linked: boolean;
  /** Buys already played for this viewer on this card (skips not counted). */
  turns: number;
};

type CardRow = {
  id: string;
  title: string;
  size: number;
  square_prize: number;
  status: BingoStatus;
  requests_open: boolean;
  result: 'bingo' | 'stopped' | null;
  created_at: Date;
  finished_at: Date | null;
};

const CARD_COLUMNS = `id::text, title, size, square_prize, status, requests_open, result, created_at, finished_at`;

function toCard(r: CardRow): BingoCard {
  return {
    id: Number(r.id),
    title: r.title,
    size: r.size,
    squarePrize: r.square_prize,
    status: r.status,
    requestsOpen: r.requests_open,
    result: r.result,
    createdAt: r.created_at.toISOString(),
    finishedAt: r.finished_at?.toISOString() ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Reading                                                                    */
/* -------------------------------------------------------------------------- */

/** The running card, if there is one. `!sr` joins this one. */
export async function liveCard(): Promise<BingoCard | null> {
  const row = await one<CardRow>(`SELECT ${CARD_COLUMNS} FROM bingo_cards WHERE status = 'running' LIMIT 1`);
  return row ? toCard(row) : null;
}

/** What the pages show: the running card, else the last one to finish. */
export async function featuredCard(): Promise<BingoCard | null> {
  const row = await one<CardRow>(
    `SELECT ${CARD_COLUMNS} FROM bingo_cards ORDER BY (status = 'running') DESC, created_at DESC LIMIT 1`,
  );
  return row ? toCard(row) : null;
}

/** Every draw on a card, oldest first. */
export async function turnsFor(cardId: number): Promise<BingoTurn[]> {
  const found = await rows<{
    id: string;
    position: number;
    kick_user_id: string;
    kick_username: string;
    slot_name: string;
    provider: string;
    image_url: string | null;
    status: TurnStatus;
    buy_cost: string | null;
    payout: string | null;
    paid: number;
    drawn_at: Date;
    resolved_at: Date | null;
  }>(
    `SELECT id::text, position, kick_user_id, kick_username, slot_name, provider, image_url, status,
            buy_cost::text, payout::text, paid, drawn_at, resolved_at
       FROM bingo_turns WHERE card_id = $1 ORDER BY drawn_at, id`,
    [cardId],
  );
  return found.map((r) => ({
    id: Number(r.id),
    position: r.position,
    kickUserId: r.kick_user_id,
    kickUsername: r.kick_username,
    slotName: r.slot_name,
    provider: r.provider,
    imageUrl: r.image_url,
    status: r.status,
    buyCost: r.buy_cost == null ? null : Number(r.buy_cost),
    payout: r.payout == null ? null : Number(r.payout),
    paid: r.paid,
    drawnAt: r.drawn_at.toISOString(),
    resolvedAt: r.resolved_at?.toISOString() ?? null,
  }));
}

/** The pool, or any slice of it by status, in the order people joined. */
export async function entriesFor(cardId: number, status?: EntryStatus): Promise<BingoEntry[]> {
  const found = await rows<{
    id: string;
    kick_user_id: string;
    kick_username: string;
    query: string;
    name: string | null;
    provider: string | null;
    image_url: string | null;
    status: EntryStatus;
    created_at: Date;
    linked: boolean;
    turns: number;
  }>(
    `SELECT e.id::text, e.kick_user_id, e.kick_username, e.query, s.name, s.provider, s.image_url,
            e.status, e.created_at, (k.user_id IS NOT NULL) AS linked,
            (SELECT COUNT(*)::int FROM bingo_turns t
              WHERE t.card_id = e.card_id AND t.kick_user_id = e.kick_user_id
                AND t.status IN ('won', 'lost')) AS turns
       FROM bingo_entries e
       LEFT JOIN slots s ON s.id = e.slot_id
       LEFT JOIN kick_links k ON k.kick_user_id = e.kick_user_id
      WHERE e.card_id = $1 AND ($2::text IS NULL OR e.status = $2)
      ORDER BY e.created_at ASC`,
    [cardId, status ?? null],
  );
  return found.map((r) => ({
    id: Number(r.id),
    kickUserId: r.kick_user_id,
    kickUsername: r.kick_username,
    query: r.query,
    slotName: r.name,
    provider: r.provider,
    imageUrl: r.image_url,
    status: r.status,
    createdAt: r.created_at.toISOString(),
    linked: r.linked,
    turns: r.turns,
  }));
}

export type BingoSummary = {
  /** Green squares by position. */
  green: Map<number, BingoTurn>;
  playing: BingoTurn | null;
  /** Draws that were bought (won or lost), not skipped. */
  bought: number;
  cost: number;
  won: number;
  profit: number;
};

/** Derived from the turns, never stored, so it cannot disagree with them. */
export function summarise(turns: BingoTurn[]): BingoSummary {
  const bought = turns.filter((t) => t.status === 'won' || t.status === 'lost');
  const cost = bought.reduce((sum, t) => sum + (t.buyCost ?? 0), 0);
  const won = bought.reduce((sum, t) => sum + (t.payout ?? 0), 0);
  return {
    green: new Map(turns.filter((t) => t.status === 'won').map((t) => [t.position, t])),
    playing: turns.find((t) => t.status === 'playing') ?? null,
    bought: bought.length,
    cost,
    won,
    profit: won - cost,
  };
}

export type CardHistory = BingoCard & { green: number; bought: number; cost: number; won: number };

/** Past cards with their totals, for the history table. */
export async function finishedCards(limit = 10): Promise<CardHistory[]> {
  const found = await rows<CardRow & { green: string; bought: string; cost: string; won: string }>(
    `SELECT c.id::text, c.title, c.size, c.square_prize, c.status, c.requests_open, c.result,
            c.created_at, c.finished_at,
            COUNT(t.id) FILTER (WHERE t.status = 'won')::text AS green,
            COUNT(t.id) FILTER (WHERE t.status IN ('won', 'lost'))::text AS bought,
            COALESCE(SUM(t.buy_cost) FILTER (WHERE t.status IN ('won', 'lost')), 0)::text AS cost,
            COALESCE(SUM(t.payout) FILTER (WHERE t.status IN ('won', 'lost')), 0)::text AS won
       FROM bingo_cards c LEFT JOIN bingo_turns t ON t.card_id = c.id
      WHERE c.status = 'finished'
      GROUP BY c.id
      ORDER BY c.finished_at DESC
      LIMIT $1`,
    [limit],
  );
  return found.map((r) => ({
    ...toCard(r),
    green: Number(r.green),
    bought: Number(r.bought),
    cost: Number(r.cost),
    won: Number(r.won),
  }));
}

/* -------------------------------------------------------------------------- */
/* Chat                                                                       */
/* -------------------------------------------------------------------------- */

export type BingoChatOutcome =
  | { ok: true; detail: string }
  | { ok: false; reason: 'no-card' | 'closed' | 'in-play' | 'already-won' };

/**
 * `!sr <slot>` while a card is running. One entry per chatter: a second !sr
 * replaces a waiting one, and a viewer whose buy lost (or was skipped) goes
 * back in the pool with the new slot. A viewer being played right now, or
 * who already won a square, is left alone.
 */
export async function submitBingoRequest(input: {
  kickUserId: string;
  kickUsername: string;
  query: string;
}): Promise<BingoChatOutcome> {
  const card = await liveCard();
  if (!card) return { ok: false, reason: 'no-card' };
  if (!card.requestsOpen) return { ok: false, reason: 'closed' };

  const slot = await matchSlot(input.query);
  const saved = await write<{ id: string }>(
    `INSERT INTO bingo_entries (card_id, kick_user_id, kick_username, query, slot_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (card_id, kick_user_id) DO UPDATE
       SET kick_username = EXCLUDED.kick_username, query = EXCLUDED.query,
           slot_id = EXCLUDED.slot_id, status = 'waiting', created_at = now()
       WHERE bingo_entries.status IN ('waiting', 'lost', 'skipped')
     RETURNING id::text`,
    [card.id, input.kickUserId, input.kickUsername, input.query, slot?.id ?? null],
  );
  if (saved.length === 0) {
    const existing = await one<{ status: EntryStatus }>(
      'SELECT status FROM bingo_entries WHERE card_id = $1 AND kick_user_id = $2',
      [card.id, input.kickUserId],
    );
    return { ok: false, reason: existing?.status === 'won' ? 'already-won' : 'in-play' };
  }
  return { ok: true, detail: slot ? `joined bingo with ${slot.name}` : 'joined bingo, slot kept as typed' };
}

/* -------------------------------------------------------------------------- */
/* Staff                                                                      */
/* -------------------------------------------------------------------------- */

export class BingoError extends Error {}

export async function createCard(input: { title: string; size: number; squarePrize: number }): Promise<void> {
  try {
    await write(`INSERT INTO bingo_cards (title, size, square_prize) VALUES ($1, $2, $3) RETURNING id`, [
      input.title,
      input.size,
      input.squarePrize,
    ]);
  } catch (error) {
    if (error instanceof Error && error.message.includes('bingo_cards_one_live_idx')) {
      throw new BingoError('A bingo is already running. End it before starting another.');
    }
    throw error;
  }
}

export async function setBingoRequestsOpen(cardId: number, open: boolean): Promise<void> {
  const done = await write(
    `UPDATE bingo_cards SET requests_open = $2 WHERE id = $1 AND status = 'running' RETURNING id`,
    [cardId, open],
  );
  if (done.length === 0) throw new BingoError('That bingo is not running.');
}

/** Takes a waiting viewer out of the pool. They can !sr again. */
export async function dismissEntry(entryId: number): Promise<void> {
  await write(`UPDATE bingo_entries SET status = 'skipped' WHERE id = $1 AND status = 'waiting'`, [entryId]);
}

async function greenPositions(client: PoolClient, cardId: number): Promise<number[]> {
  const { rows: found } = await client.query<{ position: number }>(
    `SELECT position FROM bingo_turns WHERE card_id = $1 AND status = 'won'`,
    [cardId],
  );
  return found.map((r) => r.position);
}

export type Draw = { viewer: string; slot: string; square: string };

/**
 * The draw: a random viewer from those waiting, onto a random open square.
 * Refused while a turn is still in play, and once the card has a line —
 * that is BINGO, and the next step is ending the card, not another draw.
 */
export async function drawTurn(cardId: number): Promise<Draw> {
  return tx(async (client) => {
    const { rows: found } = await client.query<{ status: BingoStatus; size: number }>(
      'SELECT status, size FROM bingo_cards WHERE id = $1 FOR UPDATE',
      [cardId],
    );
    const card = found[0];
    if (!card || card.status !== 'running') throw new BingoError('That bingo is not running.');

    const { rows: playing } = await client.query(
      `SELECT 1 FROM bingo_turns WHERE card_id = $1 AND status = 'playing'`,
      [cardId],
    );
    if (playing.length > 0) throw new BingoError('Record the result of the current buy first.');

    const green = await greenPositions(client, cardId);
    if (completedLines(card.size, green).length > 0) {
      throw new BingoError('The card already has BINGO. End it to pay the winners.');
    }

    const { rows: pool } = await client.query<{
      id: string;
      kick_user_id: string;
      kick_username: string;
      query: string;
      slot_id: string | null;
      turns: number;
    }>(
      `SELECT e.id::text, e.kick_user_id, e.kick_username, e.query, e.slot_id::text,
              (SELECT COUNT(*)::int FROM bingo_turns t
                WHERE t.card_id = e.card_id AND t.kick_user_id = e.kick_user_id
                  AND t.status IN ('won', 'lost')) AS turns
         FROM bingo_entries e WHERE e.card_id = $1 AND e.status = 'waiting'
        ORDER BY e.id FOR UPDATE OF e`,
      [cardId],
    );
    if (pool.length === 0) throw new BingoError('Nobody is waiting. Chat joins with !sr <slot>.');

    // Rounds: only the waiting viewers with the fewest buys so far are in the
    // draw, so everybody gets a go before anybody who lost gets a second one.
    // A skipped turn (the slot could not be played) does not count as a go.
    const fewest = Math.min(...pool.map((e) => e.turns));
    const eligible = pool.filter((e) => e.turns === fewest);

    const taken = new Set(green);
    const open = [...Array(card.size * card.size).keys()].filter((p) => !taken.has(p));
    const entry = eligible[randomInt(eligible.length)];
    const position = open[randomInt(open.length)];

    let slotId = entry.slot_id == null ? null : Number(entry.slot_id);
    let name = entry.query;
    let provider = '';
    let imageUrl: string | null = null;
    if (slotId) {
      const { rows: slot } = await client.query<{ name: string; provider: string; image_url: string | null }>(
        'SELECT name, provider, image_url FROM slots WHERE id = $1',
        [slotId],
      );
      if (slot[0]) {
        name = slot[0].name;
        provider = slot[0].provider;
        imageUrl = slot[0].image_url;
      } else {
        slotId = null;
      }
    }

    await client.query(
      `INSERT INTO bingo_turns (card_id, entry_id, position, kick_user_id, kick_username, slot_id, slot_name, provider, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [cardId, entry.id, position, entry.kick_user_id, entry.kick_username, slotId, name, provider, imageUrl],
    );
    await client.query(`UPDATE bingo_entries SET status = 'playing' WHERE id = $1`, [entry.id]);

    return { viewer: entry.kick_username, slot: name, square: cellLabel(position, card.size) };
  });
}

export type Resolution = { won: boolean; square: string; viewer: string; bingo: boolean };

/**
 * Recording the buy. More back than it cost turns the square green for that
 * viewer; anything else leaves the square open and puts the viewer back in
 * the running for a later !sr.
 */
export async function resolveTurn(turnId: number, buyCost: number, payout: number): Promise<Resolution> {
  return tx(async (client) => {
    const { rows: found } = await client.query<{
      card_id: string;
      entry_id: string | null;
      position: number;
      kick_username: string;
      status: TurnStatus;
      size: number;
      card_status: BingoStatus;
    }>(
      `SELECT t.card_id::text, t.entry_id::text, t.position, t.kick_username, t.status, c.size,
              c.status AS card_status
         FROM bingo_turns t JOIN bingo_cards c ON c.id = t.card_id
        WHERE t.id = $1 FOR UPDATE OF t, c`,
      [turnId],
    );
    const turn = found[0];
    if (!turn || turn.card_status !== 'running') throw new BingoError('That bingo is not running.');
    if (turn.status !== 'playing') throw new BingoError('That buy already has a result.');

    const won = isProfit(buyCost, payout);
    await client.query(
      `UPDATE bingo_turns SET status = $2, buy_cost = $3, payout = $4, resolved_at = now() WHERE id = $1`,
      [turnId, won ? 'won' : 'lost', buyCost, payout],
    );
    if (turn.entry_id) {
      await client.query(`UPDATE bingo_entries SET status = $2 WHERE id = $1`, [turn.entry_id, won ? 'won' : 'lost']);
    }

    const bingo = won && completedLines(turn.size, await greenPositions(client, Number(turn.card_id))).length > 0;
    return { won, square: cellLabel(turn.position, turn.size), viewer: turn.kick_username, bingo };
  });
}

/**
 * The drawn viewer's slot cannot be played (not at the casino, no bonus
 * buy). The square stays open, and the viewer can !sr something else.
 */
export async function skipTurn(turnId: number): Promise<void> {
  await tx(async (client) => {
    const { rows: done } = await client.query<{ entry_id: string | null }>(
      `UPDATE bingo_turns t SET status = 'skipped', resolved_at = now()
         FROM bingo_cards c
        WHERE t.id = $1 AND c.id = t.card_id AND t.status = 'playing' AND c.status = 'running'
        RETURNING t.entry_id::text`,
      [turnId],
    );
    if (done.length === 0) throw new BingoError('That buy is not in play.');
    if (done[0].entry_id) {
      await client.query(`UPDATE bingo_entries SET status = 'skipped' WHERE id = $1`, [done[0].entry_id]);
    }
  });
}

/**
 * Correcting a mistyped result: the latest bought turn goes back to being in
 * play, so it can be recorded again. Only while the card runs — nothing has
 * been paid yet — and only the latest, so later draws never rest on it.
 */
export async function undoLastResult(cardId: number): Promise<string> {
  return tx(async (client) => {
    const { rows: found } = await client.query<{ status: BingoStatus; size: number }>(
      'SELECT status, size FROM bingo_cards WHERE id = $1 FOR UPDATE',
      [cardId],
    );
    if (found[0]?.status !== 'running') throw new BingoError('That bingo is not running.');

    const { rows: last } = await client.query<{ id: string; status: TurnStatus; entry_id: string | null; position: number }>(
      `SELECT id::text, status, entry_id::text, position FROM bingo_turns
        WHERE card_id = $1 ORDER BY drawn_at DESC, id DESC LIMIT 1`,
      [cardId],
    );
    const turn = last[0];
    if (!turn || (turn.status !== 'won' && turn.status !== 'lost')) {
      throw new BingoError('The latest draw has no recorded result to undo.');
    }
    await client.query(
      `UPDATE bingo_turns SET status = 'playing', buy_cost = NULL, payout = NULL, resolved_at = NULL WHERE id = $1`,
      [turn.id],
    );
    // If they had already !sr'd again after losing, that newer request gives
    // way: they are back in play with the slot they were drawn with.
    if (turn.entry_id) {
      await client.query(`UPDATE bingo_entries SET status = 'playing' WHERE id = $1`, [turn.entry_id]);
    }
    return cellLabel(turn.position, found[0].size);
  });
}

export type FinishResult = {
  result: 'bingo' | 'stopped';
  green: number;
  /** Viewers whose green square sits on a completed line — the only ones paid. */
  lineViewers: number;
  paidViewers: number;
  unpaid: string[];
  totalPaid: number;
};

/**
 * Ending the card. With a line it is BINGO; without, the streamer stopped
 * it. Only the viewers whose green squares make up a completed line win: each
 * is paid the prize once (a square on two lines is still one square), if their
 * Kick account is linked — coins can only go to an account. A card stopped
 * without a line pays nobody. Payments
 * and the finished mark are one transaction under the card's row lock, so a
 * second click is a refusal, not a second payment.
 */
export async function finishCard(cardId: number, by: string): Promise<FinishResult> {
  return tx(async (client) => {
    const { rows: found } = await client.query<{ title: string; size: number; status: BingoStatus; square_prize: number }>(
      'SELECT title, size, status, square_prize FROM bingo_cards WHERE id = $1 FOR UPDATE',
      [cardId],
    );
    const card = found[0];
    if (!card || card.status !== 'running') throw new BingoError('That bingo is not running.');

    const { rows: playing } = await client.query(
      `SELECT 1 FROM bingo_turns WHERE card_id = $1 AND status = 'playing'`,
      [cardId],
    );
    if (playing.length > 0) throw new BingoError('Record or skip the buy in play first.');

    const { rows: winners } = await client.query<{
      id: string;
      position: number;
      kick_username: string;
      user_id: string | null;
    }>(
      `SELECT t.id::text, t.position, t.kick_username, k.user_id::text
         FROM bingo_turns t LEFT JOIN kick_links k ON k.kick_user_id = t.kick_user_id
        WHERE t.card_id = $1 AND t.status = 'won'
        ORDER BY t.position`,
      [cardId],
    );
    const lines = completedLines(card.size, winners.map((w) => w.position));
    const result = lines.length > 0 ? 'bingo' : 'stopped';
    const onLine = new Set(lines.flatMap((l) => l.positions));
    const lineWinners = winners.filter((w) => onLine.has(w.position));

    let paidViewers = 0;
    const unpaid: string[] = [];
    for (const w of lineWinners) {
      if (card.square_prize <= 0) continue;
      if (!w.user_id) {
        unpaid.push(w.kick_username);
        continue;
      }
      await apply(client, {
        userId: Number(w.user_id),
        delta: card.square_prize,
        kind: 'giveaway',
        reason: `Slot bingo line, square ${cellLabel(w.position, card.size)} — ${card.title}`,
        refType: 'slot_bingo',
        refId: `${cardId}:${w.position}`,
      });
      await client.query(`UPDATE bingo_turns SET paid = $2, paid_user_id = $3 WHERE id = $1`, [
        w.id,
        card.square_prize,
        w.user_id,
      ]);
      paidViewers++;
    }

    await client.query(
      `UPDATE bingo_cards SET status = 'finished', finished_at = now(), requests_open = false, result = $2 WHERE id = $1`,
      [cardId, result],
    );
    await client.query(
      `INSERT INTO audit_log (admin_name, action, target, detail) VALUES ($1, 'bingo.finished', $2, $3)`,
      [by, String(cardId), JSON.stringify({ result, green: winners.length, lineViewers: lineWinners.length, paidViewers, unpaid, prize: card.square_prize })],
    );

    return {
      result,
      green: winners.length,
      lineViewers: lineWinners.length,
      paidViewers,
      unpaid,
      totalPaid: paidViewers * card.square_prize,
    };
  });
}
