/**
 * Team battle's rules as pure functions: what a buy scores, whose turn it is,
 * and when the battle is decided.
 *
 * Nothing here touches the database, so the store (drawing and paying), the
 * pages and the overlay all agree on the score.
 *
 * Points are kept in hundredths, as whole numbers, so totals never drift: a
 * 12.35× buy scores 1235.
 */

export type Team = 'a' | 'b';
export const TEAMS: Team[] = ['a', 'b'];

export type BattleBuy = { team: Team; buyCost: number | null; payout: number | null };

/** A buy's points in hundredths: its multiplier, to two places. Null with no result. */
export function pointsOf(buy: { buyCost: number | null; payout: number | null }): number | null {
  if (buy.buyCost == null || buy.payout == null || buy.buyCost <= 0) return null;
  return Math.round((buy.payout / buy.buyCost) * 100);
}

export type Score = {
  /** Totals in hundredths. */
  total: Record<Team, number>;
  /** Buys that scored, per team. */
  buys: Record<Team, number>;
  /** The team whose turn is next; null once the battle is decided. */
  next: Team | null;
  /** The winner, once both teams have had their buys and the totals differ. */
  winner: Team | null;
  /** Both teams have had their buys and the totals are level: tiebreaker. */
  tiebreak: boolean;
  /** The round being played, from 1; past `rounds` in a tiebreaker. */
  round: number;
};

/**
 * The score after these buys. Turns alternate — the team with fewer buys goes
 * next, and team A when level — so after each full round both teams have had
 * the same number of buys, and the battle can only be decided then.
 */
export function score(rounds: number, buys: BattleBuy[]): Score {
  const total: Record<Team, number> = { a: 0, b: 0 };
  const count: Record<Team, number> = { a: 0, b: 0 };
  for (const buy of buys) {
    const p = pointsOf(buy);
    if (p == null) continue;
    total[buy.team] += p;
    count[buy.team]++;
  }
  const level = count.a === count.b;
  const done = level && count.a >= rounds;
  const winner = done && total.a !== total.b ? (total.a > total.b ? 'a' : 'b') : null;
  return {
    total,
    buys: count,
    next: winner ? null : count.a <= count.b ? 'a' : 'b',
    winner,
    tiebreak: done && total.a === total.b,
    round: Math.min(count.a, count.b) + 1,
  };
}

/** Hundredths shown as points: whole when whole, else two places. */
export function pts(hundredths: number): string {
  const v = hundredths / 100;
  return Number.isInteger(v)
    ? v.toLocaleString('en-US')
    : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** A team name staff can give: one word, so chat can type it before a slot. */
export function validTeamName(name: string): boolean {
  return /^[A-Za-z0-9]{1,16}$/.test(name);
}

/**
 * Splits `!sr` text into a team word and the slot: `blue sweet bonanza` →
 * team 'a' (if A is Blue) and "sweet bonanza". Without a leading team name
 * the whole text is the slot.
 */
export function splitTeam(query: string, names: Record<Team, string>): { team: Team | null; slot: string } {
  const [first, ...rest] = query.trim().split(/\s+/);
  const word = (first ?? '').toLowerCase();
  for (const t of TEAMS) {
    if (word === names[t].toLowerCase()) return { team: t, slot: rest.join(' ') };
  }
  return { team: null, slot: query.trim() };
}
