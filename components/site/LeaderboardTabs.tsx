import Link from 'next/link';

/** The two races, side by side at the top of each board. */
export function LeaderboardTabs({ on }: { on: 'wager' | 'chat' }) {
  return (
    <nav className="tabs" aria-label="Leaderboards">
      <Link href="/leaderboard" className={on === 'wager' ? 'on' : undefined} aria-current={on === 'wager' ? 'page' : undefined}>
        Wager race
      </Link>
      <Link
        href="/leaderboard/chat"
        className={on === 'chat' ? 'on' : undefined}
        aria-current={on === 'chat' ? 'page' : undefined}
      >
        Chat race
      </Link>
    </nav>
  );
}
