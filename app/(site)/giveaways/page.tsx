import Link from 'next/link';
import type { Metadata } from 'next';
import { ShieldCheck } from 'lucide-react';
import { coins, dateShort } from '@/lib/format';
import { giveaways, pastGiveaways} from '@/lib/mock';
import { currentStream } from '@/lib/store/stream';
import { viewerOrSignedOut } from '@/lib/viewer';
import { Display, Label, Num } from '@/components/ui/typography';
import { Button } from '@/components/ui/controls';
import { Card } from '@/components/ui/surfaces';
import { CoinMark } from '@/components/ui/marks';
import { Countdown } from '@/components/ui/Countdown';
import { CoinBar } from '@/components/site/CoinBar';
import { FairnessBlock } from '@/components/site/FairnessBlock';
import type { Giveaway } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Giveaways',
  description:
    'Spend Matty Coins on entries to the weekly and monthly draws. Every draw is provably fair — the seed is published before entries open.',
};

export const dynamic = 'force-dynamic';

export default async function GiveawaysPage() {
  const [viewer, stream] = await Promise.all([viewerOrSignedOut(), currentStream()]);
  return (
    <div className="container-page py-10 lg:py-14">
      <div className="max-w-2xl">
        <Label className="mb-3">Entries cost coins · draws are provably fair</Label>
        <Display size="l" as="h1">
          Giveaways
        </Display>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
          Coins buy entries, entries are rows in a table, and the winning row is picked by a seed
          published before entries even opened. Anyone can check the draw afterwards — including
          you, and including a draw you lost.
        </p>
      </div>

      <CoinBar viewer={viewer} live={stream.live} className="mt-8" />

      <div className="mt-8 space-y-5">
        {giveaways.map((giveaway) => (
          <ActiveGiveaway key={giveaway.id} giveaway={giveaway} balance={viewer.balance} signedIn={viewer.signedIn} />
        ))}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Past winners — never delete a row from this list              */}
      {/* ------------------------------------------------------------- */}
      <section className="mt-[72px]">
        <Display size="m" as="h2">
          Past winners
        </Display>
        <div className="mt-6 overflow-hidden rounded-[3px] border border-line">
          <div className="hidden grid-cols-[130px_1fr_1fr_140px_120px] bg-surface-2 lg:grid">
            {['Drawn', 'Draw', 'Prize', 'Winner', ''].map((h, i) => (
              <div key={i} className="px-4 py-2.5">
                <Label>{h}</Label>
              </div>
            ))}
          </div>
          <div className="bg-surface">
            {pastGiveaways.map((g) => (
              <div
                key={g.id}
                className="grid gap-1 border-t border-line px-4 py-4 lg:grid-cols-[130px_1fr_1fr_140px_120px] lg:items-center lg:gap-0 lg:px-0 lg:py-0"
              >
                <div className="font-mono text-[13px] tabular-nums text-muted lg:px-4 lg:py-3.5">
                  {dateShort(g.drawnAt!)}
                </div>
                <div className="text-[14px] text-ink-2 lg:px-4 lg:py-3.5">{g.title}</div>
                <div className="text-[14px] text-ink lg:px-4 lg:py-3.5">{g.prize}</div>
                <div className="font-mono text-[13.5px] text-gold lg:px-4 lg:py-3.5">{g.winnerMasked}</div>
                <div className="mt-1 lg:mt-0 lg:px-4 lg:py-3.5">
                  <Link
                    href={`/verify?seed=${g.serverSeed}&giveaway=${g.id}`}
                    className="text-[13.5px] text-brand hover:text-brand-dim"
                  >
                    Verify
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-[13.5px] leading-relaxed text-muted">
          Winners have seven days to claim, after which the prize is redrawn from the remaining
          entries. Nothing is ever removed from this list, including draws where the winner never
          came forward.
        </p>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ActiveGiveaway({
  giveaway,
  balance,
  signedIn,
}: {
  giveaway: Giveaway;
  balance: number;
  signedIn: boolean;
}) {
  const affordable = balance >= giveaway.entryCost;
  const atCap = giveaway.yourEntries >= giveaway.maxEntriesPerUser;

  return (
    <Card>
      <div className="grid gap-6 p-6 lg:grid-cols-[1.5fr_1fr] lg:items-center">
        <div>
          <Label className="mb-2">{giveaway.title}</Label>
          <Display size="s" as="h2">
            {giveaway.prize}
          </Display>

          <div className="mt-5 grid gap-px overflow-hidden rounded-[3px] border border-line bg-line sm:grid-cols-4 [&>div]:bg-surface-2">
            <Figure label="Entry cost">
              <span className="flex items-center gap-1.5">
                <CoinMark size={14} />
                <Num tone="brand">{coins(giveaway.entryCost)}</Num>
              </span>
            </Figure>
            <Figure label="Entries so far">
              <Num>{coins(giveaway.totalEntries)}</Num>
            </Figure>
            <Figure label="Your entries">
              <Num tone={giveaway.yourEntries > 0 ? 'gold' : 'muted'}>
                {giveaway.yourEntries} / {giveaway.maxEntriesPerUser}
              </Num>
            </Figure>
            <Figure label="Draws in">
              <Countdown to={giveaway.drawsAt} tone="ink" className="text-[15px]" />
            </Figure>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          {signedIn ? (
            <Button size="lg" full disabled={!affordable || atCap} className="lg:w-auto">
              {atCap
                ? 'Entry cap reached'
                : affordable
                  ? `Enter for ${coins(giveaway.entryCost)} MC`
                  : `Need ${coins(giveaway.entryCost - balance)} more MC`}
            </Button>
          ) : (
            <Button size="lg" variant="discord" full className="lg:w-auto">
              Sign in to enter
            </Button>
          )}
          <p className="max-w-xs text-[12.5px] leading-relaxed text-muted lg:text-right">
            Entries are capped at {giveaway.maxEntriesPerUser} per person, so a draw is never just
            whoever has the biggest balance.
          </p>
        </div>
      </div>

      <FairnessBlock
        serverSeedHash={giveaway.serverSeedHash}
        serverSeed={giveaway.serverSeed}
        icon={<ShieldCheck size={15} />}
      />
    </Card>
  );
}

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <Label className="mb-1.5">{label}</Label>
      <div className="text-[15px]">{children}</div>
    </div>
  );
}
