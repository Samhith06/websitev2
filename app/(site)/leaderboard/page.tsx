import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, TriangleAlert } from 'lucide-react';
import { dateRange, money, relativeTime } from '@/lib/format';
import {
  archivedPeriods, feedHealth, frozenPeriod, monthlyPeriod, razed, weeklyPeriod,
} from '@/lib/mock';
import { Display, Label, Num, SectionHeading } from '@/components/ui/typography';
import { ButtonLink, Chip, ChipRow } from '@/components/ui/controls';
import { Banner, Card, Hairlines, Stat } from '@/components/ui/surfaces';
import { RazedWordmark, RazedZ } from '@/components/ui/marks';
import { Countdown } from '@/components/ui/Countdown';
import { BoardRows, Podium, ProvenanceRow } from '@/components/site/Leaderboard';
import type { Period } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Leaderboards',
  description:
    'The weekly and monthly Razed wager leaderboards for MattySpins. Every figure comes straight from Razed — nothing is self-reported.',
};

type Tab = 'weekly' | 'monthly' | 'archive' | 'frozen';

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period } = await searchParams;
  const tab: Tab =
    period === 'monthly' ? 'monthly'
    : period === 'archive' ? 'archive'
    : period === 'frozen' ? 'frozen'
    : 'weekly';

  const active: Period =
    tab === 'monthly' ? monthlyPeriod : tab === 'frozen' ? frozenPeriod : weeklyPeriod;

  const stale = feedHealth.status !== 'healthy';

  return (
    <div className="container-page py-10 lg:py-14">
      {/* ------------------------------------------------------------- */}
      {/* Header block                                                  */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Label className="mb-3 flex items-center gap-2">
            <RazedZ size={16} />
            Razed · referral code {razed.referralCode} · all times UTC
          </Label>
          <Display size="l" as="h1">
            Leaderboards
          </Display>
        </div>

        <div className="flex flex-col items-start gap-2 lg:items-end">
          <ChipRow label="Board period">
            <Chip as="link" href="/leaderboard" active={tab === 'weekly'}>Weekly</Chip>
            <Chip as="link" href="/leaderboard?period=monthly" active={tab === 'monthly'}>Monthly</Chip>
            <Chip as="link" href="/leaderboard?period=archive" active={tab === 'archive'}>Archive</Chip>
          </ChipRow>
          {/* Not decoration — this timestamp is the page's credibility, so it
              has a fixed position and never disappears during a refresh. */}
          <span className="font-mono text-[11.5px] tabular-nums text-faint">
            Updated {relativeTime(feedHealth.lastSyncAt)}
          </span>
        </div>
      </div>

      {/* Silent staleness during a close finish is how you get accused of
          rigging, so it says so in gold, above the board. */}
      {stale ? (
        <Banner tone="gold" className="mt-6" icon={<TriangleAlert size={16} />}>
          <span className="text-ink">This board may be behind.</span> The last successful sync with
          Razed was {relativeTime(feedHealth.lastSyncAt)} ({feedHealth.code}). Positions will catch
          up automatically once the feed recovers.
        </Banner>
      ) : null}

      {tab === 'archive' ? <Archive /> : <BoardView period={active} />}

      {/* ------------------------------------------------------------- */}
      {/* Two cards below                                               */}
      {/* ------------------------------------------------------------- */}
      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <Card id="how">
          <div className="border-b border-line px-5 py-3.5">
            <Label>How the board works</Label>
          </div>
          <div className="space-y-3.5 px-5 py-5 text-[14px] leading-relaxed text-ink-2">
            <p>
              <span className="text-ink">Qualifying.</span> Sign up to Razed under the code{' '}
              {razed.referralCode} and wager as normal. Anything you wager counts from the moment
              the account is created; there is a $100 minimum to appear on the board at all.
            </p>
            <p>
              <span className="text-ink">Ties.</span> If two players finish on the same wagered
              total, the one who reached it first takes the higher position. Razed’s own timestamps
              decide it, not ours.
            </p>
            <p>
              <span className="text-ink">Freezing.</span> The board closes at the end of the period
              in UTC and freezes immediately. It then reads “verifying” for 72 hours while the final
              snapshot is checked, after which claims open.
            </p>
            <p>
              <span className="text-ink">Claiming.</span> You claim your position on this site by
              stating your full Razed username. A moderator checks it against the frozen snapshot
              before anything is paid. Unclaimed prizes roll into the next pot after 14 days.
            </p>
          </div>
        </Card>

        <Card tone="gold">
          <div className="border-b border-gold-line px-5 py-3.5">
            <Label className="text-gold/70">Last month’s winner</Label>
          </div>
          <div className="px-5 py-5">
            <Display size="s" as="p" className="text-ink">
              {archivedPeriods[2].rows[0].maskedUsername}
            </Display>
            <div className="mt-3 flex items-baseline gap-3">
              <Num tone="gold" className="text-[30px] leading-none">
                {money(archivedPeriods[2].rows[0].prize)}
              </Num>
              <span className="text-[13.5px] text-muted">
                on {money(archivedPeriods[2].rows[0].wagered)} wagered
              </span>
            </div>
            <p className="mt-4 text-[13.5px] leading-relaxed text-ink-2">
              Paid by bank transfer three days after the period closed. The full frozen board for
              that month stays in the archive permanently.
            </p>
            <Link
              href="/leaderboard?period=archive"
              className="mt-4 inline-flex items-center gap-1.5 text-[14px] text-gold transition-colors duration-150 hover:brightness-110"
            >
              See it in the archive
              <ArrowRight size={15} />
            </Link>
          </div>
        </Card>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-[3px] border border-line bg-surface px-5 py-4">
        <p className="text-[13.5px] text-muted">
          Prizes on this board are funded and paid by Matty personally, not by Razed.
        </p>
        <RazedWordmark size="sm" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function BoardView({ period }: { period: Period }) {
  const frozen = period.status === 'frozen';
  const archived = period.status === 'archived';

  return (
    <>
      {frozen ? (
        <Banner tone="brand" className="mt-6">
          <span className="text-ink">This period is closed and the ranks are locked.</span>{' '}
          Verifying — prizes are paid within 72 hours of the board freezing. If one of these
          positions is yours,{' '}
          <Link href="/leaderboard/claim" className="text-brand underline underline-offset-2">
            open a claim
          </Link>
          .
        </Banner>
      ) : null}

      {/* Period strip: date range, countdown, pot. */}
      <Hairlines cols="grid-cols-1 md:grid-cols-3" className="mt-6">
        <Stat label="Period" sub={period.type === 'weekly' ? 'Weekly board' : 'Monthly board'}>
          <span className="block font-mono text-[20px] tabular-nums text-ink lg:text-[22px]">
            {dateRange(period.startsAt, period.endsAt)}
          </span>
        </Stat>
        <Stat label={frozen || archived ? 'Closed' : 'Closes in'}>
          {frozen || archived ? (
            <span className="block font-mono text-[26px] leading-none tabular-nums text-muted lg:text-[30px]">
              Final
            </span>
          ) : (
            <Countdown to={period.endsAt} tone="brand" className="block text-[26px] leading-none lg:text-[30px]" />
          )}
        </Stat>
        <Stat label="Prize pool" value={money(period.pot)} tone="gold" />
      </Hairlines>

      <Podium rows={period.rows} className="mt-8" />

      <div className="mt-6 space-y-3">
        <BoardRows
          rows={period.rows}
          from={4}
          showMovement={!frozen && !archived}
          initialVisible={3}
        />
        <ProvenanceRow frozen={frozen} />
      </div>

      {frozen ? (
        <div className="mt-5">
          <ButtonLink href="/leaderboard/claim" variant="primary" size="lg">
            Claim a position
          </ButtonLink>
        </div>
      ) : null}
    </>
  );
}

/**
 * The archive is the proof that the prizes were real, and it is most of what
 * convinces a new viewer to sign up. Never delete a row from it.
 */
function Archive() {
  return (
    <div className="mt-8">
      <SectionHeading title="Closed periods" size="s" />
      <div className="mt-5 overflow-hidden rounded-[3px] border border-line">
        <div className="hidden grid-cols-[1.4fr_1fr_140px_120px_100px] bg-surface-2 lg:grid">
          {['Period', 'Winner', 'Wagered', 'Pot', ''].map((h, i) => (
            <div key={i} className="px-4 py-2.5">
              <Label>{h}</Label>
            </div>
          ))}
        </div>
        <div className="bg-surface">
          {archivedPeriods.map((p) => (
            <div
              key={p.id}
              className="grid gap-1 border-t border-line px-4 py-3.5 lg:grid-cols-[1.4fr_1fr_140px_120px_100px] lg:items-center lg:gap-0 lg:px-0 lg:py-0"
            >
              <div className="lg:px-4 lg:py-3.5">
                <span className="text-[14.5px] text-ink">{dateRange(p.startsAt, p.endsAt)}</span>
                <span className="ml-2 font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
                  {p.type}
                </span>
              </div>
              <div className="text-[14px] text-ink-2 lg:px-4 lg:py-3.5">{p.rows[0].maskedUsername}</div>
              <div className="font-mono text-[13.5px] tabular-nums text-ink-2 lg:px-4 lg:py-3.5">
                {money(p.rows[0].wagered)}
              </div>
              <div className="font-mono text-[13.5px] tabular-nums text-gold lg:px-4 lg:py-3.5">
                {money(p.pot)}
              </div>
              <div className="mt-1 lg:mt-0 lg:px-4 lg:py-3.5">
                <Link href={`/leaderboard?period=frozen`} className="text-[13.5px] text-brand hover:text-brand-dim">
                  View board
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-4 text-[13.5px] text-muted">
        Frozen boards are kept permanently. Nothing is ever removed from this list.
      </p>
    </div>
  );
}
