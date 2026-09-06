'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A Kick clip, played from its own stream.
 *
 * Kick used to embed clips through `player.kick.com/<channel>?clip=<id>`. It
 * does not any more: the player reads the channel slug, drops the query string
 * it was handed and renders the live channel — so on a channel that is not
 * streaming, every clip on the site opened on "MattySpinss is offline". There
 * is no clip route left in Kick's player bundle at all, so there is no embed
 * URL to correct; the clip has to be played here.
 *
 * What Kick does still serve is the clip's own HLS playlist, publicly and with
 * `Access-Control-Allow-Origin: *`, so the site can play it itself. That needs
 * Media Source Extensions, which is what hls.js is for. It is imported
 * dynamically so the ~200 KB only lands on the one interaction that needs it —
 * a page whose job is to render a leaderboard quickly should not carry a video
 * engine for a modal nobody has opened.
 */
export function ClipVideo({
  src,
  poster,
  title,
  onFail,
}: {
  src: string;
  poster?: string;
  title: string;
  /** Told when the stream cannot be played, so the modal can offer the link. */
  onFail: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [waiting, setWaiting] = useState(true);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    let cancelled = false;
    // The escape hatch out of the effect, set by whichever of the two paths
    // below actually ran.
    let destroy: (() => void) | null = null;

    void (async () => {
      try {
        const { default: Hls } = await import('hls.js');
        if (cancelled) return;

        /**
         * hls.js first, native only as the fallback — and that order is not
         * arbitrary. `canPlayType('application/vnd.apple.mpegurl')` is not a
         * reliable answer: Chromium returns a truthy "maybe" for it and then
         * plays nothing at all, leaving a black frame with `readyState` stuck
         * at 0. Asking hls.js whether it can do the job is a real answer, and
         * where it says no — iOS Safari, which has no MSE — native playback is
         * genuine.
         */
        if (!Hls.isSupported()) {
          if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = src;
            destroy = () => { video.removeAttribute('src'); video.load(); };
          } else {
            onFail();
          }
          return;
        }

        const hls = new Hls({ enableWorker: true });

        // Recovery is bounded, and that bound is the point.
        //
        // Retrying a network error forever sounds generous and is the opposite:
        // a clip whose URL is simply wrong — a stale shard segment that 403s,
        // which is exactly what the older rows hold — never errors *out*, it
        // just retries under a "Loading clip…" label until the viewer gives up.
        // A refusal is not a blip. Anything the server answers with a 4xx is
        // permanent, so it goes straight to the fallback and the Kick link;
        // a genuine blip gets two more goes before the same thing happens.
        let networkRetries = 0;
        let recoveredMedia = false;
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          const status = data.response?.code;
          const refused = typeof status === 'number' && status >= 400 && status < 500;

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !refused && networkRetries < 2) {
            networkRetries += 1;
            hls.startLoad();
            return;
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recoveredMedia) {
            recoveredMedia = true;
            hls.recoverMediaError();
            return;
          }
          hls.destroy();
          onFail();
        });
        hls.loadSource(src);
        hls.attachMedia(video);
        destroy = () => hls.destroy();
      } catch {
        if (!cancelled) onFail();
      }
    })();

    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [src, onFail]);

  return (
    <>
      <video
        ref={ref}
        poster={poster || undefined}
        title={title}
        controls
        autoPlay
        playsInline
        preload="auto"
        /* `canplay`, not `playing`: a browser that blocks autoplay leaves the
           clip paused on its first frame, and a "Loading clip…" label sitting
           over a video that is ready and waiting for a tap is a lie. */
        onCanPlay={() => setWaiting(false)}
        onError={onFail}
      />
      {waiting ? (
        <span className="clipwait" aria-live="polite">
          Loading clip…
        </span>
      ) : null}
    </>
  );
}
