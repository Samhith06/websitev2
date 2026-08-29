'use client';

import { useState } from 'react';
import { History, Play, Users } from 'lucide-react';
import { cn } from '@/lib/cn';
import { clipLength, compact } from '@/lib/format';
import { PlatformMark, SOURCE_LABELS } from '@/components/ui/marks';
import type { ClipSource } from '@/lib/types';

/**
 * Nothing embeds until it is clicked (UI Spec §8). The card holds a thumbnail;
 * the player replaces it in place on click — no lightbox, no navigation, so
 * everything below the frame stays put and the numbers remain readable while
 * the clip plays.
 *
 * Three live embeds on one page is a six-megabyte page that stutters on a
 * phone. This one decision is most of the site's mobile performance.
 */
export function PlayerFrame({
  thumbUrl,
  embedUrl,
  title,
  /** Aspect is a data field, not a constant (§23). */
  aspect = '16:9',
  source,
  durationSeconds,
  tone = 'default',
  playSize = 66,
  overlay,
  liveTag = false,
  watching,
  cornerLabel,
  className,
}: {
  thumbUrl: string;
  embedUrl?: string;
  title: string;
  aspect?: '16:9' | '9:16';
  source?: ClipSource;
  durationSeconds?: number;
  tone?: 'default' | 'gold';
  playSize?: number;
  /** The multiplier overlay on a featured big win. */
  overlay?: React.ReactNode;
  liveTag?: boolean;
  /** Concurrent viewers, shown over the still while the stream is live. */
  watching?: number;
  /** Replaces the live tag when the frame is showing a VOD rather than a stream. */
  cornerLabel?: React.ReactNode;
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const vertical = aspect === '9:16';

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-[3px] border bg-surface-2',
        tone === 'gold' ? 'border-gold-line' : 'border-line',
        className,
      )}
    >
      <div
        className={cn('relative w-full', vertical ? 'mx-auto max-w-[min(100%,340px)]' : '')}
        style={{ aspectRatio: vertical ? '9 / 16' : '16 / 9' }}
      >
        {playing && embedUrl ? (
          <iframe
            src={embedUrl}
            title={title}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 size-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play: ${title}`}
            className="absolute inset-0 size-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbUrl} alt="" className="size-full object-cover" loading="lazy" />

            <span
              className={cn(
                'absolute inset-0',
                tone === 'gold'
                  ? 'bg-[linear-gradient(160deg,rgba(255,185,59,0.12),rgba(7,11,20,0.55))]'
                  : 'bg-[linear-gradient(160deg,rgba(43,143,255,0.06),rgba(7,11,20,0.5))]',
              )}
              aria-hidden
            />

            {/* The play button scales slightly when its card is hovered (§29). */}
            <span
              className={cn(
                'absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full',
                'border transition-transform duration-150 group-hover:scale-105',
                tone === 'gold'
                  ? 'border-gold/60 bg-gold text-brand-ink'
                  : 'border-brand/60 bg-brand text-brand-ink',
              )}
              style={{ width: playSize, height: playSize }}
              aria-hidden
            >
              <Play size={playSize * 0.36} fill="currentColor" strokeWidth={0} className="ml-[6%]" />
            </span>

            {overlay}

            {liveTag ? (
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-[3px] bg-live px-2 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-white">
                <span className="size-1.5 animate-pulse-dot rounded-full bg-white" aria-hidden />
                Live
              </span>
            ) : null}

            {cornerLabel ? (
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-[5px] border border-line bg-surface-2/85 px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-2 backdrop-blur-sm">
                <History size={12} aria-hidden />
                {cornerLabel}
              </span>
            ) : null}

            {watching !== undefined ? (
              <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-[3px] border border-line bg-bg/80 px-2 py-1 font-mono text-[10.5px] tabular-nums text-ink-2 backdrop-blur-sm">
                <Users size={11} aria-hidden />
                {compact(watching)} watching
              </span>
            ) : null}

            {source ? (
              <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-[2px] border border-line bg-bg/85 px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-2 backdrop-blur-sm">
                <PlatformMark platform={source} size={12} />
                {SOURCE_LABELS[source] ?? source}
              </span>
            ) : null}

            {durationSeconds ? (
              <span className="absolute bottom-3 right-3 rounded-[2px] border border-line bg-bg/85 px-2 py-1 font-mono text-[10.5px] tabular-nums text-ink-2 backdrop-blur-sm">
                {clipLength(durationSeconds)}
              </span>
            ) : null}
          </button>
        )}
      </div>
    </div>
  );
}
