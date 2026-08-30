import 'server-only';
import { currentUser } from './player';
import { roleFor } from './admin';
import { kickLinkFor, multiplierFor, subStateFor } from './store/accounts';
import { balanceOf, earnedSince } from './store/coins';
import type { Viewer } from './types';

/**
 * The signed-in viewer, assembled from the database.
 *
 * Returns null for a signed-out visitor *and* for a deployment with no
 * database — in both cases the honest answer is that the site does not know who
 * this is, and every screen that takes a viewer already has a signed-out state.
 *
 * Nothing here is invented. A brand-new account really does have a zero
 * balance, and showing one is better than showing a number that would go down
 * the moment it became real.
 */
export async function currentViewer(): Promise<Viewer | null> {
  const user = await currentUser();
  if (!user) return null;

  const [link, sub, balance] = await Promise.all([
    kickLinkFor(user.id),
    subStateFor(user.id),
    balanceOf(user.id),
  ]);

  const weekStart = new Date();
  weekStart.setUTCHours(0, 0, 0, 0);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);
  const earnedThisWeek = await earnedSince(user.id, weekStart);

  const frozen = user.status === 'frozen';

  return {
    signedIn: true,
    discordId: user.discordId,
    discordUsername: user.discordUsername,
    avatarUrl: user.avatarUrl ?? '',
    memberSince: user.createdAt,
    kick: link,
    balance: balance.balance,
    lifetimeEarned: balance.lifetimeEarned,
    earnedThisWeek,
    // Redemptions are not persisted yet, so this is a known zero rather than
    // a guess; the shop is the piece of work that makes it meaningful.
    pendingRedemptions: 0,
    multiplier: multiplierFor(sub),
    frozen: {
      frozen,
      reason: user.frozenReason ?? undefined,
      until: user.frozenUntil ?? undefined,
    },
    role: roleFor(user.discordId) ?? 'member',
    games: {
      enabled: !frozen,
      wageredToday: 0,
      netToday: 0,
      excludedUntil: null,
      sessionReminderMinutes: 60,
    },
  };
}

/**
 * The chrome — nav, coin bar, hero — renders for signed-out visitors too, so it
 * takes a viewer that is explicitly not signed in rather than a null it would
 * have to branch on in five places.
 */
export const SIGNED_OUT: Viewer = {
  signedIn: false,
  discordId: '',
  discordUsername: '',
  avatarUrl: '',
  memberSince: new Date(0).toISOString(),
  kick: null,
  balance: 0,
  lifetimeEarned: 0,
  earnedThisWeek: 0,
  pendingRedemptions: 0,
  multiplier: { label: 'Member', value: 1 },
  frozen: { frozen: false },
  role: 'member',
  games: {
    enabled: true,
    wageredToday: 0,
    netToday: 0,
    excludedUntil: null,
    sessionReminderMinutes: 60,
  },
};

export async function viewerOrSignedOut(): Promise<Viewer> {
  return (await currentViewer()) ?? SIGNED_OUT;
}
