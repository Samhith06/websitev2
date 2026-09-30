import 'server-only';
import { randomInt } from 'node:crypto';
import type { PoolClient } from 'pg';
import { one, rows, tx, write } from '@/lib/db';
import { damageOf, fight, hp } from '@/lib/raid';
import { apply } from './coins';
import { matchSlot } from './slots';
import { noOtherSrGame, otherSrGameMessage } from './stream-games';

/**
 * Boss raid, run on this site (see migration 020 for the rules).
 *
 * The draw is made here, server-side, with a CSPRNG — never in the browser —
 * so what chat sees on stream is what the site decided. Coins move once, when
 * the raid ends, through `apply` like every other coin on the site; until
 * then a result can still be corrected.
 */

export type RaidStatus = 'running' | 'finished';
export type RaidTurnStatus = 'playing' | 'played' | 'skipped';
export type RaidEntryStatus = 'waiting' | 'playing' | 'played' | 'skipped';

export type Raid = {
  id: number;
  boss: string;
  maxHp: number;
  prize: number;
  status: RaidStatus;
  requestsOpen: boolean;
  result: 'slain' | 'stopped' | null;
  createdAt: string;
  finishedAt: string | null;
};

export type RaidTurn = {
  id: number;
  kickUserId: string;
  kickUsername: string;
  slotName: string;
  provider: string;
  imageUrl: string | null;
  status: RaidTurnStatus;
  buyCost: number | null;
  payout: number | null;
  paid: number;
  drawnAt: string;
  resolvedAt: string | null;
};

export type RaidEntry = {
  id: number;
  kickUserId: string;
  kickUsername: string;
  query: string;
  slotName: string | null;
  provider: string | null;
  imageUrl: string | null;
  status: RaidEntryStatus;
  createdAt: string;
  /** Whether this chatter has a verified Kick link — only they can be paid. */
  linked: boolean;
  /** Buys already played for this viewer in this raid (skips not counted). */
  turns: number;
};

type RaidRow = {
  id: string;
  boss: string;
  max_hp: number;
  prize: number;
  status: RaidStatus;
  requests_open: boolean;
  result: 'slain' | 'stopped' | null;
  created_at: Date;
  finished_at: Date | null;
};

const RAID_COLUMNS = `id::text, boss, max_hp, prize, status, requests_open, result, created_at, finished_at`;

