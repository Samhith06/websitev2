import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { coins, maybe, money, relativeTime } from '@/lib/format';
import {
  prizeTiers, razed, schedule, siteStats, stream, weeklyPeriod, socials, aboutCopy,
  portraitUrl,
} from '@/lib/mock';
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

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [viewer, clips, bigWins] = await Promise.all([
    viewerOrSignedOut(),
    publishedClips(12),
    publishedBigWins(3),
  ]);
  const featured = bigWins[0];
  const compactWins = bigWins.slice(1, 3);

  // The same server-side call the full board makes, so the preview and the
  // board can never disagree, and the timestamp below is a real one.
  const feed = await fetchRazedLeaderboard({
    from: weeklyPeriod.startsAt.slice(0, 10),
    to: weeklyPeriod.endsAt.slice(0, 10),
  });
  const feedHealth = healthFrom(feed);
  const boardRows = feed.ok
    ? toBoardRows(feed.rows, (rank) =>
        prizeTiers.find((t) => rank >= t.rankFrom && rank <= t.rankTo)?.amount ?? 0)
    : [];

  return (
    <>
      <Hero stream={stream} viewer={viewer} schedule={schedule} />

      {/* ----------------------------------------------------------------- */}
      {/* Stat strip — two columns on mobile, four across on desktop         */}
      {/* ----------------------------------------------------------------- */}
      <div className="container-page mt-[56px]">
        <Hairlines cols="grid-cols-2 lg:grid-cols-4">
          <Stat label="Weekly prize pool" value={maybe(siteStats.weeklyPrizePool, money)} tone="gold" />
          <Stat label="Board resets in">
            <Countdown to={weeklyPeriod.endsAt} className="block text-[26px] leading-none lg:text-[30px]" />
          </Stat>
          <Stat label="Members earning" value={maybe(siteStats.membersEarning)} />
          <Stat label="Paid out to date" value={maybe(siteStats.paidOutToDate, money)} tone="gold" />
        </Hairlines>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Weekly board preview                                              */}
      {/* ----------------------------------------------------------------- */}
      <Section>
        <SectionHeading
          eyebrow={
            <>
              <RazedZ size={16} />
              Wagered on Razed under code {razed.referralCode}
            </>
          }
          title="This week's board"
          right={
            <ChipRow label="Board period">
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
          <EmptyState className="mt-10" title="No board to show yet.">
            Positions come straight from Razed for accounts registered under the code{' '}
            {razed.referralCode}. Nothing appears here until that feed returns players.
          </EmptyState>
        ) : (
          <>
            <Podium rows={boardRows} className="mt-10" />
            <BoardRows rows={boardRows.slice(0, 6)} from={4} className="mt-5" />
          </>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono text-[11.5px] tabular-nums text-faint">
            Updated {relativeTime(feedHealth.lastSyncAt)} · all times UTC
          </span>
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-1.5 text-[14px] text-brand transition-colors duration-150 hover:text-brand-dim"
          >
            View the full board
            <ArrowRight size={15} />
          </Link>
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
            figure="1 MC"
            unit="every 3 minutes"
            body="Say anything in Matty's Kick chat and you start earning. Each message keeps you earning for the next fifteen minutes, and the bot drops a claim word every twenty so quiet viewers never have to spam."
          />
          <CoinRule
            figure="+10 MC"
            unit="for a full hour"
            body="Twenty ticks in a row with no gap pays a bonus on top. Miss a tick and the run resets — it rewards actually being here, not leaving a tab open."
          />
          <CoinRule
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
            title="Clips"
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
      {/* Biggest wins — a full-bleed band                                  */}
      {/* ----------------------------------------------------------------- */}
      {bigWins.length > 0 ? (
      <Section bleed>
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

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
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
                when a higher-resolution original arrives. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={portraitUrl}
              alt="Matty"
              width={472}
              height={513}
              className="mx-auto w-full max-w-[472px] rounded-[3px] border border-line object-cover"
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

              <Card>
                <div className="border-b border-line px-5 py-3">
                  <Label>Where to find him</Label>
                </div>
                <div className="px-5 py-4">
                  {socials.map((social) => (
                    <a
                      key={social.platform}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 py-1.5 text-ink-2 transition-colors duration-150 hover:text-brand-dim"
                    >
                      <PlatformMark platform={social.platform} size={15} />
                      <span className="font-mono text-[12.5px]">{social.handle}</span>
                    </a>
                  ))}
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
      {/* Razed strip                                                       */}
      {/* ----------------------------------------------------------------- */}
      <Section>
        <Card tone="brand" className="p-6 lg:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-center">
            <div>
              <Display size="s" as="h2">
                Play on Razed under code <span className="text-brand">{razed.referralCode}</span>
              </Display>
              <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-ink-2">
                {razed.offer}. Sign up under the code and every dollar you wager counts towards the
                weekly board automatically — there is nothing to link and nothing to claim until the
                period closes.
              </p>
            </div>
            <div className="flex flex-col items-start gap-4 lg:items-end">
              <RazedWordmark />
              <ButtonLink href={razed.affiliateUrl} external variant="primary" size="lg">
                Claim the bonus
              </ButtonLink>
            </div>
          </div>
        </Card>
      </Section>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function CoinRule({
  figure,
  unit,
  body,
  brand = false,
}: {
  figure: string;
  unit: string;
  body: string;
  brand?: boolean;
}) {
  return (
    <div className={brand ? 'relative px-5 py-6' : 'px-5 py-6'}>
      {/* The sub incentive is visually louder than the other two. */}
      {brand ? <span className="absolute inset-0 bg-brand-bg" aria-hidden /> : null}
      <div className="relative">
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
