import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { gameConfigs } from '@/lib/mock';
import { disabledGames, gamesAreKilled } from '@/lib/store/settings';
import { currentUser } from '@/lib/player';
import { gamesAvailable, settingsFor } from '@/lib/store/profile';
import { balanceOf } from '@/lib/store/coins';
import { rtpLabel } from '@/lib/format';
import { GamesGate } from '@/components/games/GamesGate';
import { GameTable } from '@/components/games/Table';
import { CoinPill } from '@/components/ui/CoinPill';
import { Blackjack } from '@/components/games/Blackjack';

const TABLE_GAMES = ['dice', 'limbo', 'wheel', 'keno'] as const;
const PLAYABLE = [...TABLE_GAMES, 'blackjack'] as const;
type Playable = (typeof PLAYABLE)[number];

export function generateStaticParams() {
  return PLAYABLE.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const game = gameConfigs.find((g) => g.slug === slug);
  return {
    title: game ? game.name : 'Games',
    description: game?.description,
    robots: { index: false, follow: false },
  };
}

export const dynamic = 'force-dynamic';

export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!PLAYABLE.includes(slug as Playable)) notFound();

  const user = await currentUser();
  if (!user) return <GamesGate reason="signed-out" />;

  // Hiding the screen is a courtesy; every play endpoint refuses server-side
  // too, which is the part that actually enforces this.
  const [settings, killed, disabled, balance] = await Promise.all([
    settingsFor(user.id),
    gamesAreKilled(),
    disabledGames(),
    balanceOf(user.id),
  ]);

  if (!gamesAvailable(settings)) {
    return (
      <GamesGate
        reason={settings.excludedUntil ? 'excluded' : 'opt-in'}
        excludedUntil={settings.excludedUntil}
      />
    );
  }

  const game = gameConfigs.find((g) => g.slug === slug)!;

  if (killed || !game.enabled || disabled.includes(game.slug)) {
    return (
      <div className="gate">
        <h1>{game.name} is off right now</h1>
        <p>
          This game is temporarily disabled. Your balance is untouched and any round already in
          progress has settled normally.
        </p>
        <Link className="btn" href="/games">
          Back to games
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="sec-head">
        <div>
          <Link href="/games" className="eyebrow">
            ← All games
          </Link>
          <h1>{game.name}</h1>
          <div className="sh-sub">
            {game.description} · {rtpLabel(game.rtp)}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <CoinPill balance={balance.balance} />
        </div>
      </div>

      {slug === 'blackjack' ? (
        <Blackjack />
      ) : (
        <GameTable slug={slug as (typeof TABLE_GAMES)[number]} soundOn={settings.gameSound} />
      )}
    </>
  );
}
