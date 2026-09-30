import 'server-only';
import { randomInt } from 'node:crypto';
import type { PoolClient } from 'pg';
import { one, rows, tx, write } from '@/lib/db';
import { kingOf, score } from '@/lib/koth';
import { apply } from './coins';
import { matchSlot } from './slots';

/**
 * King of the hill, run on this site (see migration 019 for the rules).
 *
 * The draw is made here, server-side, with a CSPRNG — never in the browser —
 * so what chat sees on stream is what the site decided. Coins move once, when
 * the game ends, through `apply` like every other coin on the site; until
 * then a result can still be corrected.
 */

export type KothStatus = 'running' | 'finished';
export type KothTurnStatus = 'playing' | 'played' | 'skipped';
export type KothEntryStatus = 'waiting' | 'playing' | 'played' | 'skipped';

export type KothGame = {
  id: number;
  title: string;
  prize: number;
  status: KothStatus;
  requestsOpen: boolean;
  createdAt: string;
  finishedAt: string | null;
};

export type KothTurn = {
  id: number;
  kickUserId: string;
  kickUsername: string;
  slotName: string;
  provider: string;
  imageUrl: string | null;
  status: KothTurnStatus;
  buyCost: number | null;
  payout: number | null;
  paid: number;
  drawnAt: string;
  resolvedAt: string | null;
};

export type KothEntry = {
  id: number;
  kickUserId: string;
  kickUsername: string;
  query: string;
  slotName: string | null;
  provider: string | null;
  imageUrl: string | null;
  status: KothEntryStatus;
  createdAt: string;
  /** Whether this chatter has a verified Kick link — only they can be paid. */
  linked: boolean;
  /** Buys already played for this viewer in this game (skips not counted). */
  turns: number;
};

type GameRow = {
  id: string;
  title: string;
  prize: number;
  status: KothStatus;
  requests_open: boolean;
  created_at: Date;
  finished_at: Date | null;
};

const GAME_COLUMNS = `id::text, title, prize, status, requests_open, created_at, finished_at`;

