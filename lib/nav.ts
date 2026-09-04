/**
 * The six primary destinations, in the order the design fixes them.
 *
 * The same table drives the desktop row and the mobile tab bar, which is why
 * each entry carries both a full label and a short one — "Leaderboard" does
 * not fit a fifth of a phone screen, "Board" does.
 */
export type NavItem = {
  href: string;
  label: string;
  short: string;
  icon: string;
};

export const NAV: NavItem[] = [
  { href: '/', label: 'Home', short: 'Home', icon: '⌂' },
  { href: '/leaderboard', label: 'Leaderboard', short: 'Board', icon: '≡' },
  { href: '/milestones', label: 'Milestones', short: 'Tiers', icon: '◆' },
  { href: '/games', label: 'Games', short: 'Games', icon: '⬢' },
  { href: '/raffles', label: 'Raffles', short: 'Raffles', icon: '✦' },
  { href: '/store', label: 'Store', short: 'Store', icon: '▣' },
];

/**
 * Which nav entry a path lights up. `/games/dice` keeps Games lit, and every
 * unmatched path falls through to nothing rather than defaulting to Home —
 * a lit Home on the store page would be a lie.
 */
export function activeNav(pathname: string): string | null {
  if (pathname === '/') return '/';
  const match = NAV.find((item) => item.href !== '/' && pathname.startsWith(item.href));
  return match?.href ?? null;
}
