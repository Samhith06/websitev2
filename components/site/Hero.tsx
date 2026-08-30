import Link from 'next/link';
import { Users, Zap } from 'lucide-react';
import { coins } from '@/lib/format';
import { Display, Label, Num } from '@/components/ui/typography';
import { CoinMark, PlatformMark } from '@/components/ui/marks';
import { CountdownBoxes, Uptime } from '@/components/ui/Countdown';
import { PlayerFrame } from './PlayerFrame';
import type { StreamState, Viewer } from '@/lib/types';

/**
 * The hero is genuinely two screens, not one screen with a flag (UI Spec §4,
 * §5). The site is offline more hours than it is live, and the offline state
 * has a different job: say when he is back, and give them something to do
 * until then.
 */
export function Hero({
  stream,
  viewer,
  schedule,
}: {
  stream: StreamState;
  viewer: Viewer;
  schedule: Array<{ day: string; time: string; note: string; platform: string }>;
}) {
  const live = stream.live;

  return (
    <div className="hero-glow border-b border-line">
      <div className="container-page grid gap-9 py-10 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-12 lg:py-16">
        {/* ------------------------------------------------------------- */}
        {/* Left                                                          */}
        {/* ------------------------------------------------------------- */}
        <div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {live ? (
              <>
                <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-online">
                  <span className="size-1.5 animate-pulse-online rounded-full bg-online" aria-hidden />
                  Live on Kick
                </span>
                {/* Kick's webhook carries no viewer count, so when we do not
                    have one the whole element goes rather than showing a
                    number nobody measured. */}
                {stream.viewers !== null ? (
                  <>
                    <span className="text-line" aria-hidden>|</span>
                    <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-2">
                      <Users size={13} className="text-muted" aria-hidden />
                      <Num tone="ink" className="text-[11px]">{coins(stream.viewers)}</Num> viewers
                    </span>
                  </>
                ) : null}
              </>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-[5px] border border-line bg-surface-2 px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-2">
                <span className="size-1.5 rounded-full bg-faint" aria-hidden />
                Stream schedule
              </span>
            )}
          </div>

          {live ? (
            <Display size="xl" as="h1" className="mt-4">
              The biggest
              <br />
              slots battles
              <br />
              <span className="text-brand-dim">on the internet</span>
            </Display>
          ) : (
            <>
              <Display size="xl" as="h1" className="mt-4">
                Back live
                <br />
                <span className="text-brand-dim">{nextStreamLabel(stream.nextStreamAt)}</span>
              </Display>
              <CountdownBoxes to={stream.nextStreamAt} className="mt-5" />
            </>
          )}

          <p className="mt-5 max-w-[52ch] text-[15px] leading-relaxed text-brand-dim lg:text-[16px]">
            {live ? (
              <>
                Join the daily streams, rack up Matty Coins just by watching, and compete on the
                leaderboard for thousands in weekly prizes.
              </>
            ) : (
              <>
                Last session finished on a 2,431× Gates hit — the clip is on the wall of fame. The
                board, the shop and the giveaways all keep running while the stream is down; only
                coin earning pauses until he is back on.
              </>
            )}
          </p>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link
              href={live ? `https://kick.com/${stream.channel}` : '/wins'}
              {...(live ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="inline-flex h-10 items-center gap-2 rounded-[5px] bg-brand px-5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-brand-ink transition-colors duration-150 hover:bg-brand-dim"
            >
              {live ? (
                <>
                  <PlatformMark platform="kick" size={14} />
                  Watch live
                </>
              ) : (
                'Wall of fame'
              )}
            </Link>
            <Link
              href="/leaderboard"
              className="inline-flex h-10 items-center rounded-[5px] border border-brand/50 px-5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-brand transition-colors duration-150 hover:border-brand hover:bg-brand-bg"
            >
              See board
            </Link>
          </div>

          {/* The single most valuable element on the page — the only place the
              viewer watches the mechanic working in real time. */}
          <div className="mt-7">
            {live ? <EarningStatus viewer={viewer} /> : <ScheduleStrip schedule={schedule} />}
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* Right                                                         */}
        {/* ------------------------------------------------------------- */}
        <div>
          <PlayerFrame
            thumbUrl={live ? stream.thumbUrl : stream.lastVodThumb}
            embedUrl={live ? `https://player.kick.com/${stream.channel}` : stream.lastVodUrl}
            title={(live ? stream.title : stream.lastVodTitle) ?? 'MattySpins on Kick'}
            liveTag={live}
            playSize={58}
            watching={live ? stream.viewers ?? undefined : undefined}
            cornerLabel={live ? undefined : 'Watch last stream'}
          />
          <div className="mt-2.5 flex items-baseline justify-between gap-4">
            <p className="min-w-0 truncate font-mono text-[11.5px] uppercase tracking-[0.12em] text-ink-2">
              {(live ? stream.title : stream.lastVodTitle) ?? 'MattySpins on Kick'}
            </p>
            {live && stream.startedAt ? (
              <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-muted">
                Uptime: <Uptime from={stream.startedAt} className="text-[11.5px] text-ink-2" />
              </span>
            ) : (
              <span className="shrink-0 font-mono text-[11.5px] text-faint">Last stream</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function EarningStatus({ viewer }: { viewer: Viewer }) {
  if (!viewer.signedIn) {
    return (
      <StatusCard
        href="/api/auth/signin?callbackUrl=%2F"
        icon={<PlatformMark platform="discord" size={16} className="text-brand" />}
        label="Earning status"
      >
        <span className="text-ink">Sign in to start earning</span>
        <span className="ml-2 text-muted">— it takes about a minute</span>
      </StatusCard>
    );
  }

  if (!viewer.kick) {
    return (
      <StatusCard href="/me" icon={<CoinMark size={16} />} label="Earning status" tone="gold">
        <span className="text-ink">Link your Kick account to start earning</span>
      </StatusCard>
    );
  }

  if (viewer.frozen.frozen) {
    return (
      <StatusCard href="/me" icon={<Zap size={15} className="text-danger" />} label="Earning status" tone="danger">
        <span className="text-ink">Earning is paused on your account</span>
      </StatusCard>
    );
  }

  return (
    <StatusCard icon={<CoinMark size={16} />} label="Earning status">
      <span className="text-ink">You&rsquo;re earning </span>
      <Num tone="brand" className="text-[14.5px] font-medium">{viewer.multiplier.value} MC</Num>
      <span className="text-ink"> every 3 min</span>
      {viewer.multiplier.value > 1 ? (
        <span className="text-muted"> · {viewer.multiplier.label.toLowerCase()}</span>
      ) : null}
    </StatusCard>
  );
}

function StatusCard({
  icon,
  label,
  children,
  href,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  href?: string;
  tone?: 'default' | 'gold' | 'danger';
}) {
  const tones = {
    default: 'border-line bg-surface/70 hover:border-brand-line',
    gold: 'border-gold-line bg-gold-bg hover:border-gold',
    danger: 'border-danger-line bg-danger-bg hover:border-danger',
  } as const;

  const inner = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-[5px] border border-line bg-surface-2">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted">
          {label}
        </span>
        <span className="mt-0.5 block text-[14px] leading-snug">{children}</span>
      </span>
    </>
  );

  const className = `flex w-full max-w-md items-center gap-3 rounded-[6px] border px-3.5 py-3 transition-colors duration-150 ${tones[tone]}`;

  return href ? (
    <Link href={href} className={className}>{inner}</Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}

/** The offline replacement: the week's schedule as day / time / platform. */
function ScheduleStrip({
  schedule,
}: {
  schedule: Array<{ day: string; time: string; note: string; platform: string }>;
}) {
  return (
    <div className="w-full max-w-md rounded-[8px] border border-line bg-surface p-2">
      <div className="grid grid-cols-[64px_1fr_auto] gap-2 border-b border-line px-3 pb-2 pt-1.5">
        <Label className="text-[9.5px]">Day</Label>
        <Label className="text-[9.5px]">Time</Label>
        <Label className="text-[9.5px]">Platform</Label>
      </div>
      {schedule.map((slot) => (
        <div
          key={slot.day}
          className="grid grid-cols-[64px_1fr_auto] items-center gap-2 rounded-[6px] px-3 py-2.5 transition-colors duration-150 hover:bg-surface-2"
        >
          <span className="font-mono text-[13px] text-ink">{slot.day}</span>
          <span className="font-mono text-[13px] tabular-nums text-brand">{slot.time}</span>
          <span className="font-mono text-[12px] text-muted">{slot.platform}</span>
        </div>
      ))}
    </div>
  );
}

function nextStreamLabel(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
  const time = date
    .toLocaleTimeString('en-GB', { hour: 'numeric', hour12: true, timeZone: 'UTC' })
    .toUpperCase()
    .replace(' ', '');
  return `${day}, ${time}`;
}
