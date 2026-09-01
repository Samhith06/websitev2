import Link from 'next/link';
import { ArrowRight, Award, Sparkles, Timer } from 'lucide-react';
import { maybe, money, relativeTime } from '@/lib/format';
import {
  razed, schedule, socials, aboutCopy, portraitUrl, discordInvite,
} from '@/lib/mock';
import { currentStream } from '@/lib/store/stream';
import { currentPeriod, paidOutToDate, prizeForRank } from '@/lib/store/periods';
import { earnersNow } from '@/lib/store/presence';
import { hasDatabase } from '@/lib/db';
import { publishedBigWins, publishedClips } from '@/lib/store/clips';
import { viewerOrSignedOut } from '@/lib/viewer';
import { fetchRazedLeaderboard, healthFrom, toBoardRows } from '@/lib/razed';
import { Display, Label, Num, SectionHeading } from '@/components/ui/typography';
import { ButtonLink, Chip, ChipRow } from '@/components/ui/controls';
import { Card, EmptyState, Hairlines, Stat } from '@/components/ui/surfaces';
import { CoinMark, PlatformMark, RazedWordmark, RazedZ } from '@/components/ui/marks';
import { Countdown } from '@/components/ui/Countdown';
import { Hero } from '@/components/site/Hero';
import { Section } from '@/components/site/Section';
import { Podium, BoardRows } from '@/components/site/Leaderboard';
import { ClipCarousel } from '@/components/site/ClipCard';
import { BigWinCard } from '@/components/site/BigWinCard';
import { WatchLive } from '@/components/site/WatchLive';
import { Socials } from '@/components/site/Socials';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [viewer, clips, bigWins, stream] = await Promise.all([
    viewerOrSignedOut(),
    publishedClips(12),
    publishedBigWins(3),
    currentStream(),
  ]);
  const featured = bigWins[0];
  const compactWins = bigWins.slice(1, 3);

  // The same server-side call the full board makes, over the same stored
  // period, so the preview and the board can never disagree.
  const weeklyPeriod = await currentPeriod('weekly');

  // Three figures that were placeholders until the tables behind them existed.
  // Each is now derived, and each is null rather than zero when unknowable.
  const [earning, paidOut] = hasDatabase()
    ? await Promise.all([earnersNow(), paidOutToDate()])
    : [null, null];
  const feed = weeklyPeriod
    ? await fetchRazedLeaderboard({
        from: weeklyPeriod.startsAt.slice(0, 10),
        to: weeklyPeriod.endsAt.slice(0, 10),
      })
    : null;
  const feedHealth = feed ? healthFrom(feed) : null;
  const boardRows = feed?.ok
    ? toBoardRows(feed.rows, (rank) => prizeForRank(weeklyPeriod!.tiers, rank))
    : [];

  return (
    <>
      <Hero stream={stream} viewer={viewer} schedule={schedule} />

      {/* ----------------------------------------------------------------- */}
      {/* Stat strip — two columns on mobile, four across on desktop         */}
      {/* ----------------------------------------------------------------- */}
      <div className="container-page mt-[56px]">
        <Hairlines cols="grid-cols-2 lg:grid-cols-4">
          <Stat label="Weekly prize pool" value={maybe(weeklyPeriod?.pot ?? null, money)} tone="gold" />
          <Stat label="Board resets in">
            {weeklyPeriod ? (
              <Countdown to={weeklyPeriod.endsAt} className="block text-[26px] leading-none lg:text-[30px]" />
            ) : (
              <span className="block font-mono text-[26px] leading-none text-muted lg:text-[30px]">—</span>
            )}
          </Stat>
          <Stat label="Earning right now" value={maybe(earning)} />
          <Stat label="Paid out to date" value={maybe(paidOut, money)} tone="gold" />
        </Hairlines>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Weekly board preview — podium beside the table                     */}
      {/* ----------------------------------------------------------------- */}
      <Section>
        <SectionHeading
          className="border-b border-line pb-5"
          eyebrow={
            <>
              <RazedZ size={16} />
              Wagered on Razed under code {razed.referralCode}
            </>
          }
          title="Leaderboard"
          right={
            <ChipRow label="Board period" className="rounded-[3px] border border-line bg-surface-2 p-1">
              <Chip as="link" href="/leaderboard" active>
                Weekly
              </Chip>
              <Chip as="link" href="/leaderboard?period=monthly">
                Monthly
              </Chip>
            </ChipRow>
          }
        />

        {boardRows.length === 0 ? (
          <EmptyState className="mt-8" title="No board to show yet.">
            Positions come straight from Razed for accounts registered under the code{' '}
            {razed.referralCode}. Nothing appears here until that feed returns players.
          </EmptyState>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-12 lg:items-start">
            <Podium rows={boardRows} variant="compact" className="lg:col-span-5" />
            <BoardRows
              rows={boardRows.slice(0, 6)}
              from={4}
              showMovement={false}
              className="rounded-[3px] lg:col-span-7"
              footer={
                <Link
                  href="/leaderboard"
                  className="group flex items-center justify-center gap-1.5 px-4 py-3.5 font-mono text-[11px] uppercase tracking-[0.16em] text-brand transition-colors duration-150 hover:bg-surface-2 hover:text-brand-dim"
                >
                  View the full board
                  <ArrowRight size={14} className="transition-transform duration-150 group-hover:translate-x-0.5" />
                </Link>
              }
            />
          </div>
        )}

        <div className="mt-4">
          <span className="font-mono text-[11.5px] tabular-nums text-faint">
            {feedHealth ? `Updated ${relativeTime(feedHealth.lastSyncAt)} · all times UTC` : 'No board is open'}
          </span>
        </div>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* How coins work                                                    */}
      {/* ----------------------------------------------------------------- */}
      <Section>
        <SectionHeading
          eyebrow={
            <>
              <CoinMark size={15} />
              Matty Coins
            </>
          }
          title="How coins work"
        />

        <Hairlines cols="md:grid-cols-3" className="mt-8">
          <CoinRule
            icon={<Timer size={19} aria-hidden />}
            figure="1 MC"
            unit="every 3 minutes"
            body="Say anything in Matty's Kick chat and you start earning. Each message keeps you earning for the next fifteen minutes, and the bot drops a claim word every twenty so quiet viewers never have to spam."
          />
          <CoinRule
            icon={<Sparkles size={19} aria-hidden />}
            figure="+10 MC"
            unit="for a full hour"
            body="Twenty ticks in a row with no gap pays a bonus on top. Miss a tick and the run resets — it rewards actually being here, not leaving a tab open."
          />
          <CoinRule
            icon={<Award size={19} aria-hidden />}
            figure="2×"
            unit="everything, for subs"
            brand
            body="Any sub tier doubles every coin you earn. VIPs earn 2.5×. Multipliers never stack: the highest single one applies, so a VIP who also subs earns 2.5×, not 5×."
          />
        </Hairlines>

        <p className="mt-5 max-w-2xl text-[13.5px] leading-relaxed text-muted">
          Coins cannot be bought. There are no packages, no top-ups and no payment path — they are
          earned by turning up and nothing else. They have no cash value and cannot be transferred.
        </p>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* Clips                                                             */}
      {/* ----------------------------------------------------------------- */}
      {clips.length > 0 ? (
        <Section>
          <SectionHeading
            title="Top clips"
            right={
              <ChipRow label="Clip source">
                <Chip active as="link" href="/clips">All</Chip>
                <Chip as="link" href="/clips?source=kick">Kick</Chip>
                <Chip as="link" href="/clips?source=youtube">YouTube</Chip>
                <Chip as="link" href="/clips?source=instagram">Instagram</Chip>
                <Chip as="link" href="/clips?source=x">X</Chip>
              </ChipRow>
            }
          />
          <div className="mt-8">
            <ClipCarousel clips={clips} label="Recent clips" />
          </div>
        </Section>
      ) : null}

      {/* ----------------------------------------------------------------- */}
      {/* Biggest wins — one panel, a featured card and two beside it        */}
      {/* ----------------------------------------------------------------- */}
      {bigWins.length > 0 ? (
        <Section>
          <Card className="p-5 lg:p-7">
            <SectionHeading
              eyebrow="Real bets, real payouts, on stream"
              title="Biggest wins"
              right={
                <ChipRow label="Sort wins">
                  <Chip active as="link" href="/wins?sort=multiplier">By multiplier</Chip>
                  <Chip as="link" href="/wins?sort=win">By win</Chip>
                  <Chip as="link" href="/wins">All time</Chip>
                </ChipRow>
              }
            />

            <div className="mt-7 grid gap-5 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <BigWinCard win={featured} variant="featured" />
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
                {compactWins.map((win) => (
                  <BigWinCard key={win.id} win={win} variant="compact" />
                ))}
              </div>
            </div>

            <div className="mt-6">
              <ButtonLink href="/wins" variant="outline">
                See the wall of fame
                <ArrowRight size={15} />
              </ButtonLink>
            </div>
          </Card>
        </Section>
      ) : null}

      {/* ----------------------------------------------------------------- */}
      {/* About Matty                                                       */}
      {/* ----------------------------------------------------------------- */}
      <Section>
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            {/* Capped at the file's own width so it is never upscaled — a
                sharp smaller picture beats a soft larger one. Raise the cap
                when a higher-resolution original arrives. The portrait sits
                desaturated until you look at it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={portraitUrl}
              alt="Matty"
              width={472}
              height={513}
              className="mx-auto w-full max-w-[472px] rounded-[3px] border border-line object-cover grayscale transition-[filter] duration-500 hover:grayscale-0"
            />
          </div>

          <div className="lg:col-span-7">
            <Label className="mb-3">About</Label>
            <Display size="m" as="h2">
              About Matty
            </Display>
            <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-ink-2">
              {aboutCopy.map((para) => (
                <p key={para.slice(0, 24)}>{para}</p>
              ))}
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <Card>
                <div className="border-b border-line px-5 py-3">
                  <Label>Stream schedule</Label>
                </div>
                <div className="px-5 py-4">
                  {schedule.map((slot) => (
                    <div key={slot.day} className="flex items-baseline justify-between gap-3 py-1.5">
                      <span className="text-[14px] text-ink-2">{slot.day}</span>
                      <Num tone="brand" className="text-[13.5px]">
                        {slot.time}
                      </Num>
                    </div>
                  ))}
                  <p className="mt-3 border-t border-line pt-3 font-mono text-[11.5px] text-faint">
                    All times UK. Extra streams get announced in Discord.
                  </p>
                </div>
              </Card>

              {/* The platform handles are the socials band a screen below;
                  repeating them here would be the same list twice. What is
                  genuinely only here is Discord — the one place that is a
                  room rather than a feed. */}
              <Card>
                <div className="border-b border-line px-5 py-3">
                  <Label>Community</Label>
                </div>
                <div className="px-5 py-4">
                  <a
                    href={discordInvite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 py-1.5 text-ink-2 transition-colors duration-150 hover:text-brand-dim"
                  >
                    <PlatformMark platform="discord" size={15} />
                    <span className="font-mono text-[12.5px]">Join the Discord</span>
                  </a>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">
                    Extra streams, giveaway draws and prize claims all get announced there first.
                  </p>
                  <Link
                    href="/official"
                    className="mt-3 block border-t border-line pt-3 font-mono text-[11.5px] text-faint hover:text-brand-dim"
                  >
                    Check an account is really his →
                  </Link>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* Watch live — the player and the chat, full width                  */}
      {/* ----------------------------------------------------------------- */}
      <Section>
        <SectionHeading
          eyebrow={
            <>
              <PlatformMark platform="kick" size={15} />
              Catch the action as it happens
            </>
          }
          title="Watch live"
        />
        <div className="mt-8">
          <WatchLive stream={stream} />
        </div>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* Razed strip                                                       */}
      {/* ----------------------------------------------------------------- */}
      <Section>
        <Card tone="inset" className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between lg:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
            <RazedWordmark size="lg" className="shrink-0" />
            <div>
              <Display size="s" as="h2">
                Play on Razed under code <span className="text-brand">{razed.referralCode}</span>
              </Display>
              <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink-2">
                {razed.offer}. Sign up under the code and every dollar you wager counts towards the
                weekly board automatically — there is nothing to link and nothing to claim until the
                period closes.
              </p>
            </div>
          </div>
          <ButtonLink
            href={razed.affiliateUrl}
            external
            variant="primary"
            size="lg"
            className="shrink-0 whitespace-nowrap"
          >
            Claim the bonus
          </ButtonLink>
        </Card>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* Socials                                                           */}
      {/* ----------------------------------------------------------------- */}
      <Section>
        <SectionHeading
          eyebrow="Follow the action everywhere"
          title="Socials"
          right={
            <ButtonLink href="/official" variant="outline">
              Check an account is his
            </ButtonLink>
          }
        />
        <div className="mt-8">
          <Socials socials={socials} />
        </div>
      </Section>
    </>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * One rule per tile: a marked icon, the figure and its unit as the heading,
 * then the sentence that qualifies it. The sub incentive is the only one
 * painted, because it is the only one that costs money.
 */
function CoinRule({
  icon,
  figure,
  unit,
  body,
  brand = false,
}: {
  icon: React.ReactNode;
  figure: string;
  unit: string;
  body: string;
  brand?: boolean;
}) {
  return (
    <div className={brand ? 'relative px-5 py-6' : 'px-5 py-6'}>
      {brand ? <span className="absolute inset-0 bg-brand-bg" aria-hidden /> : null}
      <div className="relative">
        <span
          className={
            brand
              ? 'mb-4 grid size-10 place-items-center rounded-full border border-brand-line bg-brand/10 text-brand'
              : 'mb-4 grid size-10 place-items-center rounded-full border border-line bg-surface-2 text-ink-2'
          }
        >
          {icon}
        </span>
        <div className="flex items-baseline gap-2">
          <Num tone={brand ? 'brand' : 'ink'} className="text-[30px] font-medium leading-none lg:text-[34px]">
            {figure}
          </Num>
          <span className="text-[14px] text-muted">{unit}</span>
        </div>
        <p className="mt-4 text-[13.5px] leading-relaxed text-ink-2">{body}</p>
      </div>
    </div>
  );
}
