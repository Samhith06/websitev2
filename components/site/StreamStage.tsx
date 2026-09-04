'use client';

import { useEffect, useState } from 'react';
import type { StreamState } from '@/lib/types';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function split(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 };
}

/**
 * The top of the home page: the Kick player when Matty is live, a countdown to
 * the next stream when he is not.
 *
 * The offline state is deliberately the more designed of the two. Someone
 * arriving at 3pm to an empty black rectangle learns nothing; a countdown to
 * 7pm tells them exactly when to come back, which is the only thing they
 * wanted to know.
 */
export function StreamStage({ stream }: { stream: StreamState }) {
  const [muted, setMuted] = useState(true);
  const [now, setNow] = useState<number | null>(null);

  // The clock starts on the client only, so the server and the first client
  // render agree and hydration never mismatches on a ticking number.
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (stream.live) {
    const src = `https://player.kick.com/${stream.channel}?autoplay=true&muted=${muted}`;
    return (
      <div className="stage live">
        <iframe
          src={src}
          title={`${stream.channel} live on Kick`}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
        <div className="stage-top">
          <span className="livepill">
            <span className="livedot" aria-hidden />
            LIVE
          </span>
          {stream.viewers != null ? (
            <span className="viewers">👁 {stream.viewers.toLocaleString('en-GB')}</span>
          ) : null}
        </div>
        <div className="stage-bottom">
          <div className="stage-title">{stream.title ?? 'Live now on Kick'}</div>
          <button
            type="button"
            className={`btn sm ${muted ? '' : 'pri'}`}
            onClick={() => setMuted((m) => !m)}
          >
            {muted ? '🔇 Unmute' : '🔊 Sound on'}
          </button>
        </div>
      </div>
    );
  }

  const target = new Date(stream.nextStreamAt).getTime();
  const cd = now == null ? null : split(target - now);

  return (
    <div className="stage">
      <div className="videoish" style={{ opacity: 0.5 }} aria-hidden />
      <div className="stage-top">
        <span className="livepill offpill">OFFLINE</span>
      </div>
      <div className="countdown">
        <div className="cd-lab">Next stream · 7:00 PM UK</div>
        <div className="cd-clock">
          <div className="cd-u">
            <b>{cd ? pad(cd.h + cd.d * 24) : '--'}</b>
            <span>Hours</span>
          </div>
          <div className="cd-u">
            <b>{cd ? pad(cd.m) : '--'}</b>
            <span>Mins</span>
          </div>
          <div className="cd-u">
            <b>{cd ? pad(cd.s) : '--'}</b>
            <span>Secs</span>
          </div>
        </div>
        <div className="cd-sub">Matty streams every single day. Don&rsquo;t miss the bonus hunt.</div>
        <a
          className="btn pri"
          style={{ marginTop: 16 }}
          href={`https://kick.com/${stream.channel}`}
          target="_blank"
          rel="noreferrer noopener"
        >
          Follow on Kick
        </a>
      </div>
    </div>
  );
}
