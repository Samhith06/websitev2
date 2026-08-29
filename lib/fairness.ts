/**
 * The fairness engine — UI Spec §36, Master Plan §9.
 *
 * Built first, and not because it is the exciting part: every game sits on it,
 * and retrofitting provable fairness to a game that already shipped means
 * invalidating every round played before it. The same machinery draws the
 * giveaway winners, so it is built once and paid for twice.
 *
 * Commit–reveal:
 *   1. The server generates a seed and publishes only its SHA-256 hash.
 *   2. The player sets their own client seed.
 *   3. A nonce increments once per round.
 *   4. The outcome derives deterministically from the three, and from nothing
 *      else. No timestamp, no balance, no bet size.
 *
 * Rotating a seed reveals the old one, at which point every round played on it
 * can be recomputed by anybody — that is what the /verify page does.
 */
import { createHash, createHmac, randomBytes } from 'node:crypto';

export const HOUSE_EDGE = 0.99; // 99% RTP, stated on every paytable.

export function generateServerSeed(): string {
  return randomBytes(32).toString('hex');
}

export function hashServerSeed(serverSeed: string): string {
  return createHash('sha256').update(serverSeed).digest('hex');
}

/**
 * The byte stream. HMAC-SHA256 keyed on the server seed over
 * `clientSeed:nonce:cursor`, with the cursor advancing to produce as many
 * bytes as a game needs.
 */
function* byteStream(serverSeed: string, clientSeed: string, nonce: number): Generator<number> {
  let cursor = 0;
  while (true) {
    const digest = createHmac('sha256', serverSeed)
      .update(`${clientSeed}:${nonce}:${cursor}`)
      .digest();
    for (const byte of digest) yield byte;
    cursor += 1;
  }
}

/**
 * Floats in [0, 1). Four bytes each, in the standard big-endian base-256
 * arrangement, so a third party reimplementing the check gets the same answer.
 */
export function floats(serverSeed: string, clientSeed: string, nonce: number, count: number): number[] {
  const stream = byteStream(serverSeed, clientSeed, nonce);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    let value = 0;
    for (let j = 0; j < 4; j++) {
      value += stream.next().value / 256 ** (j + 1);
    }
    out.push(value);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Per-game outcome derivation                                                */
/* -------------------------------------------------------------------------- */

export type KenoOutcome = { drawn: number[] };
export type DiceOutcome = { roll: number };
export type LimboOutcome = { result: number };

/** Ten distinct numbers from 1–40, by partial Fisher–Yates over the stream. */
export function kenoDraw(serverSeed: string, clientSeed: string, nonce: number, board = 40, draw = 10): KenoOutcome {
  const pool = Array.from({ length: board }, (_, i) => i + 1);
  const f = floats(serverSeed, clientSeed, nonce, draw);
  const drawn: number[] = [];
  for (let i = 0; i < draw; i++) {
    const remaining = pool.length - i;
    const pick = i + Math.floor(f[i] * remaining);
    [pool[i], pool[pick]] = [pool[pick], pool[i]];
    drawn.push(pool[i]);
  }
  return { drawn };
}

/** 0.00 – 100.00, two decimal places. */
export function diceRoll(serverSeed: string, clientSeed: string, nonce: number): DiceOutcome {
  const [f] = floats(serverSeed, clientSeed, nonce, 1);
  return { roll: Math.floor(f * 10_001) / 100 };
}

/** The unbounded multiplier, edge applied, floored to two decimals, min 1.00. */
export function limboResult(serverSeed: string, clientSeed: string, nonce: number): LimboOutcome {
  const [f] = floats(serverSeed, clientSeed, nonce, 1);
  const raw = (1 / (1 - f)) * HOUSE_EDGE;
  return { result: Math.max(1, Math.floor(raw * 100) / 100) };
}


/**
 * The giveaway draw (§8 of the plan). The winning index derives from the seed
 * over the giveaway id, across the final entry count — the same commitment, so
 * anyone who can verify a keno round can verify a draw.
 */
export function giveawayWinnerIndex(serverSeed: string, giveawayId: string, entryCount: number): number {
  const digest = createHmac('sha256', serverSeed).update(giveawayId).digest();
  let value = 0;
  for (let j = 0; j < 4; j++) value += digest[j] / 256 ** (j + 1);
  return Math.floor(value * entryCount);
}

/* -------------------------------------------------------------------------- */
/* The verifier                                                               */
/* -------------------------------------------------------------------------- */

export type VerifyInput = {
  game: 'keno' | 'dice' | 'limbo';
  serverSeed: string;
  clientSeed: string;
  nonce: number;
};

export type VerifyResult = {
  serverSeedHash: string;
  outcome: KenoOutcome | DiceOutcome | LimboOutcome;
  /** A human-readable rendering of the same thing, for the result panel. */
  display: string;
};

export function verify(input: VerifyInput): VerifyResult {
  const { game, serverSeed, clientSeed, nonce } = input;
  const serverSeedHash = hashServerSeed(serverSeed);

  switch (game) {
    case 'keno': {
      const outcome = kenoDraw(serverSeed, clientSeed, nonce);
      return { serverSeedHash, outcome, display: outcome.drawn.join(', ') };
    }
    case 'dice': {
      const outcome = diceRoll(serverSeed, clientSeed, nonce);
      return { serverSeedHash, outcome, display: outcome.roll.toFixed(2) };
    }
    case 'limbo': {
      const outcome = limboResult(serverSeed, clientSeed, nonce);
      return { serverSeedHash, outcome, display: `${outcome.result.toFixed(2)}×` };
    }
  }
}