function toGame(r: GameRow): KothGame {
  return {
    id: Number(r.id),
    title: r.title,
    prize: r.prize,
    status: r.status,
    requestsOpen: r.requests_open,
    createdAt: r.created_at.toISOString(),
    finishedAt: r.finished_at?.toISOString() ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Reading                                                                    */
/* -------------------------------------------------------------------------- */

/** The running game, if there is one. `!sr` joins this one. */
export async function liveGame(): Promise<KothGame | null> {
  const row = await one<GameRow>(`SELECT ${GAME_COLUMNS} FROM koth_games WHERE status = 'running' LIMIT 1`);
  return row ? toGame(row) : null;
}

/** What the pages show: the running game, else the last one to finish. */
export async function featuredGame(): Promise<KothGame | null> {
  const row = await one<GameRow>(
    `SELECT ${GAME_COLUMNS} FROM koth_games ORDER BY (status = 'running') DESC, created_at DESC LIMIT 1`,
  );
  return row ? toGame(row) : null;
}

/** Every challenger in a game, oldest first — the order the hill was fought in. */
export async function kothTurnsFor(gameId: number): Promise<KothTurn[]> {
  const found = await rows<{
    id: string;
    kick_user_id: string;
    kick_username: string;
    slot_name: string;
    provider: string;
    image_url: string | null;
    status: KothTurnStatus;
    buy_cost: string | null;
    payout: string | null;
    paid: number;
    drawn_at: Date;
    resolved_at: Date | null;
  }>(
    `SELECT id::text, kick_user_id, kick_username, slot_name, provider, image_url, status,
            buy_cost::text, payout::text, paid, drawn_at, resolved_at
       FROM koth_turns WHERE game_id = $1 ORDER BY drawn_at, id`,
    [gameId],
  );
  return found.map((r) => ({
    id: Number(r.id),
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
export async function kothEntriesFor(gameId: number, status?: KothEntryStatus): Promise<KothEntry[]> {
  const found = await rows<{
    id: string;
    kick_user_id: string;
    kick_username: string;
    query: string;
    name: string | null;
    provider: string | null;
    image_url: string | null;
    status: KothEntryStatus;
    created_at: Date;
    linked: boolean;
    turns: number;
  }>(
    `SELECT e.id::text, e.kick_user_id, e.kick_username, e.query, s.name, s.provider, s.image_url,
            e.status, e.created_at, (k.user_id IS NOT NULL) AS linked,
            (SELECT COUNT(*)::int FROM koth_turns t
              WHERE t.game_id = e.game_id AND t.kick_user_id = e.kick_user_id
                AND t.status = 'played') AS turns
       FROM koth_entries e
       LEFT JOIN slots s ON s.id = e.slot_id
       LEFT JOIN kick_links k ON k.kick_user_id = e.kick_user_id
      WHERE e.game_id = $1 AND ($2::text IS NULL OR e.status = $2)
      ORDER BY e.created_at ASC`,
    [gameId, status ?? null],
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

export type KothSummary = {
  king: KothTurn | null;
  /** The king's multiplier: what the next challenger has to beat. */
  toBeat: number | null;
  playing: KothTurn | null;
  /** Turns that took the hill when they were played, in order. */
  crowned: Set<number>;
  /** Turns that matched the king of their time exactly — not enough to take it. */
  tied: Set<number>;
  /** Times the hill changed hands after the first king. */
  dethroned: number;
  /** Challengers in a row the current king has survived. */
  defences: number;
  bought: number;
  cost: number;
  won: number;
  profit: number;
};

/** Derived from the turns, never stored, so it cannot disagree with them. */
export function summariseKoth(turns: KothTurn[]): KothSummary {
  const played = turns.filter((t) => t.status === 'played');
  const crowned = new Set<number>();
  const tied = new Set<number>();
  let best = -1;
  let defences = 0;
  for (const t of played) {
    const x = score(t) ?? 0;
    if (crowned.size === 0 || x > best) {
      crowned.add(t.id);
      best = x;
      defences = 0;
    } else {
      if (x === best) tied.add(t.id);
      defences++;
    }
  }
  const king = kingOf(played);
  const cost = played.reduce((sum, t) => sum + (t.buyCost ?? 0), 0);
  const won = played.reduce((sum, t) => sum + (t.payout ?? 0), 0);
  return {
    king,
    toBeat: king ? score(king) : null,
    playing: turns.find((t) => t.status === 'playing') ?? null,
    crowned,
    tied,
    dethroned: Math.max(0, crowned.size - 1),
    defences,
    bought: played.length,
    cost,
    won,
    profit: won - cost,
  };
}

export type GameHistory = KothGame & {
  king: string | null;
  kingSlot: string | null;
  best: number | null;
  paid: number;
  bought: number;
  cost: number;
  won: number;
};

/** Past games with their king and totals, for the history table. */
export async function finishedGames(limit = 10): Promise<GameHistory[]> {
  const found = await rows<GameRow>(
    `SELECT ${GAME_COLUMNS} FROM koth_games WHERE status = 'finished' ORDER BY finished_at DESC LIMIT $1`,
    [limit],
  );
  return Promise.all(
    found.map(async (r) => {
      const game = toGame(r);
      const s = summariseKoth(await kothTurnsFor(game.id));
      return {
        ...game,
        king: s.king?.kickUsername ?? null,
        kingSlot: s.king?.slotName ?? null,
        best: s.toBeat,
        paid: s.king?.paid ?? 0,
        bought: s.bought,
        cost: s.cost,
        won: s.won,
      };
    }),
  );
}

/* -------------------------------------------------------------------------- */
/* Chat                                                                       */
/* -------------------------------------------------------------------------- */

export type KothChatOutcome =
  | { ok: true; detail: string }
  | { ok: false; reason: 'no-game' | 'closed' | 'in-play' };

/**
 * `!sr <slot>` while a game is running. One entry per chatter: a second !sr
 * replaces a waiting one, and a viewer who has played (or was skipped) goes
 * back in the pool with the new slot. Only the viewer being played right now
 * is left alone.
 */
export async function submitKothRequest(input: {
  kickUserId: string;
  kickUsername: string;
  query: string;
}): Promise<KothChatOutcome> {
  const game = await liveGame();
  if (!game) return { ok: false, reason: 'no-game' };
  if (!game.requestsOpen) return { ok: false, reason: 'closed' };

  const slot = await matchSlot(input.query);
  const saved = await write<{ id: string }>(
    `INSERT INTO koth_entries (game_id, kick_user_id, kick_username, query, slot_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (game_id, kick_user_id) DO UPDATE
       SET kick_username = EXCLUDED.kick_username, query = EXCLUDED.query,
           slot_id = EXCLUDED.slot_id, status = 'waiting', created_at = now()
       WHERE koth_entries.status IN ('waiting', 'played', 'skipped')
     RETURNING id::text`,
    [game.id, input.kickUserId, input.kickUsername, input.query, slot?.id ?? null],
  );
  if (saved.length === 0) return { ok: false, reason: 'in-play' };
  return {
    ok: true,
    detail: slot ? `joined king of the hill with ${slot.name}` : 'joined king of the hill, slot kept as typed',
  };
}

/* -------------------------------------------------------------------------- */
/* Staff                                                                      */
/* -------------------------------------------------------------------------- */

export class KothError extends Error {}

/**
 * Starting a game. Refused while a slot bingo runs: both take `!sr`, and chat
 * cannot say which one it meant.
 */
export async function createGame(input: { title: string; prize: number }): Promise<void> {
  try {
    const made = await write<{ id: string }>(
      `INSERT INTO koth_games (title, prize)
       SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM bingo_cards WHERE status = 'running')
       RETURNING id::text`,
      [input.title, input.prize],
    );
    if (made.length === 0) throw new KothError('A slot bingo is running and takes !sr. End it first.');
  } catch (error) {
    if (error instanceof Error && error.message.includes('koth_games_one_live_idx')) {
      throw new KothError('A king of the hill is already running. End it before starting another.');
    }
    throw error;
  }
}

export async function setKothRequestsOpen(gameId: number, open: boolean): Promise<void> {
  const done = await write(
    `UPDATE koth_games SET requests_open = $2 WHERE id = $1 AND status = 'running' RETURNING id`,
    [gameId, open],
  );
  if (done.length === 0) throw new KothError('That game is not running.');
}

/** Takes a waiting viewer out of the pool. They can !sr again. */
export async function dismissKothEntry(entryId: number): Promise<void> {
  await write(`UPDATE koth_entries SET status = 'skipped' WHERE id = $1 AND status = 'waiting'`, [entryId]);
}

export type KothDraw = { viewer: string; slot: string };

/**
 * The draw: a random viewer from those waiting who have had the fewest goes,
 * so everybody challenges once before anybody challenges twice. Refused while
 * a buy is still in play.
 */
export async function drawChallenger(gameId: number): Promise<KothDraw> {
  return tx(async (client) => {
    const { rows: found } = await client.query<{ status: KothStatus }>(
      'SELECT status FROM koth_games WHERE id = $1 FOR UPDATE',
      [gameId],
    );
    if (found[0]?.status !== 'running') throw new KothError('That game is not running.');

    const { rows: playing } = await client.query(
      `SELECT 1 FROM koth_turns WHERE game_id = $1 AND status = 'playing'`,
      [gameId],
    );
    if (playing.length > 0) throw new KothError('Record the result of the current buy first.');

    const { rows: pool } = await client.query<{
      id: string;
      kick_user_id: string;
      kick_username: string;
      query: string;
      slot_id: string | null;
      turns: number;
    }>(
      `SELECT e.id::text, e.kick_user_id, e.kick_username, e.query, e.slot_id::text,
              (SELECT COUNT(*)::int FROM koth_turns t
                WHERE t.game_id = e.game_id AND t.kick_user_id = e.kick_user_id
                  AND t.status = 'played') AS turns
         FROM koth_entries e WHERE e.game_id = $1 AND e.status = 'waiting'
        ORDER BY e.id FOR UPDATE OF e`,
      [gameId],
    );
    if (pool.length === 0) throw new KothError('Nobody is waiting. Chat joins with !sr <slot>.');

    // Rounds, as in slot bingo: a skipped turn (the slot could not be played)
    // does not count as a go.
    const fewest = Math.min(...pool.map((e) => e.turns));
    const eligible = pool.filter((e) => e.turns === fewest);
    const entry = eligible[randomInt(eligible.length)];

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
      `INSERT INTO koth_turns (game_id, entry_id, kick_user_id, kick_username, slot_id, slot_name, provider, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [gameId, entry.id, entry.kick_user_id, entry.kick_username, slotId, name, provider, imageUrl],
    );
    await client.query(`UPDATE koth_entries SET status = 'playing' WHERE id = $1`, [entry.id]);

    return { viewer: entry.kick_username, slot: name };
  });
}

export type KothResolution = {
  viewer: string;
  multiplier: number;
  /** Whether this buy took the hill. */
  crowned: boolean;
  /** Who held it before, when it changed hands. */
  previous: string | null;
  /** The king's multiplier after this buy. */
  toBeat: number;
};

/** Recording the buy. It takes the hill if it beats the king's multiplier. */
export async function resolveChallenge(turnId: number, buyCost: number, payout: number): Promise<KothResolution> {
  return tx(async (client) => {
    const { rows: found } = await client.query<{
      game_id: string;
      entry_id: string | null;
      kick_username: string;
      status: KothTurnStatus;
      game_status: KothStatus;
    }>(
      `SELECT t.game_id::text, t.entry_id::text, t.kick_username, t.status, g.status AS game_status
         FROM koth_turns t JOIN koth_games g ON g.id = t.game_id
        WHERE t.id = $1 FOR UPDATE OF t, g`,
      [turnId],
    );
    const turn = found[0];
    if (!turn || turn.game_status !== 'running') throw new KothError('That game is not running.');
    if (turn.status !== 'playing') throw new KothError('That buy already has a result.');

    const before = kingOf(await playedBuys(client, Number(turn.game_id)));

    await client.query(
      `UPDATE koth_turns SET status = 'played', buy_cost = $2, payout = $3, resolved_at = now() WHERE id = $1`,
      [turnId, buyCost, payout],
    );
    if (turn.entry_id) {
      await client.query(`UPDATE koth_entries SET status = 'played' WHERE id = $1`, [turn.entry_id]);
    }

    const after = kingOf(await playedBuys(client, Number(turn.game_id)));
    const crowned = after?.id === String(turnId);
    return {
      viewer: turn.kick_username,
      multiplier: payout / buyCost,
      crowned,
      previous: crowned && before ? before.kick_username : null,
      toBeat: after ? (score(after) ?? 0) : 0,
    };
  });
}

type PlayedBuy = { id: string; kick_username: string; buyCost: number | null; payout: number | null };

async function playedBuys(client: PoolClient, gameId: number): Promise<PlayedBuy[]> {
  const { rows: found } = await client.query<{ id: string; kick_username: string; buy_cost: string; payout: string }>(
    `SELECT id::text, kick_username, buy_cost::text, payout::text FROM koth_turns
      WHERE game_id = $1 AND status = 'played' ORDER BY drawn_at, id`,
    [gameId],
  );
  return found.map((r) => ({ id: r.id, kick_username: r.kick_username, buyCost: Number(r.buy_cost), payout: Number(r.payout) }));
}

/**
 * The drawn viewer's slot cannot be played (not at the casino, no bonus buy).
 * The hill is untouched, and the viewer can !sr something else.
 */
export async function skipChallenge(turnId: number): Promise<void> {
  await tx(async (client) => {
    const { rows: done } = await client.query<{ entry_id: string | null }>(
      `UPDATE koth_turns t SET status = 'skipped', resolved_at = now()
         FROM koth_games g
        WHERE t.id = $1 AND g.id = t.game_id AND t.status = 'playing' AND g.status = 'running'
        RETURNING t.entry_id::text`,
      [turnId],
    );
    if (done.length === 0) throw new KothError('That buy is not in play.');
    if (done[0].entry_id) {
      await client.query(`UPDATE koth_entries SET status = 'skipped' WHERE id = $1`, [done[0].entry_id]);
    }
  });
}

/**
 * Correcting a mistyped result: the latest played turn goes back to being in
 * play, so it can be recorded again. Only while the game runs — nothing has
 * been paid yet — and only the latest, so later challengers never rest on it.
 */
export async function undoLastChallenge(gameId: number): Promise<string> {
  return tx(async (client) => {
    const { rows: found } = await client.query<{ status: KothStatus }>(
      'SELECT status FROM koth_games WHERE id = $1 FOR UPDATE',
      [gameId],
    );
    if (found[0]?.status !== 'running') throw new KothError('That game is not running.');

    const { rows: last } = await client.query<{ id: string; status: KothTurnStatus; entry_id: string | null; kick_username: string }>(
      `SELECT id::text, status, entry_id::text, kick_username FROM koth_turns
        WHERE game_id = $1 ORDER BY drawn_at DESC, id DESC LIMIT 1`,
      [gameId],
    );
    const turn = last[0];
    if (!turn || turn.status !== 'played') throw new KothError('The latest challenger has no recorded result to undo.');

    await client.query(
      `UPDATE koth_turns SET status = 'playing', buy_cost = NULL, payout = NULL, resolved_at = NULL WHERE id = $1`,
      [turn.id],
    );
    // If they had already !sr'd again, that newer request gives way: they are
    // back in play with the slot they were drawn with.
    if (turn.entry_id) {
      await client.query(`UPDATE koth_entries SET status = 'playing' WHERE id = $1`, [turn.entry_id]);
    }
    return turn.kick_username;
  });
}

export type KothFinish = {
  king: string | null;
  multiplier: number | null;
  paid: number;
  /** The king's Kick account is not linked, so the prize could not be paid. */
  unpaid: boolean;
};

/**
 * Ending the game. Whoever holds the hill is paid the prize, once, if their
 * Kick account is linked — coins can only go to an account. A game nobody
 * played pays nobody. The payment and the finished mark are one transaction
 * under the game's row lock, so a second click is a refusal, not a second
 * payment.
 */
export async function finishGame(gameId: number, by: string): Promise<KothFinish> {
  return tx(async (client) => {
    const { rows: found } = await client.query<{ title: string; status: KothStatus; prize: number }>(
      'SELECT title, status, prize FROM koth_games WHERE id = $1 FOR UPDATE',
      [gameId],
    );
    const game = found[0];
    if (!game || game.status !== 'running') throw new KothError('That game is not running.');

    const { rows: playing } = await client.query(
      `SELECT 1 FROM koth_turns WHERE game_id = $1 AND status = 'playing'`,
      [gameId],
    );
    if (playing.length > 0) throw new KothError('Record or skip the buy in play first.');

    const { rows: played } = await client.query<{
      id: string;
      kick_username: string;
      buy_cost: string;
      payout: string;
      user_id: string | null;
    }>(
      `SELECT t.id::text, t.kick_username, t.buy_cost::text, t.payout::text, k.user_id::text
         FROM koth_turns t LEFT JOIN kick_links k ON k.kick_user_id = t.kick_user_id
        WHERE t.game_id = $1 AND t.status = 'played'
        ORDER BY t.drawn_at, t.id`,
      [gameId],
    );
    const king = kingOf(played.map((r) => ({ ...r, buyCost: Number(r.buy_cost), payout: Number(r.payout) })));

    let paid = 0;
    let unpaid = false;
    if (king && game.prize > 0) {
      if (king.user_id) {
        await apply(client, {
          userId: Number(king.user_id),
          delta: game.prize,
          kind: 'giveaway',
          reason: `King of the hill — ${game.title}`,
          refType: 'koth',
          refId: String(gameId),
        });
        await client.query(`UPDATE koth_turns SET paid = $2, paid_user_id = $3 WHERE id = $1`, [
          king.id,
          game.prize,
          king.user_id,
        ]);
        paid = game.prize;
      } else {
        unpaid = true;
      }
    }

    await client.query(
      `UPDATE koth_games SET status = 'finished', finished_at = now(), requests_open = false WHERE id = $1`,
      [gameId],
    );
    const multiplier = king ? score(king) : null;
    await client.query(
      `INSERT INTO audit_log (admin_name, action, target, detail) VALUES ($1, 'koth.finished', $2, $3)`,
      [by, String(gameId), JSON.stringify({ king: king?.kick_username ?? null, multiplier, paid, unpaid, prize: game.prize })],
    );

    return { king: king?.kick_username ?? null, multiplier, paid, unpaid };
  });
}

/**
 * Deleting a game, for test runs. A game that paid its king is kept — it is
 * the record of why those coins were paid.
 */
export async function deleteGame(gameId: number): Promise<string> {
  return tx(async (client) => {
    const { rows: found } = await client.query<{ title: string }>(
      'SELECT title FROM koth_games WHERE id = $1 FOR UPDATE',
      [gameId],
    );
    if (!found[0]) throw new KothError('That game no longer exists.');
    const { rows: paid } = await client.query(`SELECT 1 FROM koth_turns WHERE game_id = $1 AND paid > 0`, [gameId]);
    if (paid.length > 0) throw new KothError('This game paid its king, so it is kept as the record of that payment.');
    await client.query('DELETE FROM koth_games WHERE id = $1', [gameId]);
    return found[0].title;
  });
}
