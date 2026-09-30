import 'server-only';
import { randomInt } from 'node:crypto';
import type { PoolClient } from 'pg';
import { one, rows, tx, write } from '@/lib/db';
import { pointsOf, pts, score, splitTeam, type Score, type Team } from '@/lib/battle';
import { apply } from './coins';
import { matchSlot } from './slots';
import { noOtherSrGame, otherSrGameMessage } from './stream-games';

/**
 * Team battle, run on this site (see migration 021 for the rules).
 *
 * The draw is made here, server-side, with a CSPRNG — never in the browser —
 * so what chat sees on stream is what the site decided. Coins move once, when
 * the battle ends, through `apply` like every other coin on the site; until
 * then a result can still be corrected.
 */

export type BattleStatus = 'running' | 'finished';
export type BattleTurnStatus = 'playing' | 'played' | 'skipped';
export type BattleEntryStatus = 'waiting' | 'playing' | 'played' | 'skipped';

export type Battle = {
  id: number;
  title: string;
  names: Record<Team, string>;
  rounds: number;
  prize: number;
  status: BattleStatus;
  requestsOpen: boolean;
  winner: Team | null;
  createdAt: string;
  finishedAt: string | null;
};

export type BattleTurn = {
  id: number;
  team: Team;
  kickUserId: string;
  kickUsername: string;
  slotName: string;
  provider: string;
  imageUrl: string | null;
  status: BattleTurnStatus;
  buyCost: number | null;
  payout: number | null;
  drawnAt: string;
  resolvedAt: string | null;
};

export type BattleEntry = {
  id: number;
  team: Team;
  kickUserId: string;
  kickUsername: string;
  query: string;
  slotName: string | null;
  provider: string | null;
  imageUrl: string | null;
  status: BattleEntryStatus;
  paid: number;
  createdAt: string;
  /** Whether this chatter has a verified Kick link — only they can be paid. */
  linked: boolean;
  /** Buys already played for this member in this battle (skips not counted). */
  turns: number;
};

type BattleRow = {
  id: string;
  title: string;
  team_a: string;
  team_b: string;
  rounds: number;
  prize: number;
  status: BattleStatus;
  requests_open: boolean;
  winner: Team | null;
  created_at: Date;
  finished_at: Date | null;
};

const BATTLE_COLUMNS = `id::text, title, team_a, team_b, rounds, prize, status, requests_open, winner, created_at, finished_at`;

