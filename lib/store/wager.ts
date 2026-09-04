import 'server-only';
import { linkFor, type RazedLink } from './razed-links';
import { lifetimeWagered } from './razed-snapshots';

/**
 * One viewer's Razed standing, assembled once.
 *
 * Home, milestones and the profile all need the same three facts — is there a
 * link, has a mod approved it, and how much has been wagered under it — so
 * they ask for them the same way rather than each assembling their own and
 * disagreeing at the edges.
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
};

export async function wagerStateFor(userId: number | null): Promise<WagerState> {
  if (userId == null) return { link: null, approved: false, lifetime: null };

  const link = await linkFor(userId);
  if (!link) return { link: null, approved: false, lifetime: null };

  const approved = link.status === 'approved';

  // Progress is shown for a pending link too. Hiding it would make the mod
  // queue feel like a black hole; only *claiming* waits on approval.
  const lifetime = await lifetimeWagered(link.username);

  return { link, approved, lifetime };
}
