import 'server-only';
import { randomInt } from 'node:crypto';
import type { PoolClient } from 'pg';
import { one, rows, tx, write } from '@/lib/db';
import {
  bracketSize,
  firstRound,
  matchState,
  roundName,
  roundsFor,
  scoreOf,
  type MatchState,
  type Side,
} from '@/lib/tourney';
import { apply } from './coins';
import { matchSlot } from './slots';
import { noOtherSrGame, otherSrGameMessage } from './stream-games';

/**
 * The slot tournament, run on this site (see migration 022 for the rules).
 *
 * Seeding is shuffled here, server-side, with a CSPRNG — never in the browser
 * — so the bracket chat sees on stream is the one the site drew. Coins move
 * once, when the tournament ends, through `apply` like every other coin on the
 * site; until then a result can still be corrected.
 */

export type TourneyStatus = 'signup' | 'running' | 'finished';
export type TourneyTurnStatus = 'playing' | 'played' | 'skipped';

export type Tourney = {
  id: number;
  title: string;
  size: number;
  prize: number;
  status: TourneyStatus;
  requestsOpen: boolean;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type TourneyEntry = {
  id: number;
  kickUserId: string;
  kickUsername: string;
  query: string;
  slotName: string | null;
  provider: string | null;
  imageUrl: string | null;
  seeded: boolean;
  paid: number;
  /** Whether this chatter has a verified Kick link — only they can be paid. */
  linked: boolean;
  createdAt: string;
};

export type TourneyMatch = {
  id: number;
  round: number;
  position: number;
  a: number | null;
  b: number | null;
  bye: boolean;
  winner: number | null;
  decidedBy: 'played' | 'bye' | 'forfeit' | null;
};

export type TourneyTurn = {
  id: number;
  matchId: number;
  entryId: number | null;
  side: Side;
  kickUsername: string;
  slotName: string;
  provider: string;
  imageUrl: string | null;
  status: TourneyTurnStatus;
  buyCost: number | null;
  payout: number | null;
  drawnAt: string;
};

type GameRow = {
  id: string;
  title: string;
  size: number;
  prize: number;
  status: TourneyStatus;
  requests_open: boolean;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
};

const GAME_COLUMNS = `id::text, title, size, prize, status, requests_open, created_at, started_at, finished_at`;

function toTourney(r: GameRow): Tourney {
  return {
    id: Number(r.id),
    title: r.title,
    size: r.size,
    prize: r.prize,
    status: r.status,
    requestsOpen: r.requests_open,
    createdAt: r.created_at.toISOString(),
    startedAt: r.started_at?.toISOString() ?? null,
    finishedAt: r.finished_at?.toISOString() ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Reading                                                                    */
/* -------------------------------------------------------------------------- */

/** The tournament taking sign-ups or being played, if there is one. `!sr` goes to it. */
export async function liveTourney(): Promise<Tourney | null> {
  const row = await one<GameRow>(`SELECT ${GAME_COLUMNS} FROM tourney_games WHERE status <> 'finished' LIMIT 1`);
  return row ? toTourney(row) : null;
}

/** What the pages show: the live tournament, else the last one to finish. */
export async function featuredTourney(): Promise<Tourney | null> {
  const row = await one<GameRow>(
    `SELECT ${GAME_COLUMNS} FROM tourney_games ORDER BY (status <> 'finished') DESC, created_at DESC LIMIT 1`,
  );
  return row ? toTourney(row) : null;
}

/** Everyone who signed up, in the order they did. */
export async function tourneyEntriesFor(gameId: number): Promise<TourneyEntry[]> {
  const found = await rows<{
    id: string;
    kick_user_id: string;
    kick_username: string;
    query: string;
    name: string | null;
    provider: string | null;
    image_url: string | null;
    seeded: boolean;
    paid: number;
    linked: boolean;
    created_at: Date;
  }>(
    `SELECT e.id::text, e.kick_user_id, e.kick_username, e.query, s.name, s.provider, s.image_url,
            e.seeded, e.paid, (k.user_id IS NOT NULL) AS linked, e.created_at
       FROM tourney_entries e
       LEFT JOIN slots s ON s.id = e.slot_id
       LEFT JOIN kick_links k ON k.kick_user_id = e.kick_user_id
      WHERE e.game_id = $1
      ORDER BY e.id`,
    [gameId],
  );
  return found.map((r) => ({
    id: Number(r.id),
    kickUserId: r.kick_user_id,
    kickUsername: r.kick_username,
    query: r.query,
    slotName: r.name,
    provider: r.provider,
    imageUrl: r.image_url,
    seeded: r.seeded,
    paid: r.paid,
    linked: r.linked,
    createdAt: r.created_at.toISOString(),
  }));
}

/** The bracket, round by round. */
export async function tourneyMatchesFor(gameId: number): Promise<TourneyMatch[]> {
  const found = await rows<{
    id: string;
    round: number;
    position: number;
    a_entry_id: string | null;
    b_entry_id: string | null;
    bye: boolean;
    winner_entry_id: string | null;
    decided_by: TourneyMatch['decidedBy'];
  }>(
    `SELECT id::text, round, position, a_entry_id::text, b_entry_id::text, bye, winner_entry_id::text, decided_by
       FROM tourney_matches WHERE game_id = $1 ORDER BY round, position`,
    [gameId],
  );
  const n = (v: string | null) => (v == null ? null : Number(v));
  return found.map((r) => ({
    id: Number(r.id),
    round: r.round,
    position: r.position,
    a: n(r.a_entry_id),
    b: n(r.b_entry_id),
    bye: r.bye,
    winner: n(r.winner_entry_id),
    decidedBy: r.decided_by,
  }));
}

/** Every buy, oldest first. */
export async function tourneyTurnsFor(gameId: number): Promise<TourneyTurn[]> {
  const found = await rows<{
    id: string;
    match_id: string;
    entry_id: string | null;
    side: Side;
    kick_username: string;
    slot_name: string;
    provider: string;
    image_url: string | null;
    status: TourneyTurnStatus;
    buy_cost: string | null;
    payout: string | null;
    drawn_at: Date;
  }>(
    `SELECT id::text, match_id::text, entry_id::text, side, kick_username, slot_name, provider, image_url,
            status, buy_cost::text, payout::text, drawn_at
       FROM tourney_turns WHERE game_id = $1 ORDER BY drawn_at, id`,
    [gameId],
  );
  return found.map((r) => ({
    id: Number(r.id),
    matchId: Number(r.match_id),
    entryId: r.entry_id == null ? null : Number(r.entry_id),
    side: r.side,
    kickUsername: r.kick_username,
    slotName: r.slot_name,
    provider: r.provider,
    imageUrl: r.image_url,
    status: r.status,
    buyCost: r.buy_cost == null ? null : Number(r.buy_cost),
    payout: r.payout == null ? null : Number(r.payout),
    drawnAt: r.drawn_at.toISOString(),
  }));
}

export type PlayerView = {
  entryId: number;
  kickUsername: string;
  /** The slot they are playing, or the one they last played in this match. */
  slotName: string;
  imageUrl: string | null;
};

export type MatchView = {
  id: number;
  round: number;
  position: number;
  a: PlayerView | null;
  b: PlayerView | null;
  bye: boolean;
  winner: Side | null;
  decidedBy: TourneyMatch['decidedBy'];
  state: MatchState;
  /** The match being played now, or next to be. */
  current: boolean;
};

export type TourneySummary = {
  rounds: number;
  bracket: Array<{ round: number; name: string; matches: MatchView[] }>;
  current: MatchView | null;
  playing: TourneyTurn | null;
  champion: PlayerView | null;
  runnerUp: PlayerView | null;
  /** Players still in, by entry id. */
  alive: Set<number>;
  bought: number;
  cost: number;
  won: number;
  profit: number;
};

/** Derived from the matches and turns, so the pages never disagree with the store. */
export function summariseTourney(
  t: Tourney,
  entries: TourneyEntry[],
  matches: TourneyMatch[],
  turns: TourneyTurn[],
): TourneySummary {
  const rounds = roundsFor(t.size);
  const byId = new Map(entries.map((e) => [e.id, e]));
  const player = (entryId: number | null, matchId: number): PlayerView | null => {
    if (entryId == null) return null;
    const e = byId.get(entryId);
    const last = [...turns].reverse().find((u) => u.matchId === matchId && u.entryId === entryId);
    return {
      entryId,
      kickUsername: e?.kickUsername ?? last?.kickUsername ?? '?',
      slotName: last?.slotName ?? e?.slotName ?? e?.query ?? '',
      imageUrl: last ? last.imageUrl : (e?.imageUrl ?? null),
    };
  };

  const current = t.status === 'running' ? matches.find((m) => m.winner == null && m.a != null && m.b != null) : undefined;
  const views: MatchView[] = matches.map((m) => {
    const played = turns.filter((u) => u.matchId === m.id && u.status === 'played');
    return {
      id: m.id,
      round: m.round,
      position: m.position,
      a: player(m.a, m.id),
      b: player(m.b, m.id),
      bye: m.bye,
      winner: m.winner == null ? null : m.winner === m.a ? 'a' : 'b',
      decidedBy: m.decidedBy,
      state: matchState(played),
      current: m.id === current?.id,
    };
  });

  const final = views.find((v) => v.round === rounds);
  const champion = final?.winner ? final[final.winner] : null;
  const runnerUp = final?.winner ? final[final.winner === 'a' ? 'b' : 'a'] : null;
  const losers = new Set(
    matches.filter((m) => m.winner != null).flatMap((m) => [m.a, m.b].filter((p): p is number => p != null && p !== m.winner)),
  );
  const alive = new Set(entries.filter((e) => e.seeded && !losers.has(e.id)).map((e) => e.id));
  const played = turns.filter((u) => u.status === 'played');
  const cost = played.reduce((sum, u) => sum + (u.buyCost ?? 0), 0);
  const won = played.reduce((sum, u) => sum + (u.payout ?? 0), 0);

  return {
    rounds,
    bracket: [...Array(rounds).keys()].map((i) => ({
      round: i + 1,
      name: roundName(i + 1, rounds),
      matches: views.filter((v) => v.round === i + 1),
    })),
    current: views.find((v) => v.current) ?? null,
    playing: turns.find((u) => u.status === 'playing') ?? null,
    champion,
    runnerUp,
    alive,
    bought: played.length,
    cost,
    won,
    profit: won - cost,
  };
}

export type TourneyHistory = Tourney & { champion: string | null; players: number; bought: number; cost: number; won: number };

/** Past tournaments with their champion and totals, for the history table. */
export async function finishedTourneys(limit = 10): Promise<TourneyHistory[]> {
  const found = await rows<GameRow>(
    `SELECT ${GAME_COLUMNS} FROM tourney_games WHERE status = 'finished' ORDER BY finished_at DESC LIMIT $1`,
    [limit],
  );
  return Promise.all(
    found.map(async (r) => {
      const t = toTourney(r);
      const [entries, matches, turns] = await Promise.all([
        tourneyEntriesFor(t.id),
        tourneyMatchesFor(t.id),
        tourneyTurnsFor(t.id),
      ]);
      const s = summariseTourney(t, entries, matches, turns);
      return {
        ...t,
        champion: s.champion?.kickUsername ?? null,
        players: entries.filter((e) => e.seeded).length,
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

export type TourneyChatOutcome =
  | { ok: true; detail: string }
  | { ok: false; reason: 'no-tourney' | 'closed' | 'not-in' | 'in-play' };

/**
 * `!sr <slot>` while a tournament is live. During sign-ups it enters the
 * viewer, or changes the slot they entered with. Once the bracket is seeded
 * only a player still in can !sr — to change the slot they will play next —
 * and not while their buy is being played.
 */
export async function submitTourneyRequest(input: {
  kickUserId: string;
  kickUsername: string;
  query: string;
}): Promise<TourneyChatOutcome> {
  const t = await liveTourney();
  if (!t) return { ok: false, reason: 'no-tourney' };
  if (!t.requestsOpen) return { ok: false, reason: 'closed' };
  const slot = await matchSlot(input.query);
  const named = slot ? slot.name : `"${input.query}" (kept as typed)`;

  if (t.status === 'signup') {
    await write(
      `INSERT INTO tourney_entries (game_id, kick_user_id, kick_username, query, slot_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (game_id, kick_user_id) DO UPDATE
         SET kick_username = EXCLUDED.kick_username, query = EXCLUDED.query, slot_id = EXCLUDED.slot_id
       RETURNING id`,
      [t.id, input.kickUserId, input.kickUsername, input.query, slot?.id ?? null],
    );
    return { ok: true, detail: `signed up for the tournament with ${named}` };
  }

  // Running: a player still in, not being played right now, changes their slot.
  const done = await write(
    `UPDATE tourney_entries e SET query = $3, slot_id = $4, kick_username = $5
      WHERE e.game_id = $1 AND e.kick_user_id = $2 AND e.seeded
        AND NOT EXISTS (SELECT 1 FROM tourney_matches m
                         WHERE m.game_id = e.game_id AND m.winner_entry_id IS NOT NULL
                           AND (m.a_entry_id = e.id OR m.b_entry_id = e.id) AND m.winner_entry_id <> e.id)
        AND NOT EXISTS (SELECT 1 FROM tourney_turns u WHERE u.entry_id = e.id AND u.status = 'playing')
      RETURNING e.id`,
    [t.id, input.kickUserId, input.query, slot?.id ?? null, input.kickUsername],
  );
  if (done.length > 0) return { ok: true, detail: `will play ${named} next` };
  const entry = await one<{ id: string }>(
    `SELECT id::text FROM tourney_entries e
      WHERE game_id = $1 AND kick_user_id = $2
        AND EXISTS (SELECT 1 FROM tourney_turns u WHERE u.entry_id = e.id AND u.status = 'playing')`,
    [t.id, input.kickUserId],
  );
  return { ok: false, reason: entry ? 'in-play' : 'not-in' };
}

/* -------------------------------------------------------------------------- */
/* Staff                                                                      */
/* -------------------------------------------------------------------------- */

export class TourneyError extends Error {}

/** Opening sign-ups. Refused while another `!sr` game is live: chat cannot say which one it meant. */
export async function createTourney(input: { title: string; size: number; prize: number }): Promise<void> {
  try {
    const made = await write<{ id: string }>(
      `INSERT INTO tourney_games (title, size, prize)
       SELECT $1, $2, $3 WHERE ${noOtherSrGame('tourney')}
       RETURNING id::text`,
      [input.title, input.size, input.prize],
    );
    if (made.length === 0) throw new TourneyError(await otherSrGameMessage('tourney'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('tourney_games_one_live_idx')) {
      throw new TourneyError('A tournament is already live. End it before starting another.');
    }
    throw error;
  }
}

export async function setTourneyRequestsOpen(gameId: number, open: boolean): Promise<void> {
  const done = await write(
    `UPDATE tourney_games SET requests_open = $2 WHERE id = $1 AND status <> 'finished' RETURNING id`,
    [gameId, open],
  );
  if (done.length === 0) throw new TourneyError('That tournament is not live.');
}

/** Removes a sign-up before seeding. After that the bracket is set; use Forfeit. */
export async function removeSignup(entryId: number): Promise<void> {
  const done = await write(
    `DELETE FROM tourney_entries e USING tourney_games g
      WHERE e.id = $1 AND g.id = e.game_id AND g.status = 'signup'
      RETURNING e.id`,
    [entryId],
  );
  if (done.length === 0) throw new TourneyError('Sign-ups are closed; the bracket is already seeded.');
}

/** Puts a match's winner into their place in the next round. */
async function advance(client: PoolClient, gameId: number, round: number, position: number, winner: string, rounds: number) {
  if (round >= rounds) return;
  const column = position % 2 === 0 ? 'a_entry_id' : 'b_entry_id';
  await client.query(
    `UPDATE tourney_matches SET ${column} = $4 WHERE game_id = $1 AND round = $2 AND position = $3`,
    [gameId, round + 1, Math.floor(position / 2), winner],
  );
}

export type Seeding = { players: number; size: number; left: number; byes: number };

/**
 * Seeding the bracket: shuffle the sign-ups, take as many as there are
 * places, shrink the bracket to fit if fewer signed up, and lay out every
 * round's matches. Byes are decided at once and go straight through.
 */
export async function seedBracket(gameId: number): Promise<Seeding> {
  return tx(async (client) => {
    const { rows: found } = await client.query<{ status: TourneyStatus; size: number }>(
      'SELECT status, size FROM tourney_games WHERE id = $1 FOR UPDATE',
      [gameId],
    );
    const t = found[0];
    if (t?.status !== 'signup') throw new TourneyError('That tournament is not taking sign-ups.');

    const { rows: signups } = await client.query<{ id: string }>(
      'SELECT id::text FROM tourney_entries WHERE game_id = $1 ORDER BY id',
      [gameId],
    );
    if (signups.length < 2) throw new TourneyError('A tournament needs at least 2 players. Chat signs up with !sr <slot>.');

    // Fisher–Yates with a CSPRNG: every order equally likely.
    const ids = signups.map((s) => s.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const players = ids.slice(0, t.size);
    const size = bracketSize(players.length, t.size);
    const rounds = roundsFor(size);

    await client.query('UPDATE tourney_entries SET seeded = true WHERE id = ANY($1::bigint[])', [players]);
    for (let r = 1; r <= rounds; r++) {
      const count = size / 2 ** r;
      for (let p = 0; p < count; p++) {
        await client.query('INSERT INTO tourney_matches (game_id, round, position) VALUES ($1, $2, $3)', [gameId, r, p]);
      }
    }
    const pairs = firstRound(players, size);
    let byes = 0;
    for (const [p, [a, b]] of pairs.entries()) {
      if (b == null) {
        byes++;
        await client.query(
          `UPDATE tourney_matches SET a_entry_id = $3, bye = true, winner_entry_id = $3, decided_by = 'bye', decided_at = now()
            WHERE game_id = $1 AND round = 1 AND position = $2`,
          [gameId, p, a],
        );
        await advance(client, gameId, 1, p, a, rounds);
      } else {
        await client.query(
          'UPDATE tourney_matches SET a_entry_id = $3, b_entry_id = $4 WHERE game_id = $1 AND round = 1 AND position = $2',
          [gameId, p, a, b],
        );
      }
    }
    await client.query(`UPDATE tourney_games SET status = 'running', size = $2, started_at = now() WHERE id = $1`, [
      gameId,
      size,
    ]);
    return { players: players.length, size, left: signups.length - players.length, byes };
  });
}

type CurrentMatch = { id: string; round: number; position: number; a_entry_id: string; b_entry_id: string };

async function currentMatch(client: PoolClient, gameId: number): Promise<CurrentMatch | null> {
  const { rows: found } = await client.query<CurrentMatch>(
    `SELECT id::text, round, position, a_entry_id::text, b_entry_id::text FROM tourney_matches
      WHERE game_id = $1 AND winner_entry_id IS NULL AND a_entry_id IS NOT NULL AND b_entry_id IS NOT NULL
      ORDER BY round, position LIMIT 1 FOR UPDATE`,
    [gameId],
  );
  return found[0] ?? null;
}

async function matchBuys(client: PoolClient, matchId: string) {
  const { rows: found } = await client.query<{ side: Side; buy_cost: string; payout: string }>(
    `SELECT side, buy_cost::text, payout::text FROM tourney_turns
      WHERE match_id = $1 AND status = 'played' ORDER BY drawn_at, id`,
    [matchId],
  );
  return found.map((r) => ({ side: r.side, buyCost: Number(r.buy_cost), payout: Number(r.payout) }));
}

async function lockRunning(client: PoolClient, gameId: number): Promise<{ size: number; rounds: number }> {
  const { rows: found } = await client.query<{ status: TourneyStatus; size: number }>(
    'SELECT status, size FROM tourney_games WHERE id = $1 FOR UPDATE',
    [gameId],
  );
  if (found[0]?.status !== 'running') throw new TourneyError('That tournament is not being played.');
  return { size: found[0].size, rounds: roundsFor(found[0].size) };
}

export type TourneyBuy = { viewer: string; opponent: string; slot: string; round: string };

/**
 * The next buy: in the current match — the first undecided one with both
 * players — the side whose turn it is (A, then B, then both again on a tie),
 * with the slot that player has now.
 */
export async function startTourneyBuy(gameId: number): Promise<TourneyBuy> {
  return tx(async (client) => {
    const { rounds } = await lockRunning(client, gameId);
    const { rows: playing } = await client.query(
      `SELECT 1 FROM tourney_turns WHERE game_id = $1 AND status = 'playing'`,
      [gameId],
    );
    if (playing.length > 0) throw new TourneyError('Record the result of the current buy first.');

    const match = await currentMatch(client, gameId);
    if (!match) throw new TourneyError('The final is decided. End the tournament to crown the champion.');
    const side = matchState(await matchBuys(client, match.id)).next ?? 'a';
    const entryId = side === 'a' ? match.a_entry_id : match.b_entry_id;
    const otherId = side === 'a' ? match.b_entry_id : match.a_entry_id;

    const { rows: people } = await client.query<{ id: string; kick_username: string; query: string; slot_id: string | null }>(
      'SELECT id::text, kick_username, query, slot_id::text FROM tourney_entries WHERE id = ANY($1::bigint[])',
      [[entryId, otherId]],
    );
    const entry = people.find((p) => p.id === entryId)!;
    const other = people.find((p) => p.id === otherId);

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
      `INSERT INTO tourney_turns (game_id, match_id, entry_id, side, kick_username, slot_id, slot_name, provider, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [gameId, match.id, entryId, side, entry.kick_username, slotId, name, provider, imageUrl],
    );
    return { viewer: entry.kick_username, opponent: other?.kick_username ?? '?', slot: name, round: roundName(match.round, rounds) };
  });
}

export type TourneyResult = {
  viewer: string;
  score: number;
  /** Who won the match, if this buy decided it. */
  winner: string | null;
  tied: boolean;
  /** This buy decided the final. */
  champion: boolean;
};

/** Recording a buy. If it decides the match, the winner goes through. */
export async function resolveTourneyTurn(turnId: number, buyCost: number, payout: number): Promise<TourneyResult> {
  return tx(async (client) => {
    const { rows: found } = await client.query<{ game_id: string; match_id: string; kick_username: string; status: TourneyTurnStatus }>(
      'SELECT game_id::text, match_id::text, kick_username, status FROM tourney_turns WHERE id = $1 FOR UPDATE',
      [turnId],
    );
    const turn = found[0];
    if (!turn) throw new TourneyError('That buy no longer exists.');
    const gameId = Number(turn.game_id);
    const { rounds } = await lockRunning(client, gameId);
    if (turn.status !== 'playing') throw new TourneyError('That buy already has a result.');

    await client.query(
      `UPDATE tourney_turns SET status = 'played', buy_cost = $2, payout = $3, resolved_at = now() WHERE id = $1`,
      [turnId, buyCost, payout],
    );

    const state = matchState(await matchBuys(client, turn.match_id));
    let winner: string | null = null;
    let champion = false;
    if (state.winner) {
      const { rows: m } = await client.query<{ round: number; position: number; winner: string; name: string }>(
        `UPDATE tourney_matches m SET winner_entry_id = CASE WHEN $2 = 'a' THEN a_entry_id ELSE b_entry_id END,
                decided_by = 'played', decided_at = now()
          WHERE m.id = $1
        RETURNING m.round, m.position, m.winner_entry_id::text AS winner,
                  (SELECT kick_username FROM tourney_entries WHERE id = m.winner_entry_id) AS name`,
        [turn.match_id, state.winner],
      );
      await advance(client, gameId, m[0].round, m[0].position, m[0].winner, rounds);
      winner = m[0].name;
      champion = m[0].round === rounds;
    }
    return { viewer: turn.kick_username, score: scoreOf({ buyCost, payout }) ?? 0, winner, tied: state.tied, champion };
  });
}

/**
 * The player's slot cannot be played (not at the casino, no bonus buy). The
 * match is untouched and it is still their turn: they can !sr something
 * else, or staff can forfeit them.
 */
export async function skipTourneyTurn(turnId: number): Promise<void> {
  const done = await write(
    `UPDATE tourney_turns t SET status = 'skipped', resolved_at = now()
       FROM tourney_games g
      WHERE t.id = $1 AND g.id = t.game_id AND t.status = 'playing' AND g.status = 'running'
      RETURNING t.id`,
    [turnId],
  );
  if (done.length === 0) throw new TourneyError('That buy is not in play.');
}

/** A player who cannot play forfeits the current match, and their opponent goes through. */
export async function forfeitCurrent(gameId: number, loser: Side): Promise<{ loser: string; winner: string }> {
  return tx(async (client) => {
    const { rounds } = await lockRunning(client, gameId);
    const { rows: playing } = await client.query(
      `SELECT 1 FROM tourney_turns WHERE game_id = $1 AND status = 'playing'`,
      [gameId],
    );
    if (playing.length > 0) throw new TourneyError('Record or skip the buy in play first.');
    const match = await currentMatch(client, gameId);
    if (!match) throw new TourneyError('There is no match being played.');
    const winnerId = loser === 'a' ? match.b_entry_id : match.a_entry_id;
    const loserId = loser === 'a' ? match.a_entry_id : match.b_entry_id;
    await client.query(
      `UPDATE tourney_matches SET winner_entry_id = $2, decided_by = 'forfeit', decided_at = now() WHERE id = $1`,
      [match.id, winnerId],
    );
    await advance(client, gameId, match.round, match.position, winnerId, rounds);
    const { rows: names } = await client.query<{ id: string; kick_username: string }>(
      'SELECT id::text, kick_username FROM tourney_entries WHERE id = ANY($1::bigint[])',
      [[winnerId, loserId]],
    );
    const name = (id: string) => names.find((n) => n.id === id)?.kick_username ?? '?';
    return { loser: name(loserId), winner: name(winnerId) };
  });
}

/**
 * Correcting a mistyped result: the latest buy goes back to being in play, so
 * it can be recorded again. If it decided its match, the match reopens and
 * the winner comes back out of the next round. Only the latest buy, and only
 * if nothing was decided after it (a forfeit), so nothing later rests on it.
 */
export async function undoLastTourneyTurn(gameId: number): Promise<string> {
  return tx(async (client) => {
    const { rounds } = await lockRunning(client, gameId);
    const { rows: last } = await client.query<{ id: string; status: TourneyTurnStatus; match_id: string; kick_username: string; resolved_at: Date | null }>(
      `SELECT id::text, status, match_id::text, kick_username, resolved_at FROM tourney_turns
        WHERE game_id = $1 ORDER BY drawn_at DESC, id DESC LIMIT 1`,
      [gameId],
    );
    const turn = last[0];
    if (!turn || turn.status !== 'played') throw new TourneyError('The latest buy has no recorded result to undo.');

    const { rows: later } = await client.query(
      `SELECT 1 FROM tourney_matches WHERE game_id = $1 AND decided_by = 'forfeit' AND decided_at > $2`,
      [gameId, turn.resolved_at],
    );
    if (later.length > 0) throw new TourneyError('A match was forfeited after that buy, so it can no longer be undone.');

    const { rows: m } = await client.query<{ round: number; position: number; winner: string | null }>(
      'SELECT round, position, winner_entry_id::text AS winner FROM tourney_matches WHERE id = $1 FOR UPDATE',
      [turn.match_id],
    );
    if (m[0]?.winner) {
      await client.query(
        `UPDATE tourney_matches SET winner_entry_id = NULL, decided_by = NULL, decided_at = NULL WHERE id = $1`,
        [turn.match_id],
      );
      if (m[0].round < rounds) {
        const column = m[0].position % 2 === 0 ? 'a_entry_id' : 'b_entry_id';
        await client.query(
          `UPDATE tourney_matches SET ${column} = NULL WHERE game_id = $1 AND round = $2 AND position = $3`,
          [gameId, m[0].round + 1, Math.floor(m[0].position / 2)],
        );
      }
    }
    await client.query(
      `UPDATE tourney_turns SET status = 'playing', buy_cost = NULL, payout = NULL, resolved_at = NULL WHERE id = $1`,
      [turn.id],
    );
    return turn.kick_username;
  });
}

export type TourneyFinish = { champion: string | null; paid: number; unpaid: boolean };

/**
 * Ending the tournament. Once the final is decided, the champion is paid the
 * prize, once, if their Kick account is linked — coins can only go to an
 * account. A tournament ended before that pays nobody. The payment and the
 * finished mark are one transaction under the tournament's row lock, so a
 * second click is a refusal, not a second payment.
 */
export async function finishTourney(gameId: number, by: string): Promise<TourneyFinish> {
  return tx(async (client) => {
    const { rows: found } = await client.query<{ title: string; status: TourneyStatus; prize: number; size: number }>(
      'SELECT title, status, prize, size FROM tourney_games WHERE id = $1 FOR UPDATE',
      [gameId],
    );
    const t = found[0];
    if (!t || t.status === 'finished') throw new TourneyError('That tournament is not live.');
    const { rows: playing } = await client.query(
      `SELECT 1 FROM tourney_turns WHERE game_id = $1 AND status = 'playing'`,
      [gameId],
    );
    if (playing.length > 0) throw new TourneyError('Record or skip the buy in play first.');

    const { rows: final } = await client.query<{ entry_id: string; kick_username: string; user_id: string | null }>(
      `SELECT e.id::text AS entry_id, e.kick_username, k.user_id::text
         FROM tourney_matches m
         JOIN tourney_entries e ON e.id = m.winner_entry_id
         LEFT JOIN kick_links k ON k.kick_user_id = e.kick_user_id
        WHERE m.game_id = $1 AND m.round = $2`,
      [gameId, roundsFor(t.size)],
    );
    const champ = t.status === 'running' ? final[0] : undefined;

    let paid = 0;
    let unpaid = false;
    if (champ && t.prize > 0) {
      if (champ.user_id) {
        await apply(client, {
          userId: Number(champ.user_id),
          delta: t.prize,
          kind: 'giveaway',
          reason: `Slot tournament champion — ${t.title}`,
          refType: 'slot_tournament',
          refId: String(gameId),
        });
        await client.query('UPDATE tourney_entries SET paid = $2, paid_user_id = $3 WHERE id = $1', [
          champ.entry_id,
          t.prize,
          champ.user_id,
        ]);
        paid = t.prize;
      } else {
        unpaid = true;
      }
    }

    await client.query(
      `UPDATE tourney_games SET status = 'finished', finished_at = now(), requests_open = false WHERE id = $1`,
      [gameId],
    );
    await client.query(
      `INSERT INTO audit_log (admin_name, action, target, detail) VALUES ($1, 'tourney.finished', $2, $3)`,
      [by, String(gameId), JSON.stringify({ champion: champ?.kick_username ?? null, paid, unpaid, prize: t.prize })],
    );
    return { champion: champ?.kick_username ?? null, paid, unpaid };
  });
}

/**
 * Deleting a tournament, for test runs. One that paid its champion is kept —
 * it is the record of why those coins were paid.
 */
export async function deleteTourney(gameId: number): Promise<string> {
  return tx(async (client) => {
    const { rows: found } = await client.query<{ title: string }>(
      'SELECT title FROM tourney_games WHERE id = $1 FOR UPDATE',
      [gameId],
    );
    if (!found[0]) throw new TourneyError('That tournament no longer exists.');
    const { rows: paid } = await client.query('SELECT 1 FROM tourney_entries WHERE game_id = $1 AND paid > 0', [gameId]);
    if (paid.length > 0) throw new TourneyError('This tournament paid its champion, so it is kept as the record of that payment.');
    await client.query('DELETE FROM tourney_games WHERE id = $1', [gameId]);
    return found[0].title;
  });
}
