import 'server-only';
import { fetchRazedLeaderboard } from '@/lib/razed';
import { currentPeriod } from './periods';
import { linkFor } from './razed-links';

/**
 * "Has this member wagered at least $X under the code this leaderboard
 * period?" — the check behind the tips shelf and Split or Steal.
 *
 * It reads the same period, and the same Razed feed, that the public board
 * shows, so the figure a viewer sees on /leaderboard is the figure checked.
 *
 * It needs an *approved* Razed link. A pending one is only a claim on a
 * username, and passing against it would let anyone borrow a high roller's
 * wager by typing their name.
 *
 * Every failure to ask Razed is a refusal, not a pass: what sits behind this
 * is money, and "we could not check" is not the same as "they qualify".
 */

/** How far down the period's board we read to find someone. */
const BOARD_DEPTH = 1000;

export type WagerGateReason = 'no-period' | 'no-link' | 'link-pending' | 'short' | 'unavailable';

export type WagerGate =
  | { ok: true; wagered: number; min: number }
  | {
      ok: false;
      reason: WagerGateReason;
      /** Null when we could not read a figure at all. */
      wagered: number | null;
      min: number;
    };

export async function periodWagerGate(userId: number, min: number): Promise<WagerGate> {
  const period = await currentPeriod('monthly');
  if (!period) return { ok: false, reason: 'no-period', wagered: null, min };

  const link = await linkFor(userId);
  if (!link || link.status === 'rejected') return { ok: false, reason: 'no-link', wagered: null, min };
  if (link.status !== 'approved') return { ok: false, reason: 'link-pending', wagered: null, min };

  const feed = await fetchRazedLeaderboard({
    from: period.startsAt.slice(0, 10),
    to: period.endsAt.slice(0, 10),
    top: BOARD_DEPTH,
  });
  if (!feed.ok) return { ok: false, reason: 'unavailable', wagered: null, min };

  const name = link.username.toLowerCase();
  const wagered = feed.rows.find((r) => r.username.toLowerCase() === name)?.wagered ?? 0;

  if (wagered >= min) return { ok: true, wagered, min };
  return { ok: false, reason: 'short', wagered, min };
}

/** What is left to wager, rounded up to the cent. */
export function shortBy(gate: WagerGate): number {
  if (gate.ok || gate.wagered == null) return 0;
  return Math.ceil((gate.min - gate.wagered) * 100) / 100;
}
