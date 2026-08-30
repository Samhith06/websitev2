import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { gameConfigs, gamesKilled } from '@/lib/mock';
import { viewerOrSignedOut } from '@/lib/viewer';
import { Display, Label } from '@/components/ui/typography';
import { Card } from '@/components/ui/surfaces';
import { OptInGate } from '@/components/games/OptInGate';
import { Keno } from '@/components/games/Keno';
import { Dice } from '@/components/games/Dice';
import { Limbo } from '@/components/games/Limbo';

const PLAYABLE = ['keno', 'dice', 'limbo'] as const;
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

// The screen reads the signed-in viewer's own state, so it renders per request.
export const dynamic = 'force-dynamic';

export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!PLAYABLE.includes(slug as Playable)) notFound();

  // Every play endpoint refuses server-side too; this only hides the screen.
  const viewer = await viewerOrSignedOut();
  if (!viewer.games.enabled || viewer.games.excludedUntil) return <OptInGate />;

  const game = gameConfigs.find((g) => g.slug === slug)!;

  if (gamesKilled || !game.enabled) {
    return (
      <div className="container-page py-24">
        <Card className="mx-auto max-w-lg p-8 text-center">
          <Display size="s" as="h1">
            {game.name} is temporarily unavailable
          </Display>
          <p className="mt-4 text-[14.5px] leading-relaxed text-ink-2">
            This game is switched off while something is checked. Any round already in progress has
            settled normally and your balance is untouched.
          </p>
          <Link href="/games" className="mt-5 inline-block text-[14px] text-brand underline underline-offset-2">
            Back to the lobby
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="container-page py-8 lg:py-12">
      <Link
        href="/games"
        className="inline-flex items-center gap-1.5 text-[13.5px] text-muted transition-colors duration-150 hover:text-ink"
      >
        <ArrowLeft size={15} />
        Games
      </Link>

      <div className="mt-5 mb-7">
        <Label className="mb-3">
          Provably fair · {(game.rtp * 100).toFixed(0)}% RTP · {game.minBet}–{game.maxBet} MC
        </Label>
        <Display size="l" as="h1">
          {game.name}
        </Display>
      </div>

      {slug === 'keno' ? <Keno /> : null}
      {slug === 'dice' ? <Dice /> : null}
      {slug === 'limbo' ? <Limbo /> : null}
    </div>
  );
}
