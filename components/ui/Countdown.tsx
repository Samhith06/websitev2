'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

function parts(msRemaining: number) {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
    total,
  };
}

/**
 * The countdown is never announced by a screen reader (UI Spec §30) — it would
 * interrupt every second. The deadline itself is exposed as a <time> element
 * for anything reading the page.
 */
export function Countdown({
  to,
  className,
  tone = 'ink',
  showSeconds = true,
  compact = false,
}: {
  to: string;
  className?: string;
  tone?: 'ink' | 'brand' | 'gold' | 'muted';
  showSeconds?: boolean;
  compact?: boolean;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const target = new Date(to).getTime();
    const update = () => setRemaining(target - Date.now());
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [to]);

  const tones = {
    ink: 'text-ink',
    brand: 'text-brand',
    gold: 'text-gold',
    muted: 'text-muted',
  } as const;

  // Server render and first paint match: a fixed-width placeholder, so the
  // layout never shifts when the real figure arrives.
  if (remaining === null) {
    return (
      <span className={cn('font-mono tabular-nums', tones[tone], className)} aria-hidden>
        --:--:--
      </span>
    );
  }

  const { days, hours, minutes, seconds, total } = parts(remaining);
  if (total === 0) {
    return (
      <span className={cn('font-mono tabular-nums', tones[tone], className)} aria-hidden>
        {compact ? '00:00' : 'Closed'}
      </span>
    );
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const text = days > 0
    ? `${days}d ${pad(hours)}h ${pad(minutes)}m`
    : showSeconds
      ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(hours)}h ${pad(minutes)}m`;

  return (
    <>
      <span className={cn('font-mono tabular-nums', tones[tone], className)} aria-hidden>
        {text}
      </span>
      <time dateTime={to} className="sr-only">
        {new Date(to).toUTCString()}
      </time>
    </>
  );
}

/** Uptime, counting up from a start time. Same rules. */
export function Uptime({ from, className }: { from: string; className?: string }) {
  const [elapsed, setElapsed] = useState<number | null>(null);

  useEffect(() => {
    const start = new Date(from).getTime();
    const update = () => setElapsed(Date.now() - start);
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [from]);

  if (elapsed === null) {
    return <span className={cn('font-mono tabular-nums', className)} aria-hidden>--:--:--</span>;
  }

  const { hours, minutes, seconds, days } = parts(elapsed);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <span className={cn('font-mono tabular-nums', className)} aria-hidden>
      {pad(hours + days * 24)}:{pad(minutes)}:{pad(seconds)}
    </span>
  );
}

/**
 * The countdown broken into labelled boxes — days, hours, minutes — for the
 * offline hero, where "when is he back" is the question the page exists to
 * answer and a single mono string is too easy to skim past.
 *
 * Same rule as the inline version: it is never announced by a screen reader,
 * and the real deadline is exposed as a <time> element instead.
 */
export function CountdownBoxes({ to, className }: { to: string; className?: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const target = new Date(to).getTime();
    const update = () => setRemaining(target - Date.now());
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [to]);

  const { days, hours, minutes } = parts(remaining ?? 0);
  const cells: Array<[string, string]> = [
    [remaining === null ? '--' : String(days).padStart(2, '0'), 'Days'],
    [remaining === null ? '--' : String(hours).padStart(2, '0'), 'Hours'],
    [remaining === null ? '--' : String(minutes).padStart(2, '0'), 'Mins'],
  ];

  return (
    <>
      <div className={cn('flex items-stretch gap-2', className)} aria-hidden>
        {cells.map(([value, label], i) => (
          <div key={label} className="flex items-stretch gap-2">
            {i > 0 ? (
              <span className="display flex items-center text-[26px] leading-none text-muted">:</span>
            ) : null}
            <div className="flex min-w-[70px] flex-col items-center justify-center rounded-[8px] border border-line bg-surface px-3 py-2.5">
              <span className="font-mono text-[22px] font-semibold leading-none tabular-nums text-brand">
                {value}
              </span>
              <span className="mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted">
                {label}
              </span>
            </div>
          </div>
        ))}
      </div>
      <time dateTime={to} className="sr-only">
        {new Date(to).toUTCString()}
      </time>
    </>
  );
}