function toBattle(r: BattleRow): Battle {
  return {
    id: Number(r.id),
    title: r.title,
    names: { a: r.team_a, b: r.team_b },
    rounds: r.rounds,
    prize: r.prize,
    status: r.status,
    requestsOpen: r.requests_open,
    winner: r.winner,
    createdAt: r.created_at.toISOString(),
    finishedAt: r.finished_at?.toISOString() ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Reading                                                                    */
/* -------------------------------------------------------------------------- */

/** The running battle, if there is one. `!sr` joins this one. */
export async function liveBattle(): Promise<Battle | null> {
  const row = await one<BattleRow>(`SELECT ${BATTLE_COLUMNS} FROM battle_games WHERE status = 'running' LIMIT 1`);
  return row ? toBattle(row) : null;
}

/** What the pages show: the running battle, else the last one to finish. */
export async function featuredBattle(): Promise<Battle | null> {
  const row = await one<BattleRow>(
    `SELECT ${BATTLE_COLUMNS} FROM battle_games ORDER BY (status = 'running') DESC, created_at DESC LIMIT 1`,
  );
  return row ? toBattle(row) : null;
}

/** Every buy in a battle, oldest first. */
export async function battleTurnsFor(gameId: number): Promise<BattleTurn[]> {
  const found = await rows<{
    id: string;
    team: Team;
    kick_user_id: string;
    kick_username: string;
    slot_name: string;
    provider: string;
    image_url: string | null;
    status: BattleTurnStatus;
    buy_cost: string | null;
    payout: string | null;
    drawn_at: Date;
    resolved_at: Date | null;
  }>(
    `SELECT id::text, team, kick_user_id, kick_username, slot_name, provider, image_url, status,
            buy_cost::text, payout::text, drawn_at, resolved_at
       FROM battle_turns WHERE game_id = $1 ORDER BY drawn_at, id`,
    [gameId],
  );
  return found.map((r) => ({
    id: Number(r.id),
    team: r.team,
    kickUserId: r.kick_user_id,
    kickUsername: r.kick_username,
    slotName: r.slot_name,
    provider: r.provider,
    imageUrl: r.image_url,
    status: r.status,
    buyCost: r.buy_cost == null ? null : Number(r.buy_cost),
    payout: r.payout == null ? null : Number(r.payout),
    drawnAt: r.drawn_at.toISOString(),
    resolvedAt: r.resolved_at?.toISOString() ?? null,
  }));
}

/** Every member of a battle, in the order they joined. */
export async function battleEntriesFor(gameId: number): Promise<BattleEntry[]> {
  const found = await rows<{
    id: string;
    team: Team;
    kick_user_id: string;
    kick_username: string;
    query: string;
    name: string | null;
    provider: string | null;
    image_url: string | null;
    status: BattleEntryStatus;
    paid: number;
    created_at: Date;
    linked: boolean;
    turns: number;
  }>(
    `SELECT e.id::text, e.team, e.kick_user_id, e.kick_username, e.query, s.name, s.provider, s.image_url,
            e.status, e.paid, e.created_at, (k.user_id IS NOT NULL) AS linked,
            (SELECT COUNT(*)::int FROM battle_turns t
              WHERE t.game_id = e.game_id AND t.kick_user_id = e.kick_user_id
                AND t.status = 'played') AS turns
       FROM battle_entries e
       LEFT JOIN slots s ON s.id = e.slot_id
       LEFT JOIN kick_links k ON k.kick_user_id = e.kick_user_id
      WHERE e.game_id = $1
      ORDER BY e.id ASC`,
    [gameId],
  );
  return found.map((r) => ({
    id: Number(r.id),
    team: r.team,
    kickUserId: r.kick_user_id,
    kickUsername: r.kick_username,
    query: r.query,
    slotName: r.name,
    provider: r.provider,
    imageUrl: r.image_url,
    status: r.status,
    paid: r.paid,
    createdAt: r.created_at.toISOString(),
    linked: r.linked,
    turns: r.turns,
  }));
}

export type TeamSide = {
  members: number;
  /** Members with a verified Kick link — the ones a win pays. */
  linked: number;
  waiting: number;
  /** Points by member, most first. */
  top: Array<{ kickUsername: string; points: number; buys: number }>;
};

export type BattleSummary = Score & {
  playing: BattleTurn | null;
  lastBuy: BattleTurn | null;
  sides: Record<Team, TeamSide>;
  /** Each linked winner's share of the pot, if the battle ended now. */
  share: number;
  bought: number;
  cost: number;
  won: number;
  profit: number;
};

/** Derived from the turns and members, never stored, so it cannot disagree with them. */
export function summariseBattle(battle: Battle, turns: BattleTurn[], entries: BattleEntry[]): BattleSummary {
  const played = turns.filter((t) => t.status === 'played');
  const s = score(battle.rounds, played);

  const side = (team: Team): TeamSide => {
    const members = entries.filter((e) => e.team === team);
    const by = new Map<string, { kickUsername: string; points: number; buys: number }>();
    for (const t of played.filter((p) => p.team === team)) {
      const m = by.get(t.kickUserId) ?? { kickUsername: t.kickUsername, points: 0, buys: 0 };
      m.points += pointsOf(t) ?? 0;
      m.buys++;
      by.set(t.kickUserId, m);
    }
    return {
      members: members.length,
      linked: members.filter((e) => e.linked).length,
      waiting: members.filter((e) => e.status === 'waiting').length,
      top: [...by.values()].sort((x, y) => y.points - x.points),
    };
  };
  const sides = { a: side('a'), b: side('b') };
  const leader = s.winner ?? (s.total.a === s.total.b ? null : s.total.a > s.total.b ? 'a' : 'b');
  const cost = played.reduce((sum, t) => sum + (t.buyCost ?? 0), 0);
  const won = played.reduce((sum, t) => sum + (t.payout ?? 0), 0);

  return {
    ...s,
    playing: turns.find((t) => t.status === 'playing') ?? null,
    lastBuy: played[played.length - 1] ?? null,
    sides,
    share: leader && sides[leader].linked ? Math.floor(battle.prize / sides[leader].linked) : 0,
    bought: played.length,
    cost,
    won,
    profit: won - cost,
  };
}

export type BattleHistory = Battle & { total: Record<Team, number>; bought: number; cost: number; won: number };

/** Past battles with their final score and totals, for the history table. */
export async function finishedBattles(limit = 10): Promise<BattleHistory[]> {
  const found = await rows<BattleRow>(
    `SELECT ${BATTLE_COLUMNS} FROM battle_games WHERE status = 'finished' ORDER BY finished_at DESC LIMIT $1`,
    [limit],
  );
  return Promise.all(
    found.map(async (r) => {
      const battle = toBattle(r);
      const played = (await battleTurnsFor(battle.id)).filter((t) => t.status === 'played');
      const s = score(battle.rounds, played);
      return {
        ...battle,
        total: s.total,
        bought: played.length,
        cost: played.reduce((sum, t) => sum + (t.buyCost ?? 0), 0),
        won: played.reduce((sum, t) => sum + (t.payout ?? 0), 0),
      };
    }),
  );
}

/* -------------------------------------------------------------------------- */
/* Chat                                                                       */
/* -------------------------------------------------------------------------- */

export type BattleChatOutcome =
  | { ok: true; detail: string }
  | { ok: false; reason: 'no-battle' | 'closed' | 'in-play' | 'no-slot' };

/**
 * `!sr [team] <slot>` while a battle is running. The first !sr puts the
 * viewer on a team — the one named, else the smaller one — and they stay on
 * it: naming the other team later changes nothing. A second !sr replaces a
 * waiting slot, and a member who has played (or was skipped) goes back in the
 * pool with the new slot. Only the member being played right now is left
 * alone.
 */
export async function submitBattleRequest(input: {
  kickUserId: string;
  kickUsername: string;
  query: string;
}): Promise<BattleChatOutcome> {
  const battle = await liveBattle();
  if (!battle) return { ok: false, reason: 'no-battle' };
  if (!battle.requestsOpen) return { ok: false, reason: 'closed' };

  const { team: named, slot: query } = splitTeam(input.query, battle.names);
  if (!/[a-z0-9]/i.test(query)) return { ok: false, reason: 'no-slot' };

  const slot = await matchSlot(query);
  // The smaller team, for a viewer who did not name one; A when level. Only
  // used on the insert — an existing member keeps their team.
  const smaller = await one<{ team: Team }>(
    `SELECT CASE WHEN COUNT(*) FILTER (WHERE team = 'b') < COUNT(*) FILTER (WHERE team = 'a')
                 THEN 'b' ELSE 'a' END AS team
       FROM battle_entries WHERE game_id = $1`,
    [battle.id],
  );
  const team = named ?? smaller?.team ?? 'a';

  const saved = await write<{ team: Team }>(
    `INSERT INTO battle_entries (game_id, kick_user_id, kick_username, team, query, slot_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (game_id, kick_user_id) DO UPDATE
       SET kick_username = EXCLUDED.kick_username, query = EXCLUDED.query,
           slot_id = EXCLUDED.slot_id, status = 'waiting', created_at = now()
       WHERE battle_entries.status IN ('waiting', 'played', 'skipped')
     RETURNING team`,
    [battle.id, input.kickUserId, input.kickUsername, team, query, slot?.id ?? null],
  );
  if (saved.length === 0) return { ok: false, reason: 'in-play' };
  const on = battle.names[saved[0].team];
  return { ok: true, detail: `on ${on} with ${slot ? slot.name : `"${query}" (kept as typed)`}` };
}

/* -------------------------------------------------------------------------- */
/* Staff                                                                      */
/* -------------------------------------------------------------------------- */

export class BattleError extends Error {}

/** Starting a battle. Refused while another `!sr` game runs: chat cannot say which one it meant. */
export async function createBattle(input: {
  title: string;
  teamA: string;
  teamB: string;
  rounds: number;
  prize: number;
}): Promise<void> {
  try {
    const made = await write<{ id: string }>(
      `INSERT INTO battle_games (title, team_a, team_b, rounds, prize)
       SELECT $1, $2, $3, $4, $5 WHERE ${noOtherSrGame('battle')}
       RETURNING id::text`,
      [input.title, input.teamA, input.teamB, input.rounds, input.prize],
    );
    if (made.length === 0) throw new BattleError(await otherSrGameMessage('battle'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('battle_games_one_live_idx')) {
      throw new BattleError('A team battle is already running. End it before starting another.');
    }
    throw error;
  }
}

export async function setBattleRequestsOpen(gameId: number, open: boolean): Promise<void> {
  const done = await write(
    `UPDATE battle_games SET requests_open = $2 WHERE id = $1 AND status = 'running' RETURNING id`,
    [gameId, open],
  );
  if (done.length === 0) throw new BattleError('That battle is not running.');
}

/** Takes a waiting member's slot out of the pool. They stay on their team and can !sr again. */
export async function dismissBattleEntry(entryId: number): Promise<void> {
  await write(`UPDATE battle_entries SET status = 'skipped' WHERE id = $1 AND status = 'waiting'`, [entryId]);
}

async function playedBuys(client: PoolClient, gameId: number) {
  const { rows: found } = await client.query<{ team: Team; buy_cost: string; payout: string }>(
    `SELECT team, buy_cost::text, payout::text FROM battle_turns
      WHERE game_id = $1 AND status = 'played' ORDER BY drawn_at, id`,
    [gameId],
  );
  return found.map((r) => ({ team: r.team, buyCost: Number(r.buy_cost), payout: Number(r.payout) }));
}

export type BattleDraw = { viewer: string; slot: string; team: string };

/**
 * The draw: the team whose turn it is, then a random member of it from those
 * waiting with the fewest goes. Refused while a buy is in play, and once the
 * battle is decided — the next step then is ending it.
 */
export async function drawBattler(gameId: number): Promise<BattleDraw> {
  return tx(async (client) => {
    const { rows: found } = await client.query<{ status: BattleStatus; rounds: number; team_a: string; team_b: string }>(
      'SELECT status, rounds, team_a, team_b FROM battle_games WHERE id = $1 FOR UPDATE',
      [gameId],
    );
    const battle = found[0];
    if (battle?.status !== 'running') throw new BattleError('That battle is not running.');
    const names: Record<Team, string> = { a: battle.team_a, b: battle.team_b };

    const { rows: playing } = await client.query(
      `SELECT 1 FROM battle_turns WHERE game_id = $1 AND status = 'playing'`,
      [gameId],
    );
    if (playing.length > 0) throw new BattleError('Record the result of the current buy first.');

    const s = score(battle.rounds, await playedBuys(client, gameId));
    if (!s.next) throw new BattleError(`${names[s.winner ?? 'a']} have won. End the battle to pay the team.`);
    const team = s.next;

    const { rows: pool } = await client.query<{
      id: string;
      kick_user_id: string;
      kick_username: string;
      query: string;
      slot_id: string | null;
      turns: number;
    }>(
      `SELECT e.id::text, e.kick_user_id, e.kick_username, e.query, e.slot_id::text,
              (SELECT COUNT(*)::int FROM battle_turns t
                WHERE t.game_id = e.game_id AND t.kick_user_id = e.kick_user_id
                  AND t.status = 'played') AS turns
         FROM battle_entries e WHERE e.game_id = $1 AND e.team = $2 AND e.status = 'waiting'
        ORDER BY e.id FOR UPDATE OF e`,
      [gameId, team],
    );
    if (pool.length === 0) {
      throw new BattleError(`It's ${names[team]}'s turn and nobody on ${names[team]} is waiting. Chat joins with !sr ${names[team].toLowerCase()} <slot>.`);
    }

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
      `INSERT INTO battle_turns (game_id, entry_id, team, kick_user_id, kick_username, slot_id, slot_name, provider, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [gameId, entry.id, team, entry.kick_user_id, entry.kick_username, slotId, name, provider, imageUrl],
    );
    await client.query(`UPDATE battle_entries SET status = 'playing' WHERE id = $1`, [entry.id]);

    return { viewer: entry.kick_username, slot: name, team: names[team] };
  });
}

export type BattleResult = {
  viewer: string;
  team: string;
  points: number;
  total: Record<Team, number>;
  winner: string | null;
  tiebreak: boolean;
};

/** Recording the buy: its multiplier is added to the member's team. */
export async function resolveBattleTurn(turnId: number, buyCost: number, payout: number): Promise<BattleResult> {
  return tx(async (client) => {
    const { rows: found } = await client.query<{
      game_id: string;
      entry_id: string | null;
      team: Team;
      kick_username: string;
      status: BattleTurnStatus;
      game_status: BattleStatus;
      rounds: number;
      team_a: string;
      team_b: string;
    }>(
      `SELECT t.game_id::text, t.entry_id::text, t.team, t.kick_username, t.status, g.status AS game_status,
              g.rounds, g.team_a, g.team_b
         FROM battle_turns t JOIN battle_games g ON g.id = t.game_id
        WHERE t.id = $1 FOR UPDATE OF t, g`,
      [turnId],
    );
    const turn = found[0];
    if (!turn || turn.game_status !== 'running') throw new BattleError('That battle is not running.');
    if (turn.status !== 'playing') throw new BattleError('That buy already has a result.');
    const names: Record<Team, string> = { a: turn.team_a, b: turn.team_b };

    await client.query(
      `UPDATE battle_turns SET status = 'played', buy_cost = $2, payout = $3, resolved_at = now() WHERE id = $1`,
      [turnId, buyCost, payout],
    );
    if (turn.entry_id) {
      await client.query(`UPDATE battle_entries SET status = 'played' WHERE id = $1`, [turn.entry_id]);
    }

    const s = score(turn.rounds, await playedBuys(client, Number(turn.game_id)));
    return {
      viewer: turn.kick_username,
      team: names[turn.team],
      points: pointsOf({ buyCost, payout }) ?? 0,
      total: s.total,
      winner: s.winner ? names[s.winner] : null,
      tiebreak: s.tiebreak,
    };
  });
}

/**
 * The drawn member's slot cannot be played (not at the casino, no bonus buy).
 * The score is untouched, it is still their team's turn, and they can !sr
 * something else.
 */
export async function skipBattleTurn(turnId: number): Promise<void> {
  await tx(async (client) => {
    const { rows: done } = await client.query<{ entry_id: string | null }>(
      `UPDATE battle_turns t SET status = 'skipped', resolved_at = now()
         FROM battle_games g
        WHERE t.id = $1 AND g.id = t.game_id AND t.status = 'playing' AND g.status = 'running'
        RETURNING t.entry_id::text`,
      [turnId],
    );
    if (done.length === 0) throw new BattleError('That buy is not in play.');
    if (done[0].entry_id) {
      await client.query(`UPDATE battle_entries SET status = 'skipped' WHERE id = $1`, [done[0].entry_id]);
    }
  });
}

/**
 * Correcting a mistyped result: the latest buy goes back to being in play, so
 * it can be recorded again — even the one that decided the battle. Only while
 * the battle runs — nothing has been paid yet — and only the latest, so later
 * buys never rest on it.
 */
export async function undoLastBattleTurn(gameId: number): Promise<string> {
  return tx(async (client) => {
    const { rows: found } = await client.query<{ status: BattleStatus }>(
      'SELECT status FROM battle_games WHERE id = $1 FOR UPDATE',
      [gameId],
    );
    if (found[0]?.status !== 'running') throw new BattleError('That battle is not running.');

    const { rows: last } = await client.query<{ id: string; status: BattleTurnStatus; entry_id: string | null; kick_username: string }>(
      `SELECT id::text, status, entry_id::text, kick_username FROM battle_turns
        WHERE game_id = $1 ORDER BY drawn_at DESC, id DESC LIMIT 1`,
      [gameId],
    );
    const turn = last[0];
    if (!turn || turn.status !== 'played') throw new BattleError('The latest buy has no recorded result to undo.');

    await client.query(
      `UPDATE battle_turns SET status = 'playing', buy_cost = NULL, payout = NULL, resolved_at = NULL WHERE id = $1`,
      [turn.id],
    );
    // If they had already !sr'd again, that newer request gives way: they are
    // back in play with the slot they were drawn with.
    if (turn.entry_id) {
      await client.query(`UPDATE battle_entries SET status = 'playing' WHERE id = $1`, [turn.entry_id]);
    }
    return turn.kick_username;
  });
}

export type BattleFinish = {
  winner: string | null;
  total: Record<Team, number>;
  share: number;
  paidMembers: number;
  unpaid: string[];
};

/**
 * Ending the battle. Once it is decided, the pot is split evenly across the
 * winning team's members with a linked Kick account — coins can only go to
 * an account — rounded down to whole coins. A battle ended before it is
 * decided pays nobody. The payments and the finished mark are one
 * transaction under the battle's row lock, so a second click is a refusal,
 * not a second payment.
 */
export async function finishBattle(gameId: number, by: string): Promise<BattleFinish> {
  return tx(async (client) => {
    const { rows: found } = await client.query<{
      title: string;
      status: BattleStatus;
      prize: number;
      rounds: number;
      team_a: string;
      team_b: string;
    }>('SELECT title, status, prize, rounds, team_a, team_b FROM battle_games WHERE id = $1 FOR UPDATE', [gameId]);
    const battle = found[0];
    if (!battle || battle.status !== 'running') throw new BattleError('That battle is not running.');
    const names: Record<Team, string> = { a: battle.team_a, b: battle.team_b };

    const { rows: playing } = await client.query(
      `SELECT 1 FROM battle_turns WHERE game_id = $1 AND status = 'playing'`,
      [gameId],
    );
    if (playing.length > 0) throw new BattleError('Record or skip the buy in play first.');

    const s = score(battle.rounds, await playedBuys(client, gameId));

    let share = 0;
    let paidMembers = 0;
    const unpaid: string[] = [];
    if (s.winner && battle.prize > 0) {
      const { rows: members } = await client.query<{ id: string; kick_username: string; user_id: string | null }>(
        `SELECT e.id::text, e.kick_username, k.user_id::text
           FROM battle_entries e LEFT JOIN kick_links k ON k.kick_user_id = e.kick_user_id
          WHERE e.game_id = $1 AND e.team = $2
          ORDER BY e.id`,
        [gameId, s.winner],
      );
      const linked = members.filter((m) => m.user_id);
      unpaid.push(...members.filter((m) => !m.user_id).map((m) => m.kick_username));
      share = linked.length ? Math.floor(battle.prize / linked.length) : 0;
      if (share > 0) {
        for (const m of linked) {
          await apply(client, {
            userId: Number(m.user_id),
            delta: share,
            kind: 'giveaway',
            reason: `Team battle win (${names[s.winner]}) — ${battle.title}`,
            refType: 'team_battle',
            refId: `${gameId}:${m.id}`,
          });
          await client.query(`UPDATE battle_entries SET paid = $2, paid_user_id = $3 WHERE id = $1`, [
            m.id,
            share,
            m.user_id,
          ]);
          paidMembers++;
        }
      }
    }

    await client.query(
      `UPDATE battle_games SET status = 'finished', finished_at = now(), requests_open = false, winner = $2 WHERE id = $1`,
      [gameId, s.winner],
    );
    await client.query(
      `INSERT INTO audit_log (admin_name, action, target, detail) VALUES ($1, 'battle.finished', $2, $3)`,
      [
        by,
        String(gameId),
        JSON.stringify({
          winner: s.winner ? names[s.winner] : null,
          score: `${pts(s.total.a)}–${pts(s.total.b)}`,
          share,
          paidMembers,
          unpaid,
          prize: battle.prize,
        }),
      ],
    );

    return { winner: s.winner ? names[s.winner] : null, total: s.total, share, paidMembers, unpaid };
  });
}

/**
 * Deleting a battle, for test runs. A battle that paid its winners is kept —
 * it is the record of why those coins were paid.
 */
export async function deleteBattle(gameId: number): Promise<string> {
  return tx(async (client) => {
    const { rows: found } = await client.query<{ title: string }>(
      'SELECT title FROM battle_games WHERE id = $1 FOR UPDATE',
      [gameId],
    );
    if (!found[0]) throw new BattleError('That battle no longer exists.');
    const { rows: paid } = await client.query(`SELECT 1 FROM battle_entries WHERE game_id = $1 AND paid > 0`, [gameId]);
    if (paid.length > 0) throw new BattleError('This battle paid its winners, so it is kept as the record of that payment.');
    await client.query('DELETE FROM battle_games WHERE id = $1', [gameId]);
    return found[0].title;
  });
}
