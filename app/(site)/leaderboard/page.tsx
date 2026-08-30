import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, TriangleAlert } from 'lucide-react';
import { dateRange, money, relativeTime } from '@/lib/format';
import { razed } from '@/lib/mock';
import {
  archivedPeriods, currentPeriod, frozenPeriod, prizeForRank, toUiPeriod,
} from '@/lib/store/periods';
import { fetchRazedLeaderboard, healthFrom, toBoardRows } from '@/lib/razed';
import { Display, Label, SectionHeading } from '@/components/ui/typography';
import { ButtonLink, Chip, ChipRow } from '@/components/ui/controls';
import { Banner, Card, EmptyState, Hairlines, Stat } from '@/components/ui/surfaces';
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

  /**
   * The period is a stored decision, not a clock. Its dates are what get sent
   * to Razed as from/to, so a board with no period configured asks Razed
   * nothing rather than inventing a window.
   */
  const [base, archive] = await Promise.all([
    tab === 'frozen' ? frozenPeriod() : currentPeriod(tab === 'monthly' ? 'monthly' : 'weekly'),
    tab === 'archive' ? archivedPeriods() : Promise.resolve([]),
  ]);

  /**
   * Straight from Razed, server-side, on every request. The key never reaches
   * the browser and the browser never talks to Razed.
   */
  const feed = base
    ? await fetchRazedLeaderboard({
        from: base.startsAt.slice(0, 10),
        to: base.endsAt.slice(0, 10),
      })
    : null;
  const feedHealth = feed
    ? healthFrom(feed)
    : { lastSyncAt: new Date().toISOString(), status: 'stale' as const, code: 'No period is open, so there is no window to ask Razed about.' };

  const liveRows = feed?.ok ? toBoardRows(feed.rows, (rank) => prizeForRank(base!.tiers, rank)) : [];
  const active: Period | null = base ? toUiPeriod(base, liveRows) : null;
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
          <span className="text-ink">
            {feed?.ok
              ? 'This board may be behind.'
              : 'The board cannot be shown right now.'}
          </span>{' '}
          {feedHealth.code} Nothing is invented while the feed is unavailable — the positions below
          are whatever Razed last returned, and the timestamp above says when that was.
        </Banner>
      ) : null}

      {tab === 'archive'
        ? <Archive periods={archive.map((p) => toUiPeriod(p, []))} />
        : active
          ? <BoardView period={active} />
          : <NoPeriod />}

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

        {/* No period has closed on this site yet. Rather than dress the space
            with a winner nobody won, it says what will appear here. */}
        <Card>
          <div className="border-b border-line px-5 py-3.5">
            <Label>Last month&rsquo;s winner</Label>
          </div>
          <div className="px-5 py-5">
            <p className="text-[14px] leading-relaxed text-ink-2">
              No period has closed yet. When the first monthly board freezes and its prize is paid,
              the winner and their wagered total appear here, and the frozen board itself stays in
              the archive permanently.
            </p>
            <Link
              href="/leaderboard?period=archive"
              className="mt-4 inline-flex items-center gap-1.5 text-[14px] text-brand transition-colors duration-150 hover:text-brand-dim"
            >
              Open the archive
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

      {period.rows.length === 0 ? (
        <EmptyState className="mt-8" title="No board to show yet.">
          Positions come straight from Razed for accounts registered under the code{' '}
          {razed.referralCode}. Nothing appears here until that feed returns players — we do not
          fill the gap with placeholders.
        </EmptyState>
      ) : (
        <>
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
        </>
      )}

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
 * No period has been opened yet, which is different from a period with nobody
 * on it: there is no window to ask Razed about at all. Admin is where that gets
 * fixed, so the copy says so rather than looking like a failed feed.
 */
function NoPeriod() {
  return (
    <EmptyState className="mt-8" title="No board is open.">
      A leaderboard needs a period — a start date, an end date and its prize tiers. Once one is
      opened in admin, the positions here come straight from Razed for that window.
    </EmptyState>
  );
}

/**
 * The archive is the proof that the prizes were real, and it is most of what
 * convinces a new viewer to sign up. Never delete a row from it.
 */
function Archive({ periods }: { periods: Period[] }) {
  // Empty until a period actually freezes. An archive is evidence, so it shows
  // nothing rather than an example of what evidence would look like.
  if (periods.length === 0) {
    return (
      <div className="mt-8">
        <SectionHeading title="Closed periods" size="s" />
        <EmptyState className="mt-5" title="Nothing has closed yet.">
          The first board to freeze lands here and stays permanently. Frozen boards are never
          edited and never removed.
        </EmptyState>
      </div>
    );
  }

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
          {periods.map((p) => (
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
              <div className="text-[14px] text-ink-2 lg:px-4 lg:py-3.5">{p.rows[0]?.maskedUsername ?? '—'}</div>
              <div className="font-mono text-[13.5px] tabular-nums text-ink-2 lg:px-4 lg:py-3.5">
                {p.rows[0] ? money(p.rows[0].wagered) : '—'}
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
