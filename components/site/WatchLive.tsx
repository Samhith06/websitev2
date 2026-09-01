'use client';

import { useState } from 'react';
import { MessageSquare, Play, Users } from 'lucide-react';
import { compact } from '@/lib/format';
import { PlatformMark } from '@/components/ui/marks';
import { LiveBadge } from './LiveBadge';
import type { StreamState } from '@/lib/types';

/**
 * The wide watch band: the Kick player and the Kick chat side by side, under
 * one header that says which channel this is and whether it is on.
 *
 * Two rules carried over from PlayerFrame (§8), for the same reason:
 *
 *   1. Nothing embeds until it is clicked. One click loads the player and the
 *      chat together, so the page costs a still and two buttons until someone
 *      actually wants to watch.
 *   2. Offline is a link, not an embed. Kick will happily frame its own
 *      channel page — it sends no X-Frame-Options — but a whole channel page
 *      squeezed into a 16:9 box is not a player, so with no stream running the
 *      still opens Kick in a new tab instead.
 */
export function WatchLive({ stream }: { stream: StreamState }) {
  const [open, setOpen] = useState(false);
  const live = stream.live;

  const title = (live ? stream.title : stream.lastVodTitle) ?? `${stream.channel} on Kick`;
  const still = live ? stream.thumbUrl : stream.lastVodThumb;

  return (
    <div className="overflow-hidden rounded-[3px] border border-line bg-surface">
      {/* ----------------------------------------------------------------- */}
      {/* Header                                                            */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3">
        <PlatformMark platform="kick" size={17} className="text-online" />
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink">Kick</span>
        <span className="text-line" aria-hidden>|</span>
        <a
          href={`https://kick.com/${stream.channel}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[11.5px] text-muted transition-colors duration-150 hover:text-brand-dim"
        >
          /{stream.channel}
        </a>

        <div className="ml-auto flex items-center gap-3">
          {live && stream.viewers !== null ? (
            <span className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-ink-2">
              <Users size={12} className="text-muted" aria-hidden />
              {compact(stream.viewers)} watching
            </span>
          ) : null}
          <LiveBadge live={live} compact />
        </div>
      </div>

      <p className="truncate border-b border-line px-4 py-2.5 text-[13.5px] text-ink-2">{title}</p>

      {/* ----------------------------------------------------------------- */}
      {/* Player + chat                                                     */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative bg-surface-2" style={{ aspectRatio: '16 / 9' }}>
          {open && live ? (
            <iframe
              src={`https://player.kick.com/${stream.channel}`}
              title={title}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 size-full"
            />
          ) : (
            <Still
              still={still}
              title={title}
              live={live}
              channel={stream.channel}
              onPlay={() => setOpen(true)}
            />
          )}
        </div>

        <ChatPane channel={stream.channel} open={open} onOpen={() => setOpen(true)} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Live: a button that swaps in the embed. Offline: a link out, because there
 * is nothing here to embed.
 */
function Still({
  still,
  title,
  live,
  channel,
  onPlay,
}: {
  still: string;
  title: string;
  live: boolean;
  channel: string;
  onPlay: () => void;
}) {
  const inner = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={still} alt="" className="size-full object-cover" loading="lazy" />
      <span
        className="absolute inset-0 bg-[linear-gradient(160deg,rgba(43,143,255,0.06),rgba(7,11,20,0.55))]"
        aria-hidden
      />
      <span
        className="absolute left-1/2 top-1/2 grid size-[62px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-brand/60 bg-brand text-brand-ink transition-transform duration-150 group-hover:scale-105"
        aria-hidden
      >
        <Play size={22} fill="currentColor" strokeWidth={0} className="ml-[6%]" />
      </span>
      {/* A top-left pill, not a bottom caption: the fallback still carries its
          own centred wordmark down there, and the two collide. */}
      <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-[5px] border border-line bg-surface-2/85 px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-2 backdrop-blur-sm">
        {live ? 'Play the stream and chat' : 'Watch the last stream'}
      </span>
    </>
  );

  const className = 'group absolute inset-0 size-full';

  return live ? (
    <button type="button" onClick={onPlay} aria-label={`Play: ${title}`} className={className}>
      {inner}
    </button>
  ) : (
    <a
      href={`https://kick.com/${channel}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${channel} on Kick`}
      className={className}
    >
      {inner}
    </a>
  );
}

/**
 * The chat column. Kick's popout chat frames fine and runs whether or not the
 * channel is live, so it loads on the same click as the player — and it can
 * also be opened on its own when the stream is off.
 */
function ChatPane({
  channel,
  open,
  onOpen,
}: {
  channel: string;
  open: boolean;
  onOpen: () => void;
}) {
  return (
    <div className="h-[320px] border-t border-line bg-bg lg:h-auto lg:border-l lg:border-t-0">
      {open ? (
        <iframe
          src={`https://kick.com/popout/${channel}/chat`}
          title={`${channel} chat on Kick`}
          className="size-full"
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-3 px-6 text-center">
          <MessageSquare size={20} className="text-faint" aria-hidden />
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Chat</p>
          <p className="text-[13px] leading-relaxed text-faint">
            Loads with the stream. Say anything in here while Matty is live and you start earning
            coins.
          </p>
          <button
            type="button"
            onClick={onOpen}
            className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-brand transition-colors duration-150 hover:text-brand-dim"
          >
            Load chat
          </button>
        </div>
      )}
    </div>
  );
}
