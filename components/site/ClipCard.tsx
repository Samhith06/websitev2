'use client';

import { useEffect, useState } from 'react';
import type { Clip } from '@/lib/types';
import { clipLength, coins, dateShort, formatMultiplier, relativeTime } from '@/lib/format';

/**
 * A clip, played where it was found.
 *
 * Both the home rail and the wall of fame used to be plain links that opened
 * Kick in a new tab, which is the one interaction guaranteed to end the visit —
 * somebody sent to Kick to watch a thirty-second clip does not come back to
 * the leaderboard. The embed is already stored against every clip, so playing
 * it in place costs nothing but this component.
 *
 * The iframe is mounted only once the modal opens. Fifteen clips on the home
 * page each carrying a hidden player would load fifteen video players on a
 * phone, on a page whose job is to render a leaderboard quickly.
 */
export function ClipCard({ clip, showWin = false }: { clip: Clip; showWin?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const hasFigures = clip.bet != null && clip.payout != null;

  // Escape closes it, and the page behind it stops scrolling while it is open.
  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPlaying(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [playing]);

  return (
    <>
      <button
        type="button"
        className="clip"
        onClick={() => setPlaying(true)}
        aria-label={`Play ${clip.title}`}
      >
        <div className="thumb">
          <ClipThumb clip={clip} />
          <div className="pl" aria-hidden>
            ▶
          </div>
          {clip.durationSeconds ? (
            <span className="dur">{clipLength(clip.durationSeconds)}</span>
          ) : null}
          {showWin && hasFigures ? (
            <span
              className="badge tag gold"
              style={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }}
            >
              {formatMultiplier(clip.bet!, clip.payout!)}
            </span>
          ) : null}
        </div>

        <div className="ci">
          <div className="ct">{clip.title}</div>
          <div className="cm">
            {clip.source} · {relativeTime(clip.occurredAt)}
          </div>
          {/* The wall of fame's figures, kept exactly as they read before —
              in coins, not dollars, which is the unit the rest of that page
              uses. */}
          {showWin && hasFigures ? (
            <div
              className="cm"
              style={{
                marginTop: 8,
                paddingTop: 8,
                borderTop: '1px solid var(--edge)',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <span>
                Bet <b style={{ color: 'var(--text)' }}>{coins(clip.bet!)}</b>
              </span>
              <span>
                Won <b style={{ color: 'var(--gold)' }}>{coins(clip.payout!)}</b>
              </span>
            </div>
          ) : null}

          {showWin && clip.slotName ? (
            <div className="cm" style={{ marginTop: 5 }}>
              {clip.slotName} · {dateShort(clip.occurredAt)}
            </div>
          ) : null}
        </div>
      </button>

      {playing ? (
        <div
          className="clipmodal"
          role="dialog"
          aria-modal="true"
          aria-label={clip.title}
          onClick={() => setPlaying(false)}
        >
          {/* Clicking the backdrop closes; clicking the player must not. */}
          <div className="clipbox" onClick={(e) => e.stopPropagation()}>
            <div className="clipbar">
              <span className="ct">{clip.title}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <a
                  className="btn sm ghost"
                  href={clip.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Open on {clip.source} ↗
                </a>
                <button className="btn sm" onClick={() => setPlaying(false)} aria-label="Close">
                  ✕
                </button>
              </div>
            </div>
            <div className={`clipframe ${clip.aspect === '9:16' ? 'tall' : ''}`}>
              <iframe
                src={clip.embedUrl}
                title={clip.title}
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
                loading="lazy"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * The thumbnail, with a fallback that survives a dead URL.
 *
 * Kick thumbnails carry a per-clip shard segment that used to be guessed, so
 * every clip added before that was fixed holds a URL that 403s. Those rows are
 * repaired by the refresh in admin, but a card must never render a broken
 * image icon while it waits — or if Kick moves an asset later.
 */
function ClipThumb({ clip }: { clip: Clip }) {
  const [failed, setFailed] = useState(false);

  if (!clip.thumbUrl || failed) {
    return (
      <span className="thumbfall" aria-hidden>
        {clip.kind === 'big_win' ? '★' : '◆'}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={clip.thumbUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
  );
}
