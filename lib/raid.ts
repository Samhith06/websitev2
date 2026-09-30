/**
 * Boss raid's rules as pure functions: how much damage a buy deals, and
 * where the boss's HP stands after a run of buys.
 *
 * Nothing here touches the database, so the store (deciding who landed the
 * killing blow), the pages and the overlay all agree on the fight.
 *
 * Damage is kept in hundredths of a point, as whole numbers, so that summing
 * hits never drifts: 12.35× is 1235, and the boss falls exactly when the sum
 * reaches its HP × 100.
 */

export type RaidBuy = { buyCost: number | null; payout: number | null };

/** A buy's damage in hundredths: its multiplier, to two places. Null with no result. */
export function damageOf(buy: RaidBuy): number | null {
  if (buy.buyCost == null || buy.payout == null || buy.buyCost <= 0) return null;
  return Math.round((buy.payout / buy.buyCost) * 100);
}

export type Fight<T> = {
  /** Total damage dealt, in hundredths. */
  dealt: number;
  /** HP left, in hundredths, never below zero. */
  hpLeft: number;
  /** The buy whose damage took the boss to zero, if one has. */
  killer: T | null;
  /** Damage past zero on the killing blow, in hundredths. */
  overkill: number;
};

/** The fight after these buys, taken in the order they were played. */
export function fight<T extends RaidBuy>(maxHp: number, buys: T[]): Fight<T> {
  const hp = maxHp * 100;
  let dealt = 0;
  let killer: T | null = null;
  for (const buy of buys) {
    const d = damageOf(buy);
    if (d == null) continue;
    const before = dealt;
    dealt += d;
    if (killer == null && before < hp && dealt >= hp) killer = buy;
  }
  return { dealt, hpLeft: Math.max(0, hp - dealt), killer, overkill: Math.max(0, dealt - hp) };
}

/** Hundredths shown as HP: whole when whole, else two places. */
export function hp(hundredths: number): string {
  const v = hundredths / 100;
  return Number.isInteger(v)
    ? v.toLocaleString('en-US')
    : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
