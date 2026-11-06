import 'server-only';
import { LIFETIME_CYCLE, isLifetimeMember } from './milestones';
import { linkFor, type RazedLink } from './razed-links';
import { LIFETIME_PERIOD, lifetimeWagered, monthKey, monthPeriod, wageredInPeriod } from './razed-snapshots';

/**
 * Which ladder someone is on, and the figure it runs on.
 *
 * Measured here in one place, with the month read once, so a figure and the
 * cycle it belongs to can never come from opposite sides of midnight on the 1st.
 */
export type MilestoneStanding = {
  mode: 'monthly' | 'lifetime';
  /** What a claim is filed under: 'YYYY-MM', or LIFETIME_CYCLE. */
  cycle: string;
  /** The Razed snapshot period the figure is read from. */
  period: string;
  /** Null means "we could not ask", exactly as `lifetime` below. */
  wagered: number | null;
  /** When this ladder next starts over. Null on the lifetime ladder. */
  resetsAt: string | null;
};

/**
 * One viewer's Razed standing, assembled once.
 *
 * Home, milestones and the profile all need the same facts — is there a link,
 * has a mod approved it, and how much has been wagered under it — so they ask
 * for them the same way rather than each assembling their own and disagreeing
 * at the edges.
 */
export type WagerState = {
  link: RazedLink | null;
  approved: boolean;
  /**
   * Null means "we could not ask", not "zero". The difference matters: a
   * progress bar at 0% and a progress bar that admits it does not know are
   * different promises to the person reading them.
   */
  lifetime: number | null;
  milestone: MilestoneStanding;
};

function firstOfNextMonth(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

export async function wagerStateFor(userId: number | null): Promise<WagerState> {
  const now = new Date();
  const month = monthKey(now);
  const onLifetimeList = userId != null && (await isLifetimeMember(userId));

  const standing = (wagered: number | null): MilestoneStanding =>
    onLifetimeList
      ? {
          mode: 'lifetime',
          cycle: LIFETIME_CYCLE,
          period: LIFETIME_PERIOD,
          wagered,
          resetsAt: null,
        }
      : {
          mode: 'monthly',
          cycle: month,
          period: monthPeriod(month),
          wagered,
          resetsAt: firstOfNextMonth(now),
        };

  const link = userId == null ? null : await linkFor(userId);
  if (!link) return { link: null, approved: false, lifetime: null, milestone: standing(null) };

  const approved = link.status === 'approved';

  // Progress is shown for a pending link too. Hiding it would make the mod
  // queue feel like a black hole; only *claiming* waits on approval.
  const lifetime = await lifetimeWagered(link.username);
  const wagered = onLifetimeList
    ? lifetime
    : await wageredInPeriod(monthPeriod(month), link.username);

  return { link, approved, lifetime, milestone: standing(wagered) };
}
