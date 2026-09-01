'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CoinMark } from '@/components/ui/marks';
import { useReducedMotion } from '@/lib/useReducedMotion';

const TICKS = 20;
const RAMP_MS = 2600;   // twenty ticks of three minutes, in one hold
const EASE_BACK_MS = 500;
const HOUR_BONUS = 10;

/**
 * The one designed interactive moment on the site (Home §5.1).
 *
 * The visitor does not read that being in the room pays. They hold a coin for
 * 2.6 seconds and watch twenty ticks land at their own rate.
 *
 * Three things make it feel designed rather than decorative:
 *
 *   • Progress climbs LINEARLY. It represents time passing and easing it would
 *     lie about that. This is the one place on the site where linear is right.
 *   • The figure ticks in twenty DISCRETE steps, not smoothly. Twenty distinct
 *     events in under three seconds is what makes it read as accrual; a smooth
 *     counter here would be a loading spinner with better typography.
 *   • Releasing early eases back to zero over 500ms rather than snapping. It
 *     has to feel like losing something, because in the actual game it is.
 *
 * It is a real <button>, so Space and Enter hold it exactly as a pointer does,
 * and pointerleave counts as a release or someone who drags off the coin
 * leaves it stuck at 60%.
 */
export function HoldToEarn({
  rate = 1,
  multiplierLabel,
  signedIn = false,
}: {
  /** The viewer's own rate in MC per tick. Signed out sees 1. */
  rate?: number;
  multiplierLabel?: string;
  signedIn?: boolean;
}) {
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const [complete, setComplete] = useState(false);
  const holding = useRef(false);
  const raf = useRef<number | null>(null);
  const last = useRef<number | null>(null);

  const perHour = rate * TICKS + HOUR_BONUS;

  // Reduced motion gets the finished state on entry, no hold required, and a
  // flip to reduced mid-hold completes it rather than abandoning it at 40%.
  useEffect(() => {
    if (reduced) {
      holding.current = false;
      setProgress(1);
      setComplete(true);
    }
  }, [reduced]);

  const frame = useCallback((now: number) => {
    if (last.current === null) last.current = now;
    const dt = now - last.current;
    last.current = now;

    setProgress((p) => {
      const next = holding.current
        ? Math.min(1, p + dt / RAMP_MS)
        : Math.max(0, p - dt / EASE_BACK_MS);
      if (next >= 1) setComplete(true);
      return next;
    });

    raf.current = requestAnimationFrame(frame);
  }, []);

  const start = useCallback(() => {
    if (reduced || complete) return;
    holding.current = true;
    if (raf.current === null) {
      last.current = null;
      raf.current = requestAnimationFrame(frame);
    }
  }, [complete, frame, reduced]);

  const stop = useCallback(() => {
    holding.current = false;
  }, []);

  useEffect(() => {
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, []);

  // Stop the loop once it has settled at either end, so an idle coin costs
  // nothing.
  useEffect(() => {
    if (raf.current !== null && !holding.current && (progress === 0 || progress === 1)) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
  }, [progress]);

  const ticks = Math.floor(progress * TICKS);
  const earned = ticks * rate;
  const shown = complete ? perHour : earned;

  const RADIUS = 62;
  const CIRC = 2 * Math.PI * RADIUS;

  return (
    <div className="flex flex-col items-center text-center">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
        Hold the coin. See what an hour is worth.
      </p>

      <div className="mt-6 flex items-center gap-8">
        <button
          type="button"
          aria-label="Hold to preview an hour of earning"
          onPointerDown={start}
          onPointerUp={stop}
          onPointerCancel={stop}
          onPointerLeave={stop}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); start(); }
          }}
          onKeyUp={(e) => {
            if (e.key === ' ' || e.key === 'Enter') stop();
          }}
          className="relative grid size-[150px] shrink-0 place-items-center rounded-full touch-none"
          style={{ touchAction: 'none' }}
        >
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 150 150" aria-hidden>
            <circle cx="75" cy="75" r={RADIUS} fill="none" stroke="var(--color-line)" strokeWidth="4" />
            <circle
              cx="75" cy="75" r={RADIUS} fill="none"
              stroke={complete ? 'var(--color-light-hot)' : 'var(--color-light)'}
              strokeWidth="4" strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - progress)}
            />
          </svg>
          <span
            className="transition-transform duration-[90ms] ease-out"
            style={{ transform: `scale(${1 + (progress > 0 && progress < 1 ? 0.02 : 0)})` }}
          >
            <CoinMark size={78} />
          </span>
        </button>

        <div className="text-left">
          <span
            aria-live="polite"
            className="block font-mono text-[40px] font-bold leading-none tabular-nums text-gold"
          >
            {shown} MC
          </span>
          {complete ? (
            <span className="mt-2 block font-mono text-[12px] uppercase tracking-[0.14em] text-light">
              +{HOUR_BONUS} MC hour bonus
            </span>
          ) : (
            <span className="mt-2 block font-mono text-[12px] uppercase tracking-[0.14em] text-faint">
              {ticks} / {TICKS} ticks
            </span>
          )}
        </div>
      </div>

      {/* The closing line uses the viewer's OWN number, not the example. */}
      <p
        className="mt-7 max-w-[46ch] text-[15px] leading-relaxed text-ink-2 transition-opacity duration-[620ms]"
        style={{ opacity: complete ? 1 : 0 }}
        aria-hidden={!complete}
      >
        That&rsquo;s <span className="font-mono tabular-nums text-gold">{perHour} MC</span> for an hour
        {multiplierLabel ? <span className="text-muted"> at {multiplierLabel}</span> : null}. Seven days of
        that and you&rsquo;re on the board.
        {!signedIn ? (
          <>
            {' '}
            <Link href="/api/auth/signin?callbackUrl=%2F" className="text-light underline-offset-4 hover:underline">
              Sign in and start
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
