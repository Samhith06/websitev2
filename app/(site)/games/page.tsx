import Link from 'next/link';
import type { Metadata } from 'next';
import { cn } from '@/lib/cn';
import { coins, mult, relativeTime } from '@/lib/format';
import { gameConfigs, gamesKilled } from '@/lib/mock';
import { viewerOrSignedOut } from '@/lib/viewer';
import { biggestRoundsToday } from '@/lib/store/play';
import { Display, Label, Num } from '@/components/ui/typography';
import { Chip, ChipRow } from '@/components/ui/controls';
import { Card } from '@/components/ui/surfaces';
import { CoinMark } from '@/components/ui/marks';
import { OptInGate } from '@/components/games/OptInGate';
import { GamePreview } from '@/components/games/GamePreview';
import type { GameConfig } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Games',
  description: 'Provably fair games played with the Matty Coins you earned watching.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function GamesLobby() {
  const viewer = await viewerOrSignedOut();

  // Direct URLs redirect to the gate until it has been completed (§39).
  if (!viewer.games.enabled || viewer.games.excludedUntil) return <OptInGate />;

  if (gamesKilled) {
    return (
      <div className="container-page py-24">
        <Card className="mx-auto max-w-lg p-8 text-center">
          <Display size="s" as="h1">
            Games are off right now
          </Display>
          <p className="mt-4 text-[14.5px] leading-relaxed text-ink-2">
            Every game is temporarily disabled while something is checked. Balances are untouched
            and any round already in progress has settled normally. The rest of the site works as
            usual.
          </p>
        </Card>
      </div>
    );
  }

  const limits = viewer.games;
  const biggestHitsToday = await biggestRoundsToday(12);

  return (
    <div className="container-page py-10 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Label className="mb-3 flex items-center gap-2">
            <CoinMark size={15} />
            Provably fair · played with the coin you earned watching
          </Label>
          <Display size="l" as="h1">
            Games
          </Display>
        </div>

        <ChipRow label="Games views">
          <Chip active>All</Chip>
          <Chip as="link" href="/me#ledger">My history</Chip>
          <Chip as="link" href="/verify">Verify a round</Chip>
        </ChipRow>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Balance strip */}
      {/* ------------------------------------------------------------- */}
      <div className="mt-8">
        <Card tone="brand">
          <div className="grid gap-px bg-brand-line sm:grid-cols-3 [&>div]:bg-brand-bg">
            <div className="px-5 py-5">
              <Label className="mb-2">Balance</Label>
              <span className="flex items-center gap-2.5">
                <CoinMark size={26} variant="detail" />
                <Num tone="brand" className="text-[30px] font-medium leading-none lg:text-[34px]">
                  {coins(viewer.balance)}
                </Num>
              </span>
            </div>
            <div className="px-5 py-5">
              <Label className="mb-2">Wagered today</Label>
              <Num className="text-[22px]">{coins(limits.wageredToday)}</Num>
            </div>
            <div className="px-5 py-5">
              {/* One honest number, never hidden. */}
              <Label className="mb-2">Net today</Label>
              <Num tone={limits.netToday < 0 ? 'danger' : 'gold'} className="text-[22px]">
                {limits.netToday >= 0 ? '+' : '−'}
                {coins(Math.abs(limits.netToday))}
              </Num>
            </div>
          </div>
        </Card>

      </div>

      {/* ------------------------------------------------------------- */}
      {/* The grid — each card a live preview, not a logo               */}
      {/* ------------------------------------------------------------- */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {gameConfigs.map((game) => (
          <GameCard key={game.slug} game={game} />
        ))}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Biggest hits today. Absent rather than empty on a quiet day —  */}
      {/* a table of column headings over nothing reads as broken.       */}
      {/* ------------------------------------------------------------- */}
      {biggestHitsToday.length > 0 ? (
      <section className="mt-[56px]">
        <Display size="m" as="h2">
          Biggest hits today
        </Display>
        <div className="mt-6 overflow-hidden rounded-[3px] border border-line">
          <div className="hidden grid-cols-[1fr_100px_100px_110px_120px_90px] bg-surface-2 lg:grid">
            {['Player', 'Game', 'Bet', 'Multiplier', 'Payout', ''].map((h, i) => (
              <div key={i} className="px-4 py-2.5">
                <Label>{h}</Label>
              </div>
            ))}
          </div>
          <div className="bg-surface">
            {biggestHitsToday.map((round) => (
              <div
                key={round.id}
                className="grid grid-cols-2 gap-1 border-t border-line px-4 py-3.5 lg:grid-cols-[1fr_100px_100px_110px_120px_90px] lg:items-center lg:gap-0 lg:px-0 lg:py-0"
              >
                <div className="text-[14px] text-ink lg:px-4 lg:py-3.5">{round.masked}</div>
                <div className="font-mono text-[12px] uppercase tracking-[0.12em] text-muted lg:px-4 lg:py-3.5">
                  {round.game}
                </div>
                <div className="font-mono text-[13.5px] tabular-nums text-ink-2 lg:px-4 lg:py-3.5">
                  {coins(round.bet)}
                </div>
                <div className="font-mono text-[13.5px] tabular-nums text-gold lg:px-4 lg:py-3.5">
                  {mult(round.multiplier)}
                </div>
                <div className="font-mono text-[13.5px] tabular-nums text-gold lg:px-4 lg:py-3.5">
                  {coins(round.payout)}
                </div>
                <div className="lg:px-4 lg:py-3.5">
                  {/* The Verify link on a stranger's win is the most persuasive
                      thing on this page. */}
                  <Link
                    href={`/verify?game=${round.game}&clientSeed=${encodeURIComponent(round.clientSeed)}&nonce=${round.nonce}`}
                    className="text-[13px] text-brand hover:text-brand-dim"
                  >
                    Verify
                  </Link>
                </div>
                <div className="col-span-2 font-mono text-[11px] text-faint lg:hidden">
                  {relativeTime(round.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      ) : null}

      {/* ------------------------------------------------------------- */}
      {/* Two closing cards                                             */}
      {/* ------------------------------------------------------------- */}
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="border-b border-line px-5 py-3.5">
            <Label>How provable fairness works</Label>
          </div>
          <div className="space-y-3 px-5 py-5 text-[14px] leading-relaxed text-ink-2">
            <p>
              Before you play, the server generates a secret seed and publishes only its SHA-256
              hash. That hash is a commitment: it cannot produce a different seed later.
            </p>
            <p>
              You set your own client seed, and a nonce counts up once per round. The outcome comes
              from those three values and nothing else — not your balance, not the time, not how
              much you have won today.
            </p>
            <p>
              When you rotate the seed, the old one is revealed. Anyone can then hash it to check it
              matches the commitment, and replay every round you played on it.
            </p>
            <p>
              <Link href="/verify" className="text-brand underline underline-offset-2">
                Check a round yourself →
              </Link>
            </p>
          </div>
        </Card>

        <Card tone="gold">
          <div className="border-b border-gold-line px-5 py-3.5">
            <Label className="text-gold/70">Playing sensibly</Label>
          </div>
          <div className="space-y-3 px-5 py-5 text-[14px] leading-relaxed text-ink-2">
            <p>
              Matty Coins have no cash value and cannot be bought, sold or transferred. Nothing here
              can cost you money, and nothing here can win you any.
            </p>
            <p>
              Play with coins you would be relaxed about losing entirely, because over enough
              rounds the house edge means you will. Lower it whenever you like — that takes effect immediately.
            </p>
            <p>
              Games can be switched off from your account instantly, for a day, a week, a month or
              permanently. The rest of the site keeps working exactly as it does now.
            </p>
            <p>
              <Link href="/me#limits" className="text-gold underline underline-offset-2">
                Limits and switching off →
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function GameCard({ game }: { game: GameConfig }) {
  const soon = Boolean(game.comingSoon);

  const inner = (
    <>
      <div className="relative aspect-square overflow-hidden">
        <GamePreview slug={game.slug} imageUrl={game.imageUrl} className="h-full" />
        {soon ? (
          <span className="absolute inset-0 grid place-items-center bg-bg/55 backdrop-blur-[1px]">
            <span className="rounded-[4px] border border-line-2 bg-surface/90 px-2.5 py-1.5 text-center font-mono text-[9.5px] uppercase leading-tight tracking-[0.16em] text-ink-2">
              Coming
              <br />
              soon
            </span>
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2.5">
        <h2 className="min-w-0 truncate text-[14px] font-semibold text-ink">{game.name}</h2>
        {soon ? null : (
          <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.12em] text-faint">
            {(game.rtp * 100).toFixed(0)}%
          </span>
        )}
      </div>
    </>
  );

  const shell = cn(
    'group block overflow-hidden rounded-[10px] border border-line bg-surface transition-all duration-200',
    soon
      ? 'cursor-default opacity-70'
      : 'hover:-translate-y-1 hover:border-brand/60 hover:shadow-[0_10px_28px_-8px_rgba(43,143,255,0.45)]',
  );

  return soon ? (
    <div className={shell} aria-disabled>{inner}</div>
  ) : (
    <Link href={`/games/${game.slug}`} className={shell} aria-label={`Play ${game.name}`}>
      {inner}
    </Link>
  );
}
