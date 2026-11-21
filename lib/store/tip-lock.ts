import 'server-only';
import { fetchRazedLeaderboard } from '@/lib/razed';
import { currentPeriod } from './periods';
import { linkFor } from './razed-links';

/**
 * The wager lock on the tips shelf.
 *
 * A tip can only be bought by someone who has wagered at least
 * `TIP_WAGER_MIN` under the code during the current leaderboard period — the
 * same period, and the same Razed read, that the public board shows, so the
 * figure a viewer sees on /leaderboard is the figure the lock checks.
 *
 * It needs an *approved* Razed link. A pending one is only a claim on a
 * username, and unlocking against it would let anyone borrow a high roller's
 * wager by typing their name.
 *
 * Every failure to ask Razed is a refusal, not a pass: a tip is money, and
 * "we could not check" is not the same as "they qualify".
 */

export const TIP_WAGER_MIN = 100;

/** How far down the period's board we read to find someone. */
const BOARD_DEPTH = 1000;

export type TipLock =
  | { unlocked: true; wagered: number }
  | {
      unlocked: false;
      reason: 'no-period' | 'no-link' | 'link-pending' | 'short' | 'unavailable';
      /** Null when we could not read a figure at all. */
      wagered: number | null;
      message: string;
    };

export async function tipLockFor(userId: number): Promise<TipLock> {
  const period = await currentPeriod('monthly');
  if (!period) {
    return {
      unlocked: false,
      reason: 'no-period',
      wagered: null,
      message: 'Tips open once a leaderboard period is running.',
    };
  }

  const link = await linkFor(userId);
  if (!link || link.status === 'rejected') {
    return {
      unlocked: false,
      reason: 'no-link',
      wagered: null,
      message: 'Link your Razed account on your profile to buy tips.',
    };
  }
  if (link.status !== 'approved') {
    return {
      unlocked: false,
      reason: 'link-pending',
      wagered: null,
      message: 'Your Razed link is waiting on a mod. Tips unlock once it is approved.',
    };
  }

  const feed = await fetchRazedLeaderboard({
    from: period.startsAt.slice(0, 10),
    to: period.endsAt.slice(0, 10),
    top: BOARD_DEPTH,
  });
  if (!feed.ok) {
    return {
      unlocked: false,
      reason: 'unavailable',
      wagered: null,
      message: 'We could not check your wager with Razed just now. Try again in a few minutes.',
    };
  }

  const name = link.username.toLowerCase();
  const wagered = feed.rows.find((r) => r.username.toLowerCase() === name)?.wagered ?? 0;

  if (wagered >= TIP_WAGER_MIN) return { unlocked: true, wagered };

  const left = Math.ceil((TIP_WAGER_MIN - wagered) * 100) / 100;
  return {
    unlocked: false,
    reason: 'short',
    wagered,
    message: `Tips need $${TIP_WAGER_MIN} wagered this leaderboard period. You are $${left.toFixed(2)} short.`,
  };
}
