/**
 * Slot tournament's rules as pure functions: the bracket's shape, how byes
 * are placed, and who wins a match.
 *
 * Nothing here touches the database, so the store (seeding and advancing),
 * the pages and the overlay all agree on the bracket.
 *
 * Scores are kept in hundredths, as whole numbers: a 12.35× buy scores 1235.
 */

export const TOURNEY_SIZES = [4, 8, 16] as const;

export type Side = 'a' | 'b';

/** A buy's score in hundredths: its multiplier, to two places. Null with no result. */
export function scoreOf(buy: { buyCost: number | null; payout: number | null }): number | null {
  if (buy.buyCost == null || buy.payout == null || buy.buyCost <= 0) return null;
  return Math.round((buy.payout / buy.buyCost) * 100);
}

/** Rounds in a bracket of this size: 2 → 1, 4 → 2, 8 → 3, 16 → 4. */
export function roundsFor(size: number): number {
  return Math.round(Math.log2(size));
}

/** The smallest bracket that holds `players`, never below 2 or above `max`. */
export function bracketSize(players: number, max: number): number {
  let size = 2;
  while (size < players && size < max) size *= 2;
  return size;
}

/** "Final", "Semi-finals", "Quarter-finals", else "Round 1". */
export function roundName(round: number, rounds: number): string {
  const fromEnd = rounds - round;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semi-finals';
  if (fromEnd === 2) return 'Quarter-finals';
  return `Round ${round}`;
}

/** The same, short enough for a stats strip: "Final", "SF", "QF", "R1". */
export function roundShort(round: number, rounds: number): string {
  const fromEnd = rounds - round;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'SF';
  if (fromEnd === 2) return 'QF';
  return `R${round}`;
}

/**
 * Round 1's pairs for these players (already shuffled) in a bracket of
 * `size`. Byes go one to a match — never a bye against a bye — in the first
 * matches, so every match in round 2 has at least one real player.
 */
export function firstRound<T>(players: T[], size: number): Array<[T, T | null]> {
  const matches = size / 2;
  const byes = size - players.length;
  const pairs: Array<[T, T | null]> = [];
  let i = 0;
  for (let m = 0; m < matches; m++) {
    if (m < byes) pairs.push([players[i++], null]);
    else {
      pairs.push([players[i], players[i + 1]]);
      i += 2;
    }
  }
  return pairs;
}

export type MatchBuy = { side: Side; buyCost: number | null; payout: number | null };

export type MatchState = {
  /** Each side's scores, in the order they were bought. */
  legs: Record<Side, number[]>;
  /** The side that buys next; null once decided. */
  next: Side | null;
  winner: Side | null;
  /** The last full leg was level, so both buy again. */
  tied: boolean;
};

/**
 * A match after these buys. A buys, then B; the first leg where the two
 * scores differ decides it. A level leg means both buy again.
 */
export function matchState(buys: MatchBuy[]): MatchState {
  const legs: Record<Side, number[]> = { a: [], b: [] };
  for (const buy of buys) {
    const s = scoreOf(buy);
    if (s != null) legs[buy.side].push(s);
  }
  const full = Math.min(legs.a.length, legs.b.length);
  let winner: Side | null = null;
  for (let i = 0; i < full && !winner; i++) {
    if (legs.a[i] !== legs.b[i]) winner = legs.a[i] > legs.b[i] ? 'a' : 'b';
  }
  return {
    legs,
    next: winner ? null : legs.a.length <= legs.b.length ? 'a' : 'b',
    winner,
    tied: !winner && full > 0 && legs.a.length === legs.b.length,
  };
}

/** Hundredths shown as a multiplier: "12.35×", "130×". */
export function x(hundredths: number): string {
  const v = hundredths / 100;
  return `${Number.isInteger(v) ? v : v.toFixed(2)}×`;
}
