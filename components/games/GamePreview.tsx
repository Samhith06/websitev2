'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import type { GameSlug } from '@/lib/types';

/**
 * The lobby card's picture.
 *
 * Key art when a game has it, and a drawn illustration when it does not — so a
 * missing or slow image never leaves a broken frame on the page. The fallback
 * is also what blackjack and baccarat use while they are still "coming soon".
 */
export function GamePreview({
  slug,
  imageUrl,
  className,
}: {
  slug: GameSlug;
  imageUrl?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (imageUrl && !failed) {
    return (
      <div className={cn('relative h-[150px] w-full overflow-hidden', className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {/* The card's title sits under this, so the base is darkened to keep
            the boundary from fighting the artwork. */}
        <span
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(13,20,34,0.75))]"
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div className={cn('grid h-[150px] place-items-center px-5', className)} aria-hidden>
      {slug === 'keno' ? <KenoPreview /> : null}
      {slug === 'dice' ? <DicePreview /> : null}
      {slug === 'limbo' ? <LimboPreview /> : null}
      {(slug === 'blackjack' || slug === 'baccarat') ? <CardsPreview /> : null}
    </div>
  );
}

function KenoPreview() {
  const hits = new Set([2, 5, 9, 14]);
  const picked = new Set([2, 5, 7, 9, 14, 16]);
  return (
    <svg width="200" height="88" viewBox="0 0 200 88">
      {Array.from({ length: 24 }, (_, i) => {
        const x = (i % 8) * 25;
        const y = Math.floor(i / 8) * 30;
        const hit = hits.has(i);
        const pick = picked.has(i);
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width="21"
            height="26"
            rx="2"
            fill={hit ? '#FFB93B' : pick ? '#0C1B33' : '#111A2B'}
            stroke={hit ? '#FFB93B' : pick ? '#2B8FFF' : '#1B2740'}
          />
        );
      })}
    </svg>
  );
}

function DicePreview() {
  return (
    <svg width="200" height="60" viewBox="0 0 200 60">
      <rect x="0" y="26" width="118" height="10" rx="2" fill="#FF8A6B" opacity="0.3" />
      <rect x="118" y="26" width="82" height="10" rx="2" fill="#2B8FFF" opacity="0.5" />
      <rect x="116" y="20" width="3" height="22" fill="#E8EDF5" />
      <rect x="146" y="2" width="42" height="20" rx="2" fill="#FFB93B" />
      <text x="167" y="16" textAnchor="middle" fontFamily="monospace" fontSize="11" fill="#04121F" fontWeight="bold">
        74.12
      </text>
    </svg>
  );
}

function LimboPreview() {
  return (
    <svg width="200" height="76" viewBox="0 0 200 76">
      <path
        d="M4 70 C 60 68, 104 56, 132 34 S 176 6, 196 4"
        fill="none"
        stroke="#2B8FFF"
        strokeWidth="2"
        opacity="0.55"
      />
      <circle cx="132" cy="34" r="4" fill="#FFB93B" />
      <text x="8" y="26" fontFamily="monospace" fontSize="24" fill="#FFB93B" fontWeight="bold">
        4.72×
      </text>
    </svg>
  );
}

function CardsPreview() {
  return (
    <svg width="120" height="80" viewBox="0 0 120 80">
      <rect x="14" y="12" width="44" height="60" rx="4" fill="#111A2B" stroke="#1B2740" transform="rotate(-8 36 42)" />
      <rect x="52" y="12" width="44" height="60" rx="4" fill="#0D1422" stroke="#29354D" transform="rotate(6 74 42)" />
    </svg>
  );
}
