/**
 * The primary destinations: six that are always there, plus a stream game —
 * Bonus Hunt, Slot Bingo, King of the Hill, Boss Raid — only while one is running. They sit beside Games
 * because on stream nights that is where chat is sent, and between games a
 * link to a finished hunt is not a destination anyone needs.
 *
 * The same list drives the desktop row and the mobile tab bar, which is why
 * each entry carries both a full label and a short one — "Leaderboard" does
 * not fit a fifth of a phone screen, "Board" does.
 */
export type NavItem = {
  href: string;
  label: string;
  short: string;
  icon: string;
};

const HOME: NavItem = { href: '/', label: 'Home', short: 'Home', icon: '⌂' };
const LEADERBOARD: NavItem = { href: '/leaderboard', label: 'Leaderboard', short: 'Board', icon: '≡' };
const MILESTONES: NavItem = { href: '/milestones', label: 'Milestones', short: 'Tiers', icon: '◆' };
const GAMES: NavItem = { href: '/games', label: 'Games', short: 'Games', icon: '⬢' };
const RAFFLES: NavItem = { href: '/raffles', label: 'Raffles', short: 'Raffles', icon: '✦' };
const STORE: NavItem = { href: '/store', label: 'Store', short: 'Store', icon: '▣' };

const HUNT: NavItem = { href: '/hunt', label: 'Bonus Hunt', short: 'Hunt', icon: '◎' };
const BINGO: NavItem = { href: '/bingo', label: 'Slot Bingo', short: 'Bingo', icon: '▦' };
const KOTH: NavItem = { href: '/koth', label: 'King of the Hill', short: 'KOTH', icon: '♛' };
const RAID: NavItem = { href: '/raid', label: 'Boss Raid', short: 'Raid', icon: '⚔' };

/**
 * Which stream games are running right now. Bingo, king of the hill and the
 * boss raid all take !sr, so at most one of them runs: the row never holds
 * more than eight.
 */
export type LiveGames = { hunt: boolean; bingo: boolean; koth: boolean; raid: boolean };

export function navFor(live: LiveGames): NavItem[] {
  return [
    HOME,
    LEADERBOARD,
    MILESTONES,
    ...(live.hunt ? [HUNT] : []),
    ...(live.bingo ? [BINGO] : []),
    ...(live.koth ? [KOTH] : []),
    ...(live.raid ? [RAID] : []),
    GAMES,
    RAFFLES,
    STORE,
  ];
}

/**
 * Which nav entry a path lights up. `/games/dice` keeps Games lit, and every
 * unmatched path falls through to nothing rather than defaulting to Home —
 * a lit Home on the store page would be a lie.
 */
export function activeNav(pathname: string, items: NavItem[]): string | null {
  if (pathname === '/') return '/';
  const match = items.find((item) => item.href !== '/' && pathname.startsWith(item.href));
  return match?.href ?? null;
}
