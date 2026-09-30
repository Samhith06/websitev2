/**
 * King of the hill's rules as pure functions: what a buy scored, and who
 * holds the hill after a run of buys.
 *
 * Nothing here touches the database, so the store (deciding who is paid),
 * the pages and the overlay all agree on who the king is.
 */

export type ScoredBuy = { buyCost: number | null; payout: number | null };

/** Payout ÷ cost. Null for a buy with no result yet. */
export function score(buy: ScoredBuy): number | null {
  if (buy.buyCost == null || buy.payout == null || buy.buyCost <= 0) return null;
  return buy.payout / buy.buyCost;
}

/**
 * The king after these buys, taken in the order they were played: the first
 * buy takes an empty hill, and after that only a strictly better multiplier
 * takes it. A tie leaves the king where they are — the challenger has to beat
 * them, not match them.
 */
export function kingOf<T extends ScoredBuy>(buys: T[]): T | null {
  let king: T | null = null;
  let best = -1;
  for (const buy of buys) {
    const x = score(buy);
    if (x == null) continue;
    if (king == null || x > best) {
      king = buy;
      best = x;
    }
  }
  return king;
}
