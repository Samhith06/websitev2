'use client';

import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { StreamState } from '@/lib/types';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function split(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { h: Math.floor(s / 3600), m: Math.floor(s / 60) % 60, s: s % 60 };
}

const UK_CLOCK = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  hourCycle: 'h23',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

/**
 * Milliseconds until the next 7pm in the UK, wherever the reader is.
 *
 * Read off the UK's wall clock rather than the browser's, so someone abroad gets
 * the moment the stream actually starts. On the two nights a year the clocks
 * change, the day before reads an hour out until 2am passes; that is not worth a
 * timezone library for a countdown that corrects itself.
 */
function untilStream(now: number): number {
  const parts = UK_CLOCK.formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const elapsed = part('hour') * 3600 + part('minute') * 60 + part('second');
  const left = 19 * 3600 - elapsed;
  return (left > 0 ? left : left + 86400) * 1000;
}

/**
 * The top of the home page: the name, and where the stream stands.
 *
 * Live, it says so and sends people to Kick. Offline, it counts down to the next
 * stream, because someone arriving at 3pm only wants to know when to come back.
 */
export function StreamHero({
  stream,
  code,
  razedUrl,
}: {
  stream: StreamState;
  code: string;
  /** The referral link, which is what credits a signup to the code. */
  razedUrl: string;
}) {
  const [now, setNow] = useState<number | null>(null);

  // The clock starts on the client only, so the server and the first client
  // render agree and hydration never mismatches on a ticking number.
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const cd = now == null ? null : split(untilStream(now));

  return (
    <div className="h-lead">
      <div className="h-status">
        {stream.live ? (
          <>
            <span className="h-flag live">
              <i aria-hidden />
              LIVE ON KICK
            </span>
            {stream.viewers != null ? (
              <span>{stream.viewers.toLocaleString('en-GB')} watching</span>
            ) : null}
          </>
        ) : (
          <>
            <span className="h-flag">OFFLINE</span>
            <span>Live every day at 7pm UK on Kick</span>
          </>
        )}
      </div>

      <h1 className="h-title">
        MATTY
        <br />
        <span>SPINS</span>
      </h1>

      <p className="h-tagline">
        The official community hub. Live every day at 7pm UK on Kick. Official Razed partner.
      </p>

      {stream.live ? (
        <div className="h-now">
          <div className="h-label">On stream now</div>
          <b>{stream.title ?? 'Live now on Kick'}</b>
        </div>
      ) : (
        <div className="h-next">
          <div className="h-label">Next stream · 7:00 PM UK</div>
          <div className="h-clock">
            <div className="h-unit">
              <b>{cd ? pad(cd.h) : '--'}</b>
              <span>Hours</span>
            </div>
            <div className="h-unit">
              <b>{cd ? pad(cd.m) : '--'}</b>
              <span>Mins</span>
            </div>
            <div className="h-unit">
              <b>{cd ? pad(cd.s) : '--'}</b>
              <span>Secs</span>
            </div>
          </div>
          <div>Matty streams every single day. Don&rsquo;t miss the bonus hunt.</div>
        </div>
      )}

      <div className="h-cta">
        <a
          className="btn pri split"
          href={`https://kick.com/${stream.channel}`}
          target="_blank"
          rel="noreferrer noopener"
        >
          {stream.live ? 'Watch live on Kick' : 'Follow on Kick'}
          <ArrowRight size={18} aria-hidden />
        </a>
        <a
          className="btn split h-usecode"
          href={razedUrl}
          target="_blank"
          rel="noreferrer noopener sponsored"
        >
          <span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/razed.png" alt="Razed" width={102} height={35} />
            <span>Use code {code}</span>
          </span>
          <ArrowRight size={18} aria-hidden />
        </a>
      </div>
    </div>
  );
}
