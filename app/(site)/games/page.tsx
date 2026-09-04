import Link from 'next/link';
import type { Metadata } from 'next';
import { gameConfigs } from '@/lib/mock';
import { disabledGames, gamesAreKilled } from '@/lib/store/settings';
import { currentUser } from '@/lib/player';
import { gamesAvailable, settingsFor } from '@/lib/store/profile';
import { biggestRoundsToday } from '@/lib/store/play';
import { coins } from '@/lib/format';
import { GamesGate } from '@/components/games/GamesGate';

export const metadata: Metadata = {
  title: 'Games',
  description: 'Provably fair games played with the Matty Coins you earned watching.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/** The art class per game, matching the design's four gradients. */
const ART: Record<string, { cls: string; symbol: string }> = {
  dice: { cls: 'dice', symbol: '⚄' },
  limbo: { cls: 'limbo', symbol: '↗' },
  wheel: { cls: 'wheel', symbol: '◎' },
  keno: { cls: 'keno', symbol: '⬡' },
  blackjack: { cls: 'blackjack', symbol: '♠' },
};

export default async function GamesLobby() {
  const user = await currentUser();

  const [killed, disabled, settings, biggest] = await Promise.all([
    gamesAreKilled(),
    disabledGames(),
    user ? settingsFor(user.id) : Promise.resolve(null),
    biggestRoundsToday(8),
  ]);

  if (!user) return <GamesGate reason="signed-out" />;
  if (!settings || !gamesAvailable(settings)) {
    return (
      <GamesGate
        reason={settings?.excludedUntil ? 'excluded' : 'opt-in'}
        excludedUntil={settings?.excludedUntil ?? null}
      />
    );
  }

  if (killed) {
    return (
      <div className="gate">
        <h1>Games are off right now</h1>
        <p>
          Every game is temporarily disabled while something is checked. Balances are untouched and
          any round already in progress has settled normally. The rest of the site works as usual.
        </p>
      </div>
    );
  }

  const playable = gameConfigs.filter(
    (g) => g.enabled && !g.comingSoon && !disabled.includes(g.slug),
  );

  // Biggest win per game today, so each card carries a real figure rather than
  // a decorative one.
  const topByGame = new Map<string, number>();
  for (const round of biggest) {
    const current = topByGame.get(round.game) ?? 0;
    if (round.payout > current) topByGame.set(round.game, round.payout);
  }

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">Wagered in Matty Coins · no cash value</span>
          <h1>Games</h1>
          <div className="sh-sub">Provably fair — every result verifiable from the seeds</div>
        </div>
        <Link className="btn sm ghost" href="/verify">
          Verify a round
        </Link>
      </div>

      <div className="globby">
        {playable.map((game) => {
          const art = ART[game.slug] ?? { cls: '', symbol: '◆' };
          const top = topByGame.get(game.slug);
          return (
            <Link className="gcard" href={`/games/${game.slug}`} key={game.slug}>
              <div className={`art ${art.cls}`}>
                <div className="sym" aria-hidden>
                  {art.symbol}
                </div>
              </div>
              <div className="gi">
                <div className="gt">{game.name}</div>
                <div className="gd">{game.description}</div>
                <div className="gw">
                  {top ? `Biggest win today · ${coins(top)} coins` : '99% RTP · no house tricks'}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {biggest.length > 0 ? (
        <div className="ticker">
          <div className="tk">
            {/* Duplicated so the marquee loops without a visible seam. */}
            {[...biggest, ...biggest].map((round, i) => (
              <span key={i}>
                {round.masked} won <b>{coins(round.payout)}</b> on {round.game}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <p className="small muted" style={{ marginTop: 22, maxWidth: '72ch' }}>
        Matty Coins have no cash value and cannot be bought. Every game runs at 99% RTP, the result
        of each round is derived from a server seed whose hash you were shown beforehand, and you
        can switch games off again at any time from your profile.
      </p>
    </>
  );
}
