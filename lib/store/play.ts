import 'server-only';
import type { PoolClient } from 'pg';
import { one, rows, tx } from '@/lib/db';
import { generateServerSeed, hashServerSeed } from '@/lib/fairness';
import { LIMITS } from '@/lib/games';
import { limitsFor } from './settings';
import { maskUsername } from '@/lib/format';
import { InsufficientCoins, apply, balanceOf } from './coins';
import { ROUNDS_PER_MINUTE, roundsInLastMinute, tooManyRounds } from './limits';
import type { GameSlug } from '@/lib/types';

/**
 * Game rounds on Postgres. What the in-memory version got right and this keeps:
 *
 *   • the outcome is computed on the server, always;
 *   • one round is one transaction — debit, resolve, credit, ledger rows;
 *   • every play carries an idempotency key, so a double-tap is one bet;
 *   • the nonce increments once per round and never repeats on a seed pair.
 *
 * What it could not do, and this does: survive a restart, and be correct when
 * two requests from the same player arrive at once. The seed pair is locked
 * `FOR UPDATE` at the top of every round, which serialises a player's rounds
 * against each other without blocking anybody else's.
 */

export type Round = {
  id: string;
  game: GameSlug;
  bet: number;
  multiplier: number;
  payout: number;
  nonce: number;
  serverSeedHash: string;
  clientSeed: string;
  outcome: unknown;
  createdAt: string;
};

type PairRow = {
  id: string;
  server_seed: string;
  server_seed_hash: string;
  client_seed: string;
  nonce: number;
};

type RoundRow = {
  id: string;
  game: string;
  bet: number;
  multiplier: string;
  payout: number;
  nonce: number;
  outcome: unknown;
  created_at: Date;
  server_seed_hash: string;
  client_seed: string;
};

