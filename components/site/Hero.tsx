import Link from 'next/link';
import { Eye, History, Play, Timer, Zap } from 'lucide-react';
import { coins } from '@/lib/format';
import { Display, Label, Num } from '@/components/ui/typography';
import { CoinMark, PlatformMark } from '@/components/ui/marks';
import { Countdown, Uptime } from '@/components/ui/Countdown';
import { PlayerFrame } from './PlayerFrame';
import type { StreamState, Viewer } from '@/lib/types';

/**
 * The hero is genuinely two screens, not one screen with a flag (UI Spec §4,
 * §5). The site is offline more hours than it is live, and the offline state
 * has a different job: say when he is back, and give them something to do
 * until then.
 *
 * The split is 5/7 rather than even: the copy column is a fixed measure, and
 * every pixel the right column gains is a pixel of picture.
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
  const title = (live ? stream.title : stream.lastVodTitle) ?? 'MattySpins on Kick';

  return (
    <div className="hero-glow border-b border-line">
      <div className="container-page grid gap-9 py-10 lg:grid-cols-12 lg:items-start lg:gap-8 lg:py-16">
        {/* ------------------------------------------------------------- */}
        {/* Left — status, headline, actions, schedule                     */}
        {/* ------------------------------------------------------------- */}
        <div className="flex flex-col gap-6 lg:col-span-5 lg:pt-4">
          {/* One word for the state, then the only number we actually
              measure. Kick's webhook carries no viewer count, so when we do
              not have one the whole element goes rather than showing a figure
              nobody counted. */}
          <div className="flex items-center gap-3">
            {live ? (
              <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-online">
                <span className="size-1.5 animate-pulse-online rounded-full bg-online" aria-hidden />
                Live on Kick
              </span>
            ) : (
              <Label className="tracking-[0.2em]">Offline</Label>
            )}
            {live && stream.viewers !== null ? (
              <>
                <span className="h-3 w-px bg-line" aria-hidden />
                <span className="flex items-center gap-1.5 text-ink">
                  <Eye size={14} className="text-muted" aria-hidden />
                  <Num tone="ink" className="text-[11.5px]">{coins(stream.viewers)}</Num>
                </span>
              </>
            ) : null}
          </div>

          {/* The headline, and — offline — the one figure the page exists to
              answer: when he is back. */}
          <div className="flex flex-col gap-3">
            {live ? (
              <Display size="xl" as="h1">
                The biggest
                <br />
                slots battles
                <br />
                <span className="text-brand-dim">on the internet</span>
              </Display>
            ) : (
              <>
                <Display size="xl" as="h1">
                  Back live
                  <br />
                  <span className="text-brand-dim">{nextStreamLabel(stream.nextStreamAt)}</span>
                </Display>
                <div className="flex items-center gap-2 text-gold">
                  <Timer size={19} aria-hidden />
                  <Countdown to={stream.nextStreamAt} tone="gold" className="text-[18px] font-medium" />
                </div>
              </>
            )}
          </div>

          <p className="max-w-[46ch] text-[15px] leading-relaxed text-ink-2 lg:text-[16px]">
            {live ? (
              <>
                Join the daily streams, rack up Matty Coins just by watching, and compete on the
                leaderboard for thousands in weekly prizes.
              </>
            ) : (
              <>
                Missed the last session? Catch up on the last stream while the next one loads. The
                board, the shop and the giveaways all keep running while he is offline — only coin
                earning pauses until he is back on.
              </>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={live ? `https://kick.com/${stream.channel}` : '/wins'}
              {...(live ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="inline-flex h-12 items-center gap-2 rounded-[3px] bg-brand px-6 font-mono text-[11.5px] uppercase tracking-[0.14em] text-brand-ink transition-colors duration-150 hover:bg-brand-dim"
            >
              {live ? (
                <>
                  <PlatformMark platform="kick" size={15} />
                  Watch the stream
                </>
              ) : (
                <>
                  <Play size={16} fill="currentColor" strokeWidth={0} aria-hidden />
                  Wall of fame
                </>
              )}
            </Link>
            <Link
              href="/leaderboard"
              className="inline-flex h-12 items-center rounded-[3px] border border-line-2 bg-surface px-6 font-mono text-[11.5px] uppercase tracking-[0.14em] text-ink transition-colors duration-150 hover:border-brand hover:text-brand-dim"
            >
              See this week&rsquo;s board
            </Link>
          </div>

          {/* The single most valuable element on the page — live, the viewer
              watches the mechanic working in real time; offline, the answer to
              "when do I come back". */}
          {live ? <EarningStatus viewer={viewer} /> : <ScheduleStrip schedule={schedule} />}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* Right — the frame                                             */}
        {/* ------------------------------------------------------------- */}
        <div className="lg:col-span-7">
          <PlayerFrame
            thumbUrl={live ? stream.thumbUrl : stream.lastVodThumb}
            embedUrl={live ? `https://player.kick.com/${stream.channel}` : stream.lastVodUrl}
            title={title}
            liveTag={live}
            playSize={66}
            watching={live ? stream.viewers ?? undefined : undefined}
            cornerLabel={live ? undefined : 'Last stream'}
          />
          <div className="mt-2.5 flex items-baseline justify-between gap-4 px-1">
            <p className="min-w-0 truncate text-[14px] text-ink">{title}</p>
            {live && stream.startedAt ? (
              <span className="flex shrink-0 items-center gap-1.5 font-mono text-[11.5px] tabular-nums text-muted">
                <Timer size={13} aria-hidden />
                <Uptime from={stream.startedAt} className="text-[11.5px] text-ink-2" />
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1.5 font-mono text-[11.5px] uppercase tracking-[0.12em] text-faint">
                <History size={13} aria-hidden />
                Last stream
              </span>
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
      <span className="grid size-9 shrink-0 place-items-center rounded-[3px] border border-line bg-surface-2">
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

  const className = `flex w-full max-w-md items-center gap-3 rounded-[3px] border px-3.5 py-3 transition-colors duration-150 ${tones[tone]}`;

  return href ? (
    <Link href={href} className={className}>{inner}</Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}

/**
 * The offline replacement: the week's nights as one strip of day-over-time
 * cells rather than three rows to work through — it reads as a schedule at a
 * glance, which is the only thing anyone asks of it.
 */
function ScheduleStrip({
  schedule,
}: {
  schedule: Array<{ day: string; time: string; note: string; platform: string }>;
}) {
  return (
    <div className="w-full max-w-md overflow-hidden rounded-[3px] border border-line bg-surface">
      <div className="border-b border-line bg-surface-2 px-3 py-1.5">
        <Label className="text-[9.5px]">Upcoming schedule · all times UK</Label>
      </div>
      <div className="grid grid-cols-3 gap-px bg-line [&>*]:bg-surface">
        {schedule.map((slot) => (
          <div key={slot.day} className="px-2 py-2.5 text-center">
            <Label className="text-[9.5px]">{slot.day}</Label>
            <Num tone="ink" className="mt-1 block text-[12.5px]">
              {slot.time}
            </Num>
            <span className="mt-1 block truncate text-[11.5px] text-muted">{slot.note}</span>
          </div>
        ))}
      </div>
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
