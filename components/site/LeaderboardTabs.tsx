import Link from 'next/link';

/** The two leaderboards — Razed wagering and Kick chat — side by side at the top of each. */
export function LeaderboardTabs({ on }: { on: 'wager' | 'chat' }) {
  return (
    <nav className="tabs" aria-label="Leaderboards">
      <Link href="/leaderboard" className={on === 'wager' ? 'on' : undefined} aria-current={on === 'wager' ? 'page' : undefined}>
        Razed leaderboard
      </Link>
      <Link
        href="/leaderboard/chat"
        className={on === 'chat' ? 'on' : undefined}
        aria-current={on === 'chat' ? 'page' : undefined}
      >
        Chat leaderboard
      </Link>
    </nav>
  );
}
