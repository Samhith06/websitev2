import 'server-only';
import { generateServerSeed, hashServerSeed } from './fairness';
import { LIMITS } from './games';
import { viewer } from './mock';
import type { GameSlug } from './types';

/**
 * A stand-in for the tables in Master Plan §13 — `seed_pairs`, `game_rounds`,
 * `coin_ledger`, `play_limits` — held in memory so the games are genuinely
 * playable before the database lands.
 *
 * What is *not* a stand-in, and must survive the swap to Postgres:
 *   • the outcome is computed here, on the server, always;
 *   • one round is one transaction — debit, resolve, credit, ledger row;
 *   • every play carries an idempotency key, so a double-tap is one bet;
 *   • the nonce increments once per round and never repeats on a seed.
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

type Session = {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  previousServerSeed?: string;
  previousServerSeedHash?: string;
  balance: number;
  wageredToday: number;
  netToday: number;
  rounds: Round[];
  /** idempotency key → the round it produced */
  seen: Map<string, Round>;
};

/**
 * One session per player, keyed on the Discord id.
 *
 * It was a single global, which meant every visitor on the site shared one
 * balance and one nonce — two people playing at once fought over the same
 * coins. Keyed by player it is at least correct in shape.
 *
 * It is still in memory, so it resets on deploy and does not survive across
 * instances. That part genuinely needs Postgres (Master Plan §13); this is the
 * structure that swap drops into, not a substitute for it.
 */
const globalStore = globalThis as unknown as { __msSessions?: Map<string, Session> };

function sessions(): Map<string, Session> {
  if (!globalStore.__msSessions) globalStore.__msSessions = new Map();
  return globalStore.__msSessions;
}

export function getSession(playerId: string): Session {
  const all = sessions();
  let session = all.get(playerId);
  if (!session) {
    const serverSeed = generateServerSeed();
    session = {
      serverSeed,
      serverSeedHash: hashServerSeed(serverSeed),
      // Seeded from the mock viewer until balances come from the database.
      clientSeed: viewer.discordUsername,
      nonce: 0,
      balance: viewer.balance,
      wageredToday: viewer.games.wageredToday,
      netToday: viewer.games.netToday,
      rounds: [],
      seen: new Map(),
    };
    all.set(playerId, session);
  }
  return session;
}

export type PlayFailure =
  | { ok: false; error: 'bet-below-minimum' | 'bet-above-maximum'; limit: number }
  | { ok: false; error: 'insufficient-coins'; shortfall: number }
  | { ok: false; error: 'invalid-request'; detail: string };

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

/** Every rule the bet has to clear, checked server-side and in one place. */
export function checkBet(session: Session, bet: number): PlayFailure | null {
  if (!Number.isFinite(bet) || Math.floor(bet) !== bet) {
    return { ok: false, error: 'invalid-request', detail: 'Bet must be a whole number of coins.' };
  }
  if (bet < LIMITS.minBet) return { ok: false, error: 'bet-below-minimum', limit: LIMITS.minBet };
  if (bet > LIMITS.maxBet) return { ok: false, error: 'bet-above-maximum', limit: LIMITS.maxBet };
  if (bet > session.balance) {
    return { ok: false, error: 'insufficient-coins', shortfall: bet - session.balance };
  }
  return null;
}

/**
 * The single transaction. Nothing about a round is written unless all of it is.
 */
export function settle(
  session: Session,
  input: { game: GameSlug; bet: number; multiplier: number; payout: number; outcome: unknown; idempotencyKey: string },
): PlaySuccess {
  const existing = session.seen.get(input.idempotencyKey);
  if (existing) {
    // A repeated tap is the same round, not a second bet.
    return snapshot(session, existing, true);
  }

  const round: Round = {
    id: `r${session.nonce + 1}-${Date.now().toString(36)}`,
    game: input.game,
    bet: input.bet,
    multiplier: input.multiplier,
    payout: input.payout,
    nonce: session.nonce,
    serverSeedHash: session.serverSeedHash,
    clientSeed: session.clientSeed,
    outcome: input.outcome,
    createdAt: new Date().toISOString(),
  };

  session.balance = session.balance - input.bet + input.payout;
  session.wageredToday += input.bet;
  session.netToday += input.payout - input.bet;
  session.nonce += 1;
  session.rounds.unshift(round);
  session.rounds = session.rounds.slice(0, 50);
  session.seen.set(input.idempotencyKey, round);

  return snapshot(session, round, false);
}

function snapshot(session: Session, round: Round, replayed: boolean): PlaySuccess {
  return {
    ok: true,
    round,
    balance: session.balance,
    wageredToday: session.wageredToday,
    netToday: session.netToday,
    nextNonce: session.nonce,
    serverSeedHash: session.serverSeedHash,
    clientSeed: session.clientSeed,
    replayed,
  };
}

/**
 * Rotating the seed reveals the old one, so every round played on it can be
 * recomputed by anybody (§9). The nonce resets with the new pair.
 */
export function rotateSeed(session: Session, clientSeed?: string) {
  session.previousServerSeed = session.serverSeed;
  session.previousServerSeedHash = session.serverSeedHash;
  session.serverSeed = generateServerSeed();
  session.serverSeedHash = hashServerSeed(session.serverSeed);
  if (clientSeed && clientSeed.trim()) session.clientSeed = clientSeed.trim().slice(0, 64);
  session.nonce = 0;
  return {
    serverSeedHash: session.serverSeedHash,
    clientSeed: session.clientSeed,
    nonce: session.nonce,
    revealedServerSeed: session.previousServerSeed,
    revealedServerSeedHash: session.previousServerSeedHash,
  };
}

/** What the game screens need to render before a first round is played. */
export function publicState(playerId: string) {
  const session = getSession(playerId);
  return {
    serverSeedHash: session.serverSeedHash,
    clientSeed: session.clientSeed,
    nonce: session.nonce,
    previousServerSeed: session.previousServerSeed,
    previousServerSeedHash: session.previousServerSeedHash,
    balance: session.balance,
    wageredToday: session.wageredToday,
    netToday: session.netToday,
    rounds: session.rounds.slice(0, 20),
  };
}
