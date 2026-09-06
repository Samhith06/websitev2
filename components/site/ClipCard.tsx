'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Clip } from '@/lib/types';
import { clipLength, coins, compact, dateShort, formatMultiplier, relativeTime } from '@/lib/format';
import { ClipVideo } from './ClipVideo';

/**
 * A clip, played where it was found.
 *
 * Both the home rail and the wall of fame used to be plain links that opened
 * Kick in a new tab, which is the one interaction guaranteed to end the visit —
 * somebody sent to Kick to watch a thirty-second clip does not come back to
 * the leaderboard. So a clip plays where it was found.
 *
 * The player is mounted only once the modal opens. Fifteen clips on the home
 * page each carrying a hidden player would load fifteen video players on a
 * phone, on a page whose job is to render a leaderboard quickly.
 *
 * Two kinds of player, because the platforms differ. YouTube, Instagram and X
 * still hand out an iframe. Kick does not — its player drops the clip it is
 * given and renders the live channel, which is why every Kick clip on the site
 * used to open on "MattySpinss is offline" — so those play from the clip's own
 * stream in `ClipVideo`.
 */
export function ClipCard({
  clip,
  showWin = false,
  onPlayingChange,
}: {
  clip: Clip;
  showWin?: boolean;
  /**
   * Told when the player opens and closes. The home page's moving rail needs
   * it: the player is a fixed overlay, so without this the card it was opened
   * from slides away underneath it.
   */
  onPlayingChange?: (open: boolean) => void;
}) {
  const [playing, setPlaying] = useState(false);
  // A clip whose stream will not play falls back to the link rather than to a
  // black rectangle. Reset on every open, so one bad network moment does not
  // condemn the clip for the rest of the visit.
  const [unplayable, setUnplayable] = useState(false);
  const hasFigures = clip.bet != null && clip.payout != null;

  /**
   * Kick's iframe is never used, whatever a row happens to hold.
   *
   * Clips added before the player stopped serving clips still carry the old
   * `player.kick.com/<channel>?clip=<id>` in the database. A migration blanks
   * those, but trusting the column would mean one unmigrated or re-added row
   * bringing the "MattySpinss is offline" card back — so the refusal lives
   * here as well, where it cannot be undone by data.
   */
  const iframeUrl = clip.source === 'kick' ? '' : clip.embedUrl;
  const canPlayHere = clip.videoUrl ? !unplayable : Boolean(iframeUrl);
  const onFail = useCallback(() => setUnplayable(true), []);

  // Counted here rather than on the card's click, because opening the player
  // is the play — a mis-click that is closed straight away still opened it,
  // and that is close enough to a watch for a counter on a carousel.
  const [plays, setPlays] = useState(clip.plays ?? 0);

  // Escape closes it, and the page behind it stops scrolling while it is open.
  useEffect(() => {
    if (!playing) return;
    onPlayingChange?.(true);
    void countPlay(clip.id, setPlays);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPlaying(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      onPlayingChange?.(false);
    };
    // `onPlayingChange` is deliberately not a dependency: a caller passing an
    // inline arrow would otherwise tear the modal down and rebuild it on every
    // render, which loses the video's position mid-clip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  return (
    <>
      <button
        type="button"
        className="clip"
        onClick={() => { setUnplayable(false); setPlaying(true); }}
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
          {/* The multiplier, and — where it earned one — the max-win mark
              beside it. Two tags in one row rather than two absolute boxes, so
              neither can land on top of the other. */}
          {showWin && (hasFigures || clip.maxWin) ? (
            <span className="cliptags">
              {hasFigures ? (
                <span className="tag gold">{formatMultiplier(clip.bet!, clip.payout!)}</span>
              ) : null}
              {clip.maxWin ? <span className="tag max">Max win</span> : null}
            </span>
          ) : null}
        </div>

        <div className="ci">
          <div className="ct">{clip.title}</div>
          <div className="cm">
            {clip.source} · {relativeTime(clip.occurredAt)}
            {/* Hidden at zero. "0 plays" on every card the day this ships
                advertises that nobody has watched them. */}
            {plays > 0 ? <> · {compact(plays)} {plays === 1 ? 'play' : 'plays'}</> : null}
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

      {/* Portalled to the body rather than left where the card sits. A
          `position: fixed` overlay is only fixed to the viewport while nothing
          above it is transformed — and the home page's wall-of-fame rail
          animates a `transform`, which would turn this into an absolute box
          clipped by that rail's own `overflow: hidden`. Safe to call without a
          mounted guard: `playing` only ever becomes true from a click, so this
          never runs during a server render. */}
      {playing
        ? createPortal(
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
                  {clip.videoUrl && !unplayable ? (
                    <ClipVideo
                      src={clip.videoUrl}
                      poster={clip.thumbUrl}
                      title={clip.title}
                      onFail={onFail}
                    />
                  ) : canPlayHere ? (
                    <iframe
                      src={iframeUrl}
                      title={clip.title}
                      allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                    />
                  ) : (
                    /* Said plainly rather than shown as a dead player. A clip added
                       before its stream URL was stored, or one Kick has since
                       pulled, still has somewhere to send people. */
                    <div className="clipmiss">
                      <p>This clip can&rsquo;t be played here.</p>
                      <a
                        className="btn sm"
                        href={clip.url}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        Watch it on {clip.source} ↗
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
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

/**
 * Count one play, at most once a day per clip per browser.
 *
 * The window is what stops the number being a measure of how many times one
 * person pressed replay. It lives in `localStorage` rather than on the server
 * because the server would have to know who was calling to do the same job,
 * and the count is not worth keeping a record of who watched what.
 *
 * Every failure here is silent and harmless: storage that throws (private
 * windows, blocked site data) just means the play is counted again next time,
 * and a request that does not land means it is not counted at all. Neither is
 * worth interrupting somebody watching a clip.
 */
const A_DAY = 24 * 60 * 60 * 1000;

async function countPlay(id: string, onCounted: (plays: number) => void): Promise<void> {
  const key = `clipplay:${id}`;
  try {
    const last = Number(localStorage.getItem(key) ?? 0);
    if (Number.isFinite(last) && Date.now() - last < A_DAY) return;
    localStorage.setItem(key, String(Date.now()));
  } catch {
    // No storage to remember with, so count it and move on.
  }

  try {
    const response = await fetch('/api/clips/play', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
      keepalive: true,
    });
    const data = await response.json();
    if (typeof data?.plays === 'number') onCounted(data.plays);
  } catch {
    // Not worth a word on screen — nobody opened a clip to read about this.
  }
}
