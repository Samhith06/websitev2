import 'server-only';
import { periodWagerGate, shortBy, type WagerGateReason } from './wager-gate';

/**
 * The wager lock on the tips shelf: a tip can only be bought by someone who
 * has wagered at least `TIP_WAGER_MIN` under the code during the current
 * leaderboard period. The check itself is `periodWagerGate`.
 */

export const TIP_WAGER_MIN = 100;

export type TipLock =
  | { unlocked: true; wagered: number }
  | {
      unlocked: false;
      reason: WagerGateReason;
      /** Null when we could not read a figure at all. */
      wagered: number | null;
      message: string;
    };

const MESSAGES = {
  'no-period': 'Tips open once a leaderboard period is running.',
  'no-link': 'Link your Razed account on your profile to buy tips.',
  'link-pending': 'Your Razed link is waiting on a mod. Tips unlock once it is approved.',
  unavailable: 'We could not check your wager with Razed just now. Try again in a few minutes.',
} as const;

export async function tipLockFor(userId: number): Promise<TipLock> {
  const gate = await periodWagerGate(userId, TIP_WAGER_MIN);
  if (gate.ok) return { unlocked: true, wagered: gate.wagered };

  const message =
    gate.reason === 'short'
      ? `Tips need $${TIP_WAGER_MIN} wagered this leaderboard period. You are $${shortBy(gate).toFixed(2)} short.`
      : MESSAGES[gate.reason];
  return { unlocked: false, reason: gate.reason, wagered: gate.wagered, message };
}
