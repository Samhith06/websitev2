'use client';

import { useState } from 'react';
import type { Clip } from '@/lib/types';
import { ClipCard } from './ClipCard';

/**
 * The wall of fame, moving, on the home page.
 *
 * The big wins were only ever reachable from a tab on `/community`, which is
 * two clicks past the page most people ever see — so the best thing on the site
 * was the best-hidden. This puts them on the front page above the recent clips
 * and keeps them moving, because a still row of six reads as a grid and a
 * moving one reads as "there are more of these".
 *
 * The motion is a marquee rather than a slideshow: no dots, no timer, nothing
 * that swaps content out from under a cursor. The track holds the wins twice
 * over and slides exactly half its width, so the loop has no seam.
 *
 * Three things stop it, all for the same reason — a moving target cannot be
 * clicked. Hovering pauses it and so does focusing anything inside it, both in
 * CSS; opening a clip pauses it from here, because the player is a fixed
 * overlay and the card it was opened from would otherwise crawl away
 * underneath it. And it never starts at all for a reader whose system asks
 * things to stop moving: that one gets an ordinary rail they scroll
 * themselves.
 */
export function FameRail({ wins }: { wins: Clip[] }) {
  const [playing, setPlaying] = useState(0);

  if (wins.length === 0) return null;

  // Duplicated so the slide can loop seamlessly. The copy is hidden from
  // assistive technology and taken out of the tab order — it is the same wins
  // again, and reading them twice is not a feature.
  const track = [
    ...wins.map((clip, i) => ({ clip, key: `a${i}`, ghost: false })),
    ...wins.map((clip, i) => ({ clip, key: `b${i}`, ghost: true })),
  ];

  return (
    <div className="famerail" data-paused={playing > 0 ? '' : undefined}>
      <div
        className="famtrack"
        style={{
          // About the same time per card however many there are, so six wins
          // do not race past and twenty do not crawl.
          animationDuration: `${Math.max(24, wins.length * 7)}s`,
        }}
      >
        {track.map(({ clip, key, ghost }) => (
          <div className="famcard" key={key} aria-hidden={ghost || undefined} inert={ghost}>
            <ClipCard
              clip={clip}
              showWin
              onPlayingChange={(open) => setPlaying((n) => Math.max(0, n + (open ? 1 : -1)))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
