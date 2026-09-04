'use client';

import { useEffect, useState } from 'react';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function split(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(s / 86400),
    h: Math.floor(s / 3600) % 24,
    m: Math.floor(s / 60) % 60,
    s: s % 60,
  };
}

/**
 * The four-cell countdown used above the leaderboard.
 *
 * It renders dashes on the server and fills in on the client, so the markup
 * the server sent and the markup React first renders always agree — a ticking
 * number is the one thing guaranteed to differ between the two.
 */
export function Countdown({ to }: { to: string }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const c = now == null ? null : split(target - now);
  const cells: Array<[string, string]> = [
    [c ? String(c.d) : '--', 'Days'],
    [c ? pad(c.h) : '--', 'Hrs'],
    [c ? pad(c.m) : '--', 'Min'],
    [c ? pad(c.s) : '--', 'Sec'],
  ];

  return (
    <div className="cd-mini">
      {cells.map(([value, label]) => (
        <div className="u" key={label}>
          <b>{value}</b>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