function toRaid(r: RaidRow): Raid {
  return {
    id: Number(r.id),
    boss: r.boss,
    maxHp: r.max_hp,
    prize: r.prize,
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

/** The running raid, if there is one. `!sr` joins this one. */
export async function liveRaid(): Promise<Raid | null> {
  const row = await one<RaidRow>(`SELECT ${RAID_COLUMNS} FROM raid_games WHERE status = 'running' LIMIT 1`);
  return row ? toRaid(row) : null;
}

/** What the pages show: the running raid, else the last one to finish. */
export async function featuredRaid(): Promise<Raid | null> {
  const row = await one<RaidRow>(
    `SELECT ${RAID_COLUMNS} FROM raid_games ORDER BY (status = 'running') DESC, created_at DESC LIMIT 1`,
  );
  return row ? toRaid(row) : null;
}

/** Every hit on a raid, oldest first — the order the damage landed in. */
export async function raidTurnsFor(gameId: number): Promise<RaidTurn[]> {
  const found = await rows<{
    id: string;
    kick_user_id: string;
    kick_username: string;
    slot_name: string;
    provider: string;
    image_url: string | null;
    status: RaidTurnStatus;
    buy_cost: string | null;
    payout: string | null;
    paid: number;
    drawn_at: Date;
    resolved_at: Date | null;
  }>(
    `SELECT id::text, kick_user_id, kick_username, slot_name, provider, image_url, status,
            buy_cost::text, payout::text, paid, drawn_at, resolved_at
       FROM raid_turns WHERE game_id = $1 ORDER BY drawn_at, id`,
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
export async function raidEntriesFor(gameId: number, status?: RaidEntryStatus): Promise<RaidEntry[]> {
  const found = await rows<{
    id: string;
    kick_user_id: string;
    kick_username: string;
    query: string;
    name: string | null;
    provider: string | null;
    image_url: string | null;
    status: RaidEntryStatus;
    created_at: Date;
    linked: boolean;
    turns: number;
  }>(
    `SELECT e.id::text, e.kick_user_id, e.kick_username, e.query, s.name, s.provider, s.image_url,
            e.status, e.created_at, (k.user_id IS NOT NULL) AS linked,
            (SELECT COUNT(*)::int FROM raid_turns t
              WHERE t.game_id = e.game_id AND t.kick_user_id = e.kick_user_id
                AND t.status = 'played') AS turns
       FROM raid_entries e
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

export type Raider = { kickUsername: string; damage: number; hits: number };

export type RaidSummary = {
  /** HP and damage in hundredths of a point; see lib/raid. */
  maxHp: number;
  dealt: number;
  hpLeft: number;
  slain: boolean;
  killer: RaidTurn | null;
  overkill: number;
  playing: RaidTurn | null;
  /** The latest hit that landed, for the "last hit" line. */
  lastHit: RaidTurn | null;
  /** Damage by viewer, most first. For show only — the prize is the killing blow's. */
  raiders: Raider[];
  bought: number;
  cost: number;
  won: number;
  profit: number;
};

/** Derived from the turns, never stored, so it cannot disagree with them. */
export function summariseRaid(raid: Raid, turns: RaidTurn[]): RaidSummary {
  const played = turns.filter((t) => t.status === 'played');
  const f = fight(raid.maxHp, played);
  const byViewer = new Map<string, Raider>();
  for (const t of played) {
    const r = byViewer.get(t.kickUserId) ?? { kickUsername: t.kickUsername, damage: 0, hits: 0 };
    r.damage += damageOf(t) ?? 0;
    r.hits++;
    byViewer.set(t.kickUserId, r);
  }
  const cost = played.reduce((sum, t) => sum + (t.buyCost ?? 0), 0);
  const won = played.reduce((sum, t) => sum + (t.payout ?? 0), 0);
  return {
    maxHp: raid.maxHp * 100,
    dealt: f.dealt,
    hpLeft: f.hpLeft,
    slain: f.killer != null,
    killer: f.killer,
    overkill: f.overkill,
    playing: turns.find((t) => t.status === 'playing') ?? null,
    lastHit: played[played.length - 1] ?? null,
    raiders: [...byViewer.values()].sort((a, b) => b.damage - a.damage),
    bought: played.length,
    cost,
    won,
    profit: won - cost,
  };
}

export type RaidHistory = Raid & {
  killer: string | null;
  killerSlot: string | null;
  paid: number;
  bought: number;
  cost: number;
  won: number;
};

/** Past raids with who slew the boss and the totals, for the history table. */
export async function finishedRaids(limit = 10): Promise<RaidHistory[]> {
  const found = await rows<RaidRow>(
    `SELECT ${RAID_COLUMNS} FROM raid_games WHERE status = 'finished' ORDER BY finished_at DESC LIMIT $1`,
    [limit],
  );
  return Promise.all(
    found.map(async (r) => {
      const raid = toRaid(r);
      const s = summariseRaid(raid, await raidTurnsFor(raid.id));
      return {
        ...raid,
        killer: s.killer?.kickUsername ?? null,
        killerSlot: s.killer?.slotName ?? null,
        paid: s.killer?.paid ?? 0,
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

export type RaidChatOutcome =
  | { ok: true; detail: string }
  | { ok: false; reason: 'no-raid' | 'closed' | 'in-play' };

/**
 * `!sr <slot>` while a raid is running. One entry per chatter: a second !sr
 * replaces a waiting one, and a viewer who has played (or was skipped) goes
 * back in the pool with the new slot. Only the viewer being played right now
 * is left alone.
 */
export async function submitRaidRequest(input: {
  kickUserId: string;
  kickUsername: string;
  query: string;
}): Promise<RaidChatOutcome> {
  const raid = await liveRaid();
  if (!raid) return { ok: false, reason: 'no-raid' };
  if (!raid.requestsOpen) return { ok: false, reason: 'closed' };

  const slot = await matchSlot(input.query);
  const saved = await write<{ id: string }>(
    `INSERT INTO raid_entries (game_id, kick_user_id, kick_username, query, slot_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (game_id, kick_user_id) DO UPDATE
       SET kick_username = EXCLUDED.kick_username, query = EXCLUDED.query,
           slot_id = EXCLUDED.slot_id, status = 'waiting', created_at = now()
       WHERE raid_entries.status IN ('waiting', 'played', 'skipped')
     RETURNING id::text`,
    [raid.id, input.kickUserId, input.kickUsername, input.query, slot?.id ?? null],
  );
  if (saved.length === 0) return { ok: false, reason: 'in-play' };
  return { ok: true, detail: slot ? `joined the boss raid with ${slot.name}` : 'joined the boss raid, slot kept as typed' };
}

/* -------------------------------------------------------------------------- */
/* Staff                                                                      */
/* -------------------------------------------------------------------------- */

export class RaidError extends Error {}

/** Starting a raid. Refused while another `!sr` game runs: chat cannot say which one it meant. */
export async function createRaid(input: { boss: string; maxHp: number; prize: number }): Promise<void> {
  try {
    const made = await write<{ id: string }>(
      `INSERT INTO raid_games (boss, max_hp, prize)
       SELECT $1, $2, $3 WHERE ${noOtherSrGame('raid')}
       RETURNING id::text`,
      [input.boss, input.maxHp, input.prize],
    );
    if (made.length === 0) throw new RaidError(await otherSrGameMessage('raid'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('raid_games_one_live_idx')) {
      throw new RaidError('A boss raid is already running. End it before starting another.');
    }
    throw error;
  }
}

export async function setRaidRequestsOpen(gameId: number, open: boolean): Promise<void> {
  const done = await write(
    `UPDATE raid_games SET requests_open = $2 WHERE id = $1 AND status = 'running' RETURNING id`,
    [gameId, open],
  );
  if (done.length === 0) throw new RaidError('That raid is not running.');
}

/** Takes a waiting viewer out of the pool. They can !sr again. */
export async function dismissRaidEntry(entryId: number): Promise<void> {
  await write(`UPDATE raid_entries SET status = 'skipped' WHERE id = $1 AND status = 'waiting'`, [entryId]);
}

type PlayedHit = { id: string; kick_username: string; buyCost: number; payout: number };

async function playedHits(client: PoolClient, gameId: number): Promise<PlayedHit[]> {
  const { rows: found } = await client.query<{ id: string; kick_username: string; buy_cost: string; payout: string }>(
    `SELECT id::text, kick_username, buy_cost::text, payout::text FROM raid_turns
      WHERE game_id = $1 AND status = 'played' ORDER BY drawn_at, id`,
    [gameId],
  );
  return found.map((r) => ({ id: r.id, kick_username: r.kick_username, buyCost: Number(r.buy_cost), payout: Number(r.payout) }));
}

export type RaidDraw = { viewer: string; slot: string };

/**
 * The draw: a random viewer from those waiting who have had the fewest goes,
 * so everybody hits once before anybody hits twice. Refused while a buy is
 * still in play, and once the boss has fallen — the next step then is ending
 * the raid, not another draw.
 */
export async function drawRaider(gameId: number): Promise<RaidDraw> {
  return tx(async (client) => {
    const { rows: found } = await client.query<{ status: RaidStatus; max_hp: number }>(
      'SELECT status, max_hp FROM raid_games WHERE id = $1 FOR UPDATE',
      [gameId],
    );
    const raid = found[0];
    if (raid?.status !== 'running') throw new RaidError('That raid is not running.');

    const { rows: playing } = await client.query(
      `SELECT 1 FROM raid_turns WHERE game_id = $1 AND status = 'playing'`,
      [gameId],
    );
    if (playing.length > 0) throw new RaidError('Record the result of the current buy first.');
    if (fight(raid.max_hp, await playedHits(client, gameId)).killer) {
      throw new RaidError('The boss is already slain. End the raid to pay the killing blow.');
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
              (SELECT COUNT(*)::int FROM raid_turns t
                WHERE t.game_id = e.game_id AND t.kick_user_id = e.kick_user_id
                  AND t.status = 'played') AS turns
         FROM raid_entries e WHERE e.game_id = $1 AND e.status = 'waiting'
        ORDER BY e.id FOR UPDATE OF e`,
      [gameId],
    );
    if (pool.length === 0) throw new RaidError('Nobody is waiting. Chat joins with !sr <slot>.');

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
      `INSERT INTO raid_turns (game_id, entry_id, kick_user_id, kick_username, slot_id, slot_name, provider, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [gameId, entry.id, entry.kick_user_id, entry.kick_username, slotId, name, provider, imageUrl],
    );
    await client.query(`UPDATE raid_entries SET status = 'playing' WHERE id = $1`, [entry.id]);

    return { viewer: entry.kick_username, slot: name };
  });
}

export type RaidHit = {
  viewer: string;
  /** In hundredths, as everywhere in the raid. */
  damage: number;
  hpLeft: number;
  /** Whether this hit was the killing blow. */
  slain: boolean;
};

/** Recording the buy: it deals its multiplier in damage. */
export async function resolveRaidTurn(turnId: number, buyCost: number, payout: number): Promise<RaidHit> {
  return tx(async (client) => {
    const { rows: found } = await client.query<{
      game_id: string;
      entry_id: string | null;
      kick_username: string;
      status: RaidTurnStatus;
      game_status: RaidStatus;
      max_hp: number;
    }>(
      `SELECT t.game_id::text, t.entry_id::text, t.kick_username, t.status, g.status AS game_status, g.max_hp
         FROM raid_turns t JOIN raid_games g ON g.id = t.game_id
        WHERE t.id = $1 FOR UPDATE OF t, g`,
      [turnId],
    );
    const turn = found[0];
    if (!turn || turn.game_status !== 'running') throw new RaidError('That raid is not running.');
    if (turn.status !== 'playing') throw new RaidError('That buy already has a result.');

    await client.query(
      `UPDATE raid_turns SET status = 'played', buy_cost = $2, payout = $3, resolved_at = now() WHERE id = $1`,
      [turnId, buyCost, payout],
    );
    if (turn.entry_id) {
      await client.query(`UPDATE raid_entries SET status = 'played' WHERE id = $1`, [turn.entry_id]);
    }

    const f = fight(turn.max_hp, await playedHits(client, Number(turn.game_id)));
    return {
      viewer: turn.kick_username,
      damage: damageOf({ buyCost, payout }) ?? 0,
      hpLeft: f.hpLeft,
      slain: f.killer?.id === String(turnId),
    };
  });
}

/**
 * The drawn viewer's slot cannot be played (not at the casino, no bonus buy).
 * The boss is untouched, and the viewer can !sr something else.
 */
export async function skipRaidTurn(turnId: number): Promise<void> {
  await tx(async (client) => {
    const { rows: done } = await client.query<{ entry_id: string | null }>(
      `UPDATE raid_turns t SET status = 'skipped', resolved_at = now()
         FROM raid_games g
        WHERE t.id = $1 AND g.id = t.game_id AND t.status = 'playing' AND g.status = 'running'
        RETURNING t.entry_id::text`,
      [turnId],
    );
    if (done.length === 0) throw new RaidError('That buy is not in play.');
    if (done[0].entry_id) {
      await client.query(`UPDATE raid_entries SET status = 'skipped' WHERE id = $1`, [done[0].entry_id]);
    }
  });
}

/**
 * Correcting a mistyped result: the latest hit goes back to being in play, so
 * it can be recorded again — even a killing blow, which stands the boss back
 * up. Only while the raid runs — nothing has been paid yet — and only the
 * latest, so later hits never rest on it.
 */
export async function undoLastRaidTurn(gameId: number): Promise<string> {
  return tx(async (client) => {
    const { rows: found } = await client.query<{ status: RaidStatus }>(
      'SELECT status FROM raid_games WHERE id = $1 FOR UPDATE',
      [gameId],
    );
    if (found[0]?.status !== 'running') throw new RaidError('That raid is not running.');

    const { rows: last } = await client.query<{ id: string; status: RaidTurnStatus; entry_id: string | null; kick_username: string }>(
      `SELECT id::text, status, entry_id::text, kick_username FROM raid_turns
        WHERE game_id = $1 ORDER BY drawn_at DESC, id DESC LIMIT 1`,
      [gameId],
    );
    const turn = last[0];
    if (!turn || turn.status !== 'played') throw new RaidError('The latest hit has no recorded result to undo.');

    await client.query(
      `UPDATE raid_turns SET status = 'playing', buy_cost = NULL, payout = NULL, resolved_at = NULL WHERE id = $1`,
      [turn.id],
    );
    // If they had already !sr'd again, that newer request gives way: they are
    // back in play with the slot they were drawn with.
    if (turn.entry_id) {
      await client.query(`UPDATE raid_entries SET status = 'playing' WHERE id = $1`, [turn.entry_id]);
    }
    return turn.kick_username;
  });
}

export type RaidFinish = {
  result: 'slain' | 'stopped';
  killer: string | null;
  paid: number;
  /** The killer's Kick account is not linked, so the prize could not be paid. */
  unpaid: boolean;
  /** HP the boss had left, in hundredths, when it was stopped. */
  hpLeft: number;
};

/**
 * Ending the raid. If the boss fell, whoever landed the killing blow is paid
 * the prize, once, if their Kick account is linked — coins can only go to an
 * account. A raid stopped with the boss standing pays nobody. The payment and
 * the finished mark are one transaction under the raid's row lock, so a
 * second click is a refusal, not a second payment.
 */
export async function finishRaid(gameId: number, by: string): Promise<RaidFinish> {
  return tx(async (client) => {
    const { rows: found } = await client.query<{ boss: string; status: RaidStatus; prize: number; max_hp: number }>(
      'SELECT boss, status, prize, max_hp FROM raid_games WHERE id = $1 FOR UPDATE',
      [gameId],
    );
    const raid = found[0];
    if (!raid || raid.status !== 'running') throw new RaidError('That raid is not running.');

    const { rows: playing } = await client.query(
      `SELECT 1 FROM raid_turns WHERE game_id = $1 AND status = 'playing'`,
      [gameId],
    );
    if (playing.length > 0) throw new RaidError('Record or skip the buy in play first.');

    const { rows: played } = await client.query<{
      id: string;
      kick_username: string;
      buy_cost: string;
      payout: string;
      user_id: string | null;
    }>(
      `SELECT t.id::text, t.kick_username, t.buy_cost::text, t.payout::text, k.user_id::text
         FROM raid_turns t LEFT JOIN kick_links k ON k.kick_user_id = t.kick_user_id
        WHERE t.game_id = $1 AND t.status = 'played'
        ORDER BY t.drawn_at, t.id`,
      [gameId],
    );
    const f = fight(raid.max_hp, played.map((r) => ({ ...r, buyCost: Number(r.buy_cost), payout: Number(r.payout) })));
    const killer = f.killer;
    const result = killer ? 'slain' : 'stopped';

    let paid = 0;
    let unpaid = false;
    if (killer && raid.prize > 0) {
      if (killer.user_id) {
        await apply(client, {
          userId: Number(killer.user_id),
          delta: raid.prize,
          kind: 'giveaway',
          reason: `Boss raid killing blow — ${raid.boss}`,
          refType: 'boss_raid',
          refId: String(gameId),
        });
        await client.query(`UPDATE raid_turns SET paid = $2, paid_user_id = $3 WHERE id = $1`, [
          killer.id,
          raid.prize,
          killer.user_id,
        ]);
        paid = raid.prize;
      } else {
        unpaid = true;
      }
    }

    await client.query(
      `UPDATE raid_games SET status = 'finished', finished_at = now(), requests_open = false, result = $2 WHERE id = $1`,
      [gameId, result],
    );
    await client.query(
      `INSERT INTO audit_log (admin_name, action, target, detail) VALUES ($1, 'raid.finished', $2, $3)`,
      [
        by,
        String(gameId),
        JSON.stringify({ result, killer: killer?.kick_username ?? null, paid, unpaid, prize: raid.prize, hpLeft: hp(f.hpLeft) }),
      ],
    );

    return { result, killer: killer?.kick_username ?? null, paid, unpaid, hpLeft: f.hpLeft };
  });
}

/**
 * Deleting a raid, for test runs. A raid that paid its killing blow is kept —
 * it is the record of why those coins were paid.
 */
export async function deleteRaid(gameId: number): Promise<string> {
  return tx(async (client) => {
    const { rows: found } = await client.query<{ boss: string }>(
      'SELECT boss FROM raid_games WHERE id = $1 FOR UPDATE',
      [gameId],
    );
    if (!found[0]) throw new RaidError('That raid no longer exists.');
    const { rows: paid } = await client.query(`SELECT 1 FROM raid_turns WHERE game_id = $1 AND paid > 0`, [gameId]);
    if (paid.length > 0) throw new RaidError('This raid paid its killing blow, so it is kept as the record of that payment.');
    await client.query('DELETE FROM raid_games WHERE id = $1', [gameId]);
    return found[0].boss;
  });
}
