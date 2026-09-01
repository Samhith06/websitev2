"use client";

import { useEffect, useRef, useState } from 'react';

/**
 * Seeded pseudo-random, so the "random" offsets are identical on every load.
 * A headline that scatters differently each refresh reads as a glitch.
 */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/**
 * Splits a headline into word spans for a scroll- or load-driven entrance
 * (Late Night §4). Effects are transform and opacity only, driven off the
 * `--k` custom property.
 *
 * Accessibility: the full sentence is rendered once in a visually hidden span
 * for screen readers, and the visual copy is aria-hidden. A reader must never
 * hear a headline one word at a time.
 *
 * The load ramp exists because at scroll zero a purely scroll-driven band sits
 * unassembled, so the hero would open on footage with no words until the
 * visitor scrolled. Band one is the one designed exception to reversibility.
 */
export function SplitText({
  text,
  className = '',
  seed = 1,
  delay = 200,
  duration = 700,
  as: Tag = 'span',
}: {
  text: string;
  className?: string;
  seed?: number;
  delay?: number;
  duration?: number;
  as?: 'span' | 'h1' | 'h2';
}) {
  const [k, setK] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setK(1);
      return;
    }

    const start = performance.now() + delay;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / duration));
      setK(p);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [delay, duration]);

  const words = text.split(' ');
  const rand = rng(seed);

  return (
    <Tag className={`split split-rise ${className}`} style={{ ['--k' as string]: k }}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, i) => (
          <span
            key={`${word}-${i}`}
            className="w"
            style={{ ['--th' as string]: (i / Math.max(1, words.length)) * 0.55 + rand() * 0.05 }}
          >
            {word}
            {i < words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </span>
    </Tag>
  );
}
