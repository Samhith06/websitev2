import Link from 'next/link';
import type { Metadata } from 'next';
import { publishedBigWins } from '@/lib/store/clips';
import { coins, dateShort, formatMultiplier, multiplier } from '@/lib/format';
import { Display, Label, Num } from '@/components/ui/typography';
import { Chip, ChipRow } from '@/components/ui/controls';
import { Card, EmptyState } from '@/components/ui/surfaces';
import { BigWinCard } from '@/components/site/BigWinCard';
import type { Clip } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Wall of fame',
  description:
    'Every big win from MattySpins, with the bet, the payout and the multiplier alongside the clip.',
};

type Sort = 'multiplier' | 'win' | 'date';

function sortWins(wins: Clip[], sort: Sort): Clip[] {
  const copy = [...wins];
  if (sort === 'win') return copy.sort((a, b) => (b.payout ?? 0) - (a.payout ?? 0));
  if (sort === 'date') return copy.sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt));
  return copy.sort(
    (a, b) => multiplier(b.bet ?? 0, b.payout ?? 0) - multiplier(a.bet ?? 0, a.payout ?? 0),
  );
}

/** Months are a chip row because "what did he hit in August" is a question people actually ask. */
function monthsOf(wins: Clip[]) {
  const set = new Map<string, string>();
  for (const win of wins) {
    const d = new Date(win.occurredAt);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    set.set(key, d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }));
  }
  return [...set.entries()];
}

export const dynamic = 'force-dynamic';

export default async function WinsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; month?: string }>;
}) {
  const { sort: sortParam, month } = await searchParams;
  const sort: Sort = sortParam === 'win' ? 'win' : sortParam === 'date' ? 'date' : 'multiplier';

  const published = await publishedBigWins(120);
  const months = monthsOf(published);
  const filtered = month
    ? published.filter((w) => w.occurredAt.slice(0, 7) === month)
    : published;
  const wins = sortWins(filtered, sort);

  const biggestMultiplier = sortWins(published, 'multiplier')[0];
  const biggestWin = sortWins(published, 'win')[0];

  return (
    <div className="container-page py-10 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Label className="mb-3">Real bets, real payouts, on stream</Label>
          <Display size="l" as="h1">
            Wall of fame
          </Display>
        </div>

        <ChipRow label="Sort wins">
          <Chip as="link" href="/wins" active={sort === 'multiplier' && !month}>By multiplier</Chip>
          <Chip as="link" href="/wins?sort=win" active={sort === 'win'}>By win</Chip>
          <Chip as="link" href="/wins?sort=date" active={sort === 'date'}>By date</Chip>
        </ChipRow>
      </div>

      {/* Record cards, pinned above the grid — but only once there is a record
          to hold. "Biggest ever" over an empty wall is a claim about nothing. */}
      {biggestMultiplier && biggestWin ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <RecordCard label="Biggest multiplier ever" win={biggestMultiplier} kind="multiplier" />
          <RecordCard label="Biggest win ever" win={biggestWin} kind="win" />
        </div>
      ) : null}

      {months.length > 1 ? (
        <ChipRow label="Filter by month" className="mt-8">
          <Chip as="link" href={`/wins?sort=${sort}`} active={!month}>
            All time
          </Chip>
          {months.map(([key, label]) => (
            <Chip key={key} as="link" href={`/wins?sort=${sort}&month=${key}`} active={month === key}>
              {label}
            </Chip>
          ))}
        </ChipRow>
      ) : null}

      {wins.length === 0 ? (
        <EmptyState className="mt-10" title="No wins on the wall yet.">
          Big wins are added from the admin clip editor, with the bet and the payout that produced
          them. Nothing is listed here until one is.
        </EmptyState>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {wins.map((win) => (
            <BigWinCard key={win.id} win={win} variant="compact" />
          ))}
        </div>
      )}

      <p className="mt-10 max-w-2xl text-[13.5px] leading-relaxed text-muted">
        Every multiplier on this page is calculated from the bet and the payout beside it, never
        typed in by hand — so the three figures can never disagree with each other.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function RecordCard({
  label,
  win,
  kind,
}: {
  label: string;
  win: Clip;
  kind: 'multiplier' | 'win';
}) {
  const figure =
    kind === 'multiplier' ? formatMultiplier(win.bet ?? 0, win.payout ?? 0) : coins(win.payout ?? 0);

  return (
    <Card tone="gold" className="p-6">
      <Label className="text-gold/70">{label}</Label>
      <Num tone="gold" className="mt-4 block text-[46px] font-bold leading-none lg:text-[56px]">
        {figure}
      </Num>
      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-3 border-t border-gold-line pt-4">
        <span className="text-[14.5px] text-ink">{win.slotName}</span>
        <span className="font-mono text-[12.5px] tabular-nums text-muted">
          {coins(win.bet ?? 0)} bet · {dateShort(win.occurredAt)}
        </span>
      </div>
      <Link
        href={`/wins?sort=${kind}`}
        className="mt-3 inline-flex text-[13.5px] text-gold underline underline-offset-2 hover:brightness-110"
      >
        Watch the clip →
      </Link>
    </Card>
  );
}