function toRound(row: RoundRow): Round {
  return {
    id: row.id,
    game: row.game as GameSlug,
    bet: row.bet,
    multiplier: Number(row.multiplier),
    payout: row.payout,
    nonce: row.nonce,
    serverSeedHash: row.server_seed_hash,
    clientSeed: row.client_seed,
    outcome: row.outcome,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * The live pair, created on first use.
 *
 * `ON CONFLICT DO NOTHING` against the partial unique index is what makes this
 * safe when two requests race to create a player's first pair: one wins, the
 * other reads what the winner wrote. Without it, both would insert and the
 * player would have two live commitments — which is a fairness bug, not a
 * cosmetic one.
 */
async function livePair(client: PoolClient, userId: number, lock: boolean): Promise<PairRow> {
  const select = `SELECT id::text, server_seed, server_seed_hash, client_seed, nonce
                    FROM seed_pairs
                   WHERE user_id = $1 AND revealed_at IS NULL${lock ? ' FOR UPDATE' : ''}`;

  const existing = await client.query<PairRow>(select, [userId]);
  if (existing.rows[0]) return existing.rows[0];

  const serverSeed = generateServerSeed();
  await client.query(
    `INSERT INTO seed_pairs (user_id, server_seed, server_seed_hash, client_seed)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING`,
    [userId, serverSeed, hashServerSeed(serverSeed), defaultClientSeed()],
  );

  const created = await client.query<PairRow>(select, [userId]);
  return created.rows[0];
}

function defaultClientSeed(): string {
  // A client seed the player has not chosen still has to be unpredictable to
  // them at the time the commitment is published.
  return generateServerSeed().slice(0, 16);
}

export type PlayFailure =
  | { ok: false; error: 'bet-below-minimum' | 'bet-above-maximum'; limit: number }
  | { ok: false; error: 'insufficient-coins'; shortfall: number }
  | { ok: false; error: 'invalid-request'; detail: string }
  | { ok: false; error: 'rate-limited'; detail: string; retryAfter: number };

export type PlaySuccess = {
  ok: true;
  round: Round;
  balance: number;
  wageredToday: number;
  netToday: number;
  nextNonce: number;
  serverSeedHash: string;
  clientSeed: string;
  replayed: boolean;
};

export type Resolution = { multiplier: number; payout: number; outcome: unknown };

/**
 * One round, start to finish, in one transaction.
 *
 * `resolve` is handed the seed material only after the pair is locked, so the
 * nonce it draws on is the one the round is recorded against. Nothing about a
 * round is written unless all of it is.
 */
export async function playRound(input: {
  userId: number;
  game: GameSlug;
  bet: number;
  idempotencyKey: string;
  resolve: (seed: { serverSeed: string; clientSeed: string; nonce: number }) => Resolution | PlayFailure;
}): Promise<PlaySuccess | PlayFailure> {
  if (!Number.isFinite(input.bet) || Math.floor(input.bet) !== input.bet) {
    return { ok: false, error: 'invalid-request', detail: 'Bet must be a whole number of coins.' };
  }
  // Per-game, and read on every round rather than cached. A maximum lowered
  // mid-stream because somebody is spiralling has to bind their next bet, not
  // wait out a cache.
  const limits = await limitsFor(input.game, LIMITS);
  if (input.bet < limits.minBet) {
    return { ok: false, error: 'bet-below-minimum', limit: limits.minBet };
  }
  if (input.bet > limits.maxBet) {
    return { ok: false, error: 'bet-above-maximum', limit: limits.maxBet };
  }

  try {
    return await tx<PlaySuccess | PlayFailure>(async (client) => {
      const pair = await livePair(client, input.userId, true);

      // A repeated key is the same round, not a second bet. Checked inside the
      // transaction and backed by a unique index, so two simultaneous taps
      // cannot both get past it.
      const replay = await client.query<RoundRow>(
        `SELECT r.id::text, r.game, r.bet, r.multiplier, r.payout, r.nonce, r.outcome,
                r.created_at, s.server_seed_hash, s.client_seed
           FROM game_rounds r
           JOIN seed_pairs s ON s.id = r.seed_pair_id
          WHERE r.user_id = $1 AND r.idempotency_key = $2`,
        [input.userId, input.idempotencyKey],
      );
      if (replay.rows[0]) {
        return snapshot(client, input.userId, toRound(replay.rows[0]), pair, true);
      }

      // Checked after the replay lookup so a retried key is never refused for
      // rate: returning the original round costs nothing and a client retrying
      // a dropped response has done nothing wrong.
      if (await roundsInLastMinute(client, input.userId) >= ROUNDS_PER_MINUTE) {
        return tooManyRounds();
      }

      const { rows: balanceRows } = await client.query<{ balance: number }>(
        'SELECT balance FROM coin_balances WHERE user_id = $1',
        [input.userId],
      );
      const balance = balanceRows[0]?.balance ?? 0;
      if (input.bet > balance) {
        return { ok: false, error: 'insufficient-coins', shortfall: input.bet - balance } as const;
      }

      const resolution = input.resolve({
        serverSeed: pair.server_seed,
        clientSeed: pair.client_seed,
        nonce: pair.nonce,
      });
      if ('ok' in resolution) return resolution;

      const inserted = await client.query<RoundRow>(
        `INSERT INTO game_rounds
           (user_id, game, seed_pair_id, nonce, bet, multiplier, payout, outcome, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id::text, game, bet, multiplier, payout, nonce, outcome, created_at`,
        [
          input.userId, input.game, pair.id, pair.nonce, input.bet,
          resolution.multiplier, resolution.payout, JSON.stringify(resolution.outcome),
          input.idempotencyKey,
        ],
      );

      await client.query(
        'UPDATE seed_pairs SET nonce = nonce + 1 WHERE id = $1',
        [pair.id],
      );

      // Two ledger rows, not one netted figure: a player reading their history
      // should see what they staked and what came back.
      const roundRef = inserted.rows[0].id;
      await apply(client, {
        userId: input.userId,
        delta: -input.bet,
        kind: 'game',
        reason: `${label(input.game)} — stake`,
        refType: 'game_round',
        refId: roundRef,
      });
      if (resolution.payout > 0) {
        await apply(client, {
          userId: input.userId,
          delta: resolution.payout,
          kind: 'game',
          reason: `${label(input.game)} — win`,
          refType: 'game_round',
          refId: roundRef,
          multiplier: resolution.multiplier,
        });
      }

      const round = toRound({
        ...inserted.rows[0],
        server_seed_hash: pair.server_seed_hash,
        client_seed: pair.client_seed,
      });
      return snapshot(client, input.userId, round, { ...pair, nonce: pair.nonce + 1 }, false);
    });
  } catch (error) {
    if (error instanceof InsufficientCoins) {
      return { ok: false, error: 'insufficient-coins', shortfall: error.needed - error.balance };
    }
    throw error;
  }
}

function label(game: GameSlug): string {
  return game.charAt(0).toUpperCase() + game.slice(1);
}

async function snapshot(
  client: PoolClient,
  userId: number,
  round: Round,
  pair: PairRow,
  replayed: boolean,
): Promise<PlaySuccess> {
  const { rows: balanceRows } = await client.query<{ balance: number }>(
    'SELECT balance FROM coin_balances WHERE user_id = $1',
    [userId],
  );
  const today = await todayTotals(client, userId);

  return {
    ok: true,
    round,
    balance: balanceRows[0]?.balance ?? 0,
    wageredToday: today.wagered,
    netToday: today.net,
    nextNonce: pair.nonce,
    serverSeedHash: pair.server_seed_hash,
    clientSeed: pair.client_seed,
    replayed,
  };
}

/** A running total for the session summary — there is no daily wager cap. */
async function todayTotals(
  client: PoolClient,
  userId: number,
): Promise<{ wagered: number; net: number }> {
  const { rows: totals } = await client.query<{ wagered: string; net: string }>(
    `SELECT COALESCE(SUM(bet), 0)::text            AS wagered,
            COALESCE(SUM(payout - bet), 0)::text   AS net
       FROM game_rounds
      WHERE user_id = $1 AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')`,
    [userId],
  );
  return { wagered: Number(totals[0]?.wagered ?? 0), net: Number(totals[0]?.net ?? 0) };
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

/** What the game screens need before a first round is played. */
export async function publicState(userId: number) {
  const pair = await tx((client) => livePair(client, userId, false));

  const revealed = await one<{ server_seed: string; server_seed_hash: string }>(
    `SELECT server_seed, server_seed_hash
       FROM seed_pairs
      WHERE user_id = $1 AND revealed_at IS NOT NULL
      ORDER BY revealed_at DESC
      LIMIT 1`,
    [userId],
  );

  const [{ balance }, recent, today] = await Promise.all([
    balanceOf(userId),
    recentRounds(userId, 20),
    totalsToday(userId),
  ]);

  return {
    serverSeedHash: pair.server_seed_hash,
    clientSeed: pair.client_seed,
    nonce: pair.nonce,
    previousServerSeed: revealed?.server_seed,
    previousServerSeedHash: revealed?.server_seed_hash,
    balance,
    wageredToday: today.wagered,
    netToday: today.net,
    rounds: recent,
  };
}

export async function recentRounds(userId: number, limit = 20): Promise<Round[]> {
  const found = await rows<RoundRow>(
    `SELECT r.id::text, r.game, r.bet, r.multiplier, r.payout, r.nonce, r.outcome,
            r.created_at, s.server_seed_hash, s.client_seed
       FROM game_rounds r
       JOIN seed_pairs s ON s.id = r.seed_pair_id
      WHERE r.user_id = $1
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT $2`,
    [userId, limit],
  );
  return found.map(toRound);
}

async function totalsToday(userId: number): Promise<{ wagered: number; net: number }> {
  const row = await one<{ wagered: string; net: string }>(
    `SELECT COALESCE(SUM(bet), 0)::text          AS wagered,
            COALESCE(SUM(payout - bet), 0)::text AS net
       FROM game_rounds
      WHERE user_id = $1 AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')`,
    [userId],
  );
  return { wagered: Number(row?.wagered ?? 0), net: Number(row?.net ?? 0) };
}

/**
 * Rotating reveals the old server seed, so every round played on it can be
 * recomputed by anybody. That reveal is the entire point of the commitment —
 * a rotation that kept the seed would make the published hash meaningless.
 */
export async function rotateSeed(userId: number, clientSeed?: string) {
  return tx(async (client) => {
    const pair = await livePair(client, userId, true);

    await client.query('UPDATE seed_pairs SET revealed_at = now() WHERE id = $1', [pair.id]);

    const serverSeed = generateServerSeed();
    const nextClientSeed = clientSeed?.trim() ? clientSeed.trim().slice(0, 64) : pair.client_seed;
    const { rows: next } = await client.query<PairRow>(
      `INSERT INTO seed_pairs (user_id, server_seed, server_seed_hash, client_seed)
       VALUES ($1, $2, $3, $4)
       RETURNING id::text, server_seed, server_seed_hash, client_seed, nonce`,
      [userId, serverSeed, hashServerSeed(serverSeed), nextClientSeed],
    );

    return {
      serverSeedHash: next[0].server_seed_hash,
      clientSeed: next[0].client_seed,
      nonce: next[0].nonce,
      revealedServerSeed: pair.server_seed,
      revealedServerSeedHash: pair.server_seed_hash,
    };
  });
}

/**
 * The biggest hits today, for the lobby and for admin.
 *
 * `masked` is what the public lobby prints. Masking happens here, on the
 * server, so a full username is never sent to a browser that had no business
 * seeing it; admin gets the real one because a moderator looking at an anomaly
 * needs to know who it is.
 */
export async function biggestRoundsToday(limit = 12): Promise<Array<{
  id: string;
  player: string;
  masked: string;
  game: GameSlug;
  bet: number;
  multiplier: number;
  payout: number;
  nonce: number;
  clientSeed: string;
  createdAt: string;
}>> {
  const found = await rows<{
    id: string; player: string; game: string; bet: number;
    multiplier: string; payout: number; nonce: number;
    client_seed: string; created_at: Date;
  }>(
    `SELECT r.id::text, u.discord_username AS player, r.game, r.bet, r.multiplier,
            r.payout, r.nonce, s.client_seed, r.created_at
       FROM game_rounds r
       JOIN users      u ON u.id = r.user_id
       JOIN seed_pairs s ON s.id = r.seed_pair_id
      WHERE r.created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')
        AND r.payout > r.bet
      ORDER BY r.multiplier DESC, r.payout DESC
      LIMIT $1`,
    [limit],
  );

  return found.map((row) => ({
    id: row.id,
    player: row.player,
    masked: maskUsername(row.player),
    game: row.game as GameSlug,
    bet: row.bet,
    multiplier: Number(row.multiplier),
    payout: row.payout,
    nonce: row.nonce,
    clientSeed: row.client_seed,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function roundsToday(): Promise<number> {
  const row = await one<{ n: string }>(
    `SELECT count(*)::text AS n FROM game_rounds
      WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')`,
  );
  return Number(row?.n ?? 0);
}
